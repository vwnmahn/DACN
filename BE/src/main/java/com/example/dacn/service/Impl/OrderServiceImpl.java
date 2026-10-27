package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.CreateOrderRequest;
import com.example.dacn.dto.response.OrderItemResponse;
import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.*;
import com.example.dacn.service.OrderService;
import com.example.dacn.service.VoucherService;
import com.example.dacn.service.VoucherReservationResult;
import com.example.dacn.service.DeliveryDistanceService;
import com.example.dacn.service.DeliveryCalculation;
import com.example.dacn.config.OrderManagementProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final Clock clock;
    private final VoucherService voucherService;
    private final DeliveryDistanceService deliveryDistanceService;
    private final OrderManagementProperties orderManagementProperties;

    @Override
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        Account principal = currentAccount();
        Account account = accountRepository.findByIdForUpdate(principal.getId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        validateCreateRequest(request);

        String key = request.getIdempotencyKey().trim();
        String fingerprint = fingerprint(request);
        Optional<Order> existing = orderRepository
                .findByAccountIdAndIdempotencyKey(account.getId(), key);
        if (existing.isPresent()) {
            if (!fingerprint.equals(existing.get().getRequestFingerprint())) {
                throw new AppException(ErrorCode.ORDER_IDEMPOTENCY_CONFLICT);
            }
            return toResponse(existing.get());
        }

        Restaurant restaurant = restaurantRepository.findById(request.getRestaurantId())
                .orElseThrow(() -> new AppException(ErrorCode.RESTAURANT_NOT_FOUND));
        if (!Boolean.TRUE.equals(restaurant.getActive())) {
            throw new AppException(ErrorCode.RESTAURANT_INACTIVE);
        }
        if (!isOpen(restaurant, LocalTime.now(clock))) {
            throw new AppException(ErrorCode.RESTAURANT_CLOSED);
        }
        DeliveryCalculation delivery = deliveryDistanceService.calculateDelivery(restaurant,
                request.getDeliveryLatitude(), request.getDeliveryLongitude());

        LocalDateTime now = LocalDateTime.now(clock);
        OrderConfirmationMode confirmationMode = restaurant.getOrderConfirmationMode() == null
                ? OrderConfirmationMode.MANUAL : restaurant.getOrderConfirmationMode();
        boolean auto = confirmationMode == OrderConfirmationMode.AUTO;
        boolean onlinePayment = request.getPaymentMethod() == PaymentMethod.VNPAY;
        OrderStatus initialStatus = auto && onlinePayment
                ? OrderStatus.AWAITING_PAYMENT : OrderStatus.PENDING;

        Order order = Order.builder()
                .account(account)
                .restaurant(restaurant)
                .status(initialStatus)
                .confirmationDeadline(auto ? null : now.plus(orderManagementProperties.getConfirmationTimeout()))
                .acceptedAt(null)
                .confirmedAt(null)
                .confirmationSource(null)
                .refundRequired(false)
                .deliveryFee(delivery.deliveryFee())
                .deliveryLatitude(request.getDeliveryLatitude())
                .deliveryLongitude(request.getDeliveryLongitude())
                .restaurantLatitude(restaurant.getLatitude())
                .restaurantLongitude(restaurant.getLongitude())
                .deliveryDistanceKm(delivery.distanceKm())
                .deliveryRadiusKmSnapshot(delivery.deliveryRadiusKm())
                .baseDeliveryFeeSnapshot(nonNegative(restaurant.getDeliveryFee()))
                .baseDistanceKmSnapshot(restaurant.getBaseDistanceKm())
                .additionalFeePerKmSnapshot(restaurant.getAdditionalFeePerKm())
                .discountAmount(BigDecimal.ZERO)
                .recipientName(request.getRecipientName().trim())
                .recipientPhone(request.getRecipientPhone().trim())
                .deliveryAddress(request.getDeliveryAddress().trim())
                .deliveryNote(trimToNull(request.getDeliveryNote()))
                .idempotencyKey(key)
                .requestFingerprint(fingerprint)
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        Set<Long> uniqueItemIds = new HashSet<>();
        for (CreateOrderRequest.Item requestedItem : request.getItems()) {
            if (!uniqueItemIds.add(requestedItem.getMenuItemId())) {
                throw new AppException(ErrorCode.ORDER_DUPLICATE_MENU_ITEM);
            }
            MenuItem menuItem = menuItemRepository.findById(requestedItem.getMenuItemId())
                    .orElseThrow(() -> new AppException(ErrorCode.MENU_ITEM_NOT_FOUND));
            if (!menuItem.getRestaurant().getId().equals(restaurant.getId())) {
                throw new AppException(ErrorCode.MENU_ITEM_NOT_IN_RESTAURANT);
            }
            if (!Boolean.TRUE.equals(menuItem.getActive())
                    || !Boolean.TRUE.equals(menuItem.getAvailable())) {
                throw new AppException(ErrorCode.MENU_ITEM_UNAVAILABLE);
            }
            if (menuItem.getPrice() == null || menuItem.getPrice().compareTo(BigDecimal.ZERO) < 0) {
                throw new AppException(ErrorCode.MENU_ITEM_INVALID_PRICE);
            }

            BigDecimal unitPrice = menuItem.getPrice();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(requestedItem.getQuantity()));
            order.addItem(OrderItem.builder()
                    .menuItem(menuItem)
                    .itemName(menuItem.getName())
                    .unitPrice(unitPrice)
                    .quantity(requestedItem.getQuantity())
                    .lineTotal(lineTotal)
                    .build());
            subtotal = subtotal.add(lineTotal);
        }

        order.setSubtotal(subtotal);
        order.setTotalAmount(subtotal.add(order.getDeliveryFee()));
        order = orderRepository.save(order);
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            VoucherReservationResult reserved = voucherService.reserveForOrder(request.getVoucherCode(),
                    account.getId(), order.getId(), restaurant.getId(), subtotal, order.getDeliveryFee());
            order.setVoucherId(reserved.voucherId());
            order.setVoucherCode(reserved.voucherCode());
            order.setDiscountAmount(reserved.discountAmount());
            order.setTotalAmount(subtotal.subtract(reserved.discountAmount()).add(order.getDeliveryFee()));
            order = orderRepository.save(order);
        }
        return toResponse(order);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getMyOrders() {
        Long accountId = currentAccount().getId();
        return orderRepository.findByAccountIdOrderByIdDesc(accountId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse getMyOrder(Long orderId) {
        Long accountId = currentAccount().getId();
        Order order = orderRepository.findByIdAndAccountId(orderId, accountId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        return toResponse(order);
    }

    private Account currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account account)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return account;
    }

    private void validateCreateRequest(CreateOrderRequest request) {
        if (request == null || request.getRestaurantId() == null
                || request.getIdempotencyKey() == null || request.getIdempotencyKey().isBlank()
                || request.getRecipientName() == null || request.getRecipientName().isBlank()
                || request.getRecipientPhone() == null || request.getRecipientPhone().isBlank()
                || request.getDeliveryAddress() == null || request.getDeliveryAddress().isBlank()
                || request.getDeliveryLatitude() == null || request.getDeliveryLongitude() == null
                || request.getItems() == null || request.getItems().isEmpty()) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        for (CreateOrderRequest.Item item : request.getItems()) {
            if (item == null || item.getMenuItemId() == null
                    || item.getQuantity() == null || item.getQuantity() < 1 || item.getQuantity() > 100) {
                throw new AppException(ErrorCode.ORDER_INVALID_QUANTITY);
            }
        }
    }

    private BigDecimal nonNegative(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new AppException(ErrorCode.RESTAURANT_INVALID_DELIVERY_FEE);
        }
        return amount;
    }

    private String fingerprint(CreateOrderRequest request) {
        String items = request.getItems().stream()
                .sorted(Comparator.comparing(CreateOrderRequest.Item::getMenuItemId))
                .map(item -> item.getMenuItemId() + ":" + item.getQuantity())
                .reduce((left, right) -> left + "," + right).orElse("");
        String canonical = request.getRestaurantId() + "|" + items + "|"
                + normalized(request.getRecipientName()) + "|"
                + normalized(request.getRecipientPhone()) + "|"
                + normalized(request.getDeliveryAddress()) + "|"
                + normalized(request.getDeliveryNote());
        if (request.getPaymentMethod() != null) {
            canonical += "|paymentMethod=" + request.getPaymentMethod().name();
        }
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            canonical += "|voucher=" + request.getVoucherCode().trim().toUpperCase(Locale.ROOT);
        }
        canonical += "|gps=" + request.getDeliveryLatitude().stripTrailingZeros().toPlainString()
                + "," + request.getDeliveryLongitude().stripTrailingZeros().toPlainString();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private boolean isOpen(Restaurant restaurant, LocalTime now) {
        LocalTime opening = restaurant.getOpeningTime();
        LocalTime closing = restaurant.getClosingTime();
        if (opening == null || closing == null || opening.equals(closing)) {
            return false;
        }
        if (opening.isBefore(closing)) {
            return !now.isBefore(opening) && now.isBefore(closing);
        }
        return !now.isBefore(opening) || now.isBefore(closing);
    }

    private String normalized(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private OrderResponse toResponse(Order order) {
        List<OrderItemResponse> items = order.getItems().stream()
                .map(item -> OrderItemResponse.builder()
                        .id(item.getId())
                        .menuItemId(item.getMenuItem().getId())
                        .itemName(item.getItemName())
                        .unitPrice(item.getUnitPrice())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .build())
                .toList();
        return OrderResponse.builder()
                .id(order.getId())
                .restaurantId(order.getRestaurant().getId())
                .restaurantName(order.getRestaurant().getName())
                .status(order.getStatus())
                .confirmationDeadline(order.getConfirmationDeadline())
                .acceptedAt(order.getAcceptedAt())
                .confirmedAt(order.getConfirmedAt())
                .confirmationSource(order.getConfirmationSource())
                .cancellationReason(order.getCancellationReason())
                .cancelledAt(order.getCancelledAt())
                .refundRequired(order.getRefundRequired())
                .subtotal(order.getSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .deliveryLatitude(order.getDeliveryLatitude())
                .deliveryLongitude(order.getDeliveryLongitude())
                .restaurantLatitude(order.getRestaurantLatitude())
                .restaurantLongitude(order.getRestaurantLongitude())
                .deliveryDistanceKm(order.getDeliveryDistanceKm())
                .deliveryRadiusKmSnapshot(order.getDeliveryRadiusKmSnapshot())
                .baseDeliveryFeeSnapshot(order.getBaseDeliveryFeeSnapshot())
                .baseDistanceKmSnapshot(order.getBaseDistanceKmSnapshot())
                .additionalFeePerKmSnapshot(order.getAdditionalFeePerKmSnapshot())
                .discountAmount(order.getDiscountAmount())
                .voucherId(order.getVoucherId())
                .voucherCode(order.getVoucherCode())
                .totalAmount(order.getTotalAmount())
                .recipientName(order.getRecipientName())
                .recipientPhone(order.getRecipientPhone())
                .deliveryAddress(order.getDeliveryAddress())
                .deliveryNote(order.getDeliveryNote())
                .items(items)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
