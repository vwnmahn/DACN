package com.example.dacn.service.Impl;

import com.example.dacn.config.OrderManagementProperties;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.*;
import com.example.dacn.event.OrderStatusChangedEvent;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.OrderStatusHistoryRepository;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.repository.RestaurantEmployeeRepository;
import com.example.dacn.service.OrderManagementService;
import com.example.dacn.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.ZoneId;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
public class OrderManagementServiceImpl implements OrderManagementService {
    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final PaymentRepository paymentRepository;
    private final OrderStatusHistoryRepository historyRepository;
    private final VoucherService voucherService;
    private final OrderManagementProperties properties;
    private final Clock clock;

    @Autowired(required = false)
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private RestaurantEmployeeRepository employeeRepository;

    @Autowired
    public OrderManagementServiceImpl(OrderRepository orderRepository, AccountRepository accountRepository,
                                      PaymentRepository paymentRepository, OrderStatusHistoryRepository historyRepository,
                                      VoucherService voucherService, OrderManagementProperties properties, Clock clock) {
        this.orderRepository = orderRepository;
        this.accountRepository = accountRepository;
        this.paymentRepository = paymentRepository;
        this.historyRepository = historyRepository;
        this.voucherService = voucherService;
        this.properties = properties;
        this.clock = clock;
    }

    public OrderManagementServiceImpl(OrderRepository orderRepository, PaymentRepository paymentRepository,
                                      OrderStatusHistoryRepository historyRepository, VoucherService voucherService,
                                      OrderManagementProperties properties, Clock clock) {
        this(orderRepository, null, paymentRepository, historyRepository, voucherService, properties, clock);
    }

    @Override
    @Transactional
    public OrderResponse confirmByAdmin(Long orderId) {
        Account actor = currentAccountOrNull();
        Order order = lockedOrder(orderId);
        OrderStatus oldStatus = order.getStatus();
        LocalDateTime now = now();
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new AppException(ErrorCode.ORDER_CANCELLATION_NOT_ALLOWED);
        }
        if (order.getStatus() != OrderStatus.PENDING || order.getConfirmationDeadline() == null) {
            throw new AppException(ErrorCode.ORDER_NOT_AWAITING_CONFIRMATION);
        }
        if (!now.isBefore(order.getConfirmationDeadline())) {
            throw new AppException(ErrorCode.ORDER_CONFIRMATION_EXPIRED);
        }

        Payment payment = latestPaymentForUpdate(order.getId());
        order.setAcceptedAt(now);
        order.setConfirmationSource(ConfirmationSource.MANUAL);
        order.setConfirmationDeadline(null);
        if (payment.getPaymentMethod() == PaymentMethod.VNPAY
                && payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
            order.setStatus(OrderStatus.AWAITING_PAYMENT);
        } else {
            order.setStatus(OrderStatus.CONFIRMED);
            order.setConfirmedAt(now);
        }
        recordHistory(order, oldStatus, order.getStatus(), actor, OrderStatusActorType.ADMIN,
                "Admin xác nhận đơn hàng");
        return response(orderRepository.save(order));
    }

    @Override
    @Transactional
    public OrderResponse updateStatusByAdmin(Long orderId, OrderStatus target) {
        Account actor = currentAccountOrNull();
        Order order = lockedOrder(orderId);
        OrderStatus oldStatus = order.getStatus();
        if (target == null || !order.getStatus().canTransitionTo(target)
                || target == OrderStatus.CANCELLED || target == OrderStatus.AWAITING_PAYMENT
                || target == OrderStatus.CONFIRMED) {
            throw new AppException(ErrorCode.ORDER_INVALID_TRANSITION);
        }
        Payment payment = latestPaymentForUpdate(orderId);
        if (target == OrderStatus.COMPLETED && payment.getPaymentMethod() == PaymentMethod.COD) {
            throw new AppException(ErrorCode.COD_COLLECTION_REQUIRED);
        }
        if (payment.getPaymentMethod() == PaymentMethod.VNPAY
                && payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
            throw new AppException(ErrorCode.ORDER_PAYMENT_NOT_READY);
        }
        order.setStatus(target);
        if (target == OrderStatus.READY_FOR_DELIVERY && order.getShipper() == null) {
            autoAssignShipper(order);
        }
        if (target == OrderStatus.COMPLETED) {
            awardLoyaltyPoints(order, now());
        }
        recordHistory(order, oldStatus, target, actor, OrderStatusActorType.ADMIN,
                "Admin cập nhật trạng thái đơn hàng");
        return response(orderRepository.save(order));
    }

    @Override
    @Transactional
    public OrderResponse assignShipper(Long orderId, Long shipperId) {
        Order order = lockedOrder(orderId);
        if (Set.of(OrderStatus.DELIVERING, OrderStatus.ARRIVED,
                OrderStatus.COMPLETED, OrderStatus.CANCELLED).contains(order.getStatus())) {
            throw new AppException(ErrorCode.ORDER_SHIPPER_ASSIGNMENT_NOT_ALLOWED);
        }

        RestaurantEmployee shipper = employeeRepository.findByIdForUpdate(shipperId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_SHIPPER_NOT_FOUND));
        if (shipper.getPosition() != EmployeePosition.SHIPPER) {
            throw new AppException(ErrorCode.ORDER_SHIPPER_INVALID_POSITION);
        }
        if (shipper.getStatus() != EmploymentStatus.ACTIVE) {
            throw new AppException(ErrorCode.ORDER_SHIPPER_INACTIVE);
        }
        if (!shipper.getRestaurant().getId().equals(order.getRestaurant().getId())) {
            throw new AppException(ErrorCode.ORDER_SHIPPER_WRONG_RESTAURANT);
        }
        if (isShipperBusy(shipper.getId(), order.getId())) {
            throw new AppException(ErrorCode.ORDER_SHIPPER_BUSY);
        }

        order.setShipper(shipper);
        Order saved = orderRepository.save(order);
        publishOrderUpdate(saved, now());
        return response(saved);
    }

    private void autoAssignShipper(Order order) {
        employeeRepository.findActiveShippersForUpdate(order.getRestaurant().getId()).stream()
                .filter(shipper -> !isShipperBusy(shipper.getId(), order.getId()))
                .findFirst()
                .ifPresent(order::setShipper);
    }

    private boolean isShipperBusy(Long shipperId, Long currentOrderId) {
        return orderRepository.existsByShipperIdAndStatusNotInAndIdNot(
                shipperId, Set.of(OrderStatus.COMPLETED, OrderStatus.CANCELLED), currentOrderId);
    }

    @Override
    @Transactional
    public OrderResponse cancelMyOrder(Long orderId, String reasonCode, String reason) {
        Account account = currentAccount();
        Order order = lockedOrder(orderId);
        if (!order.getAccount().getId().equals(account.getId())) {
            throw new AppException(ErrorCode.ORDER_NOT_FOUND);
        }
        LocalDateTime cancellationDeadline = order.getCreatedAt() == null ? null
                : order.getCreatedAt().plus(properties.getCustomerCancellationWindow());
        if (order.getStatus() != OrderStatus.PENDING || cancellationDeadline == null
                || !now().isBefore(cancellationDeadline)) {
            throw new AppException(ErrorCode.ORDER_CANCELLATION_NOT_ALLOWED);
        }
        String normalizedCode = reasonCode == null ? "" : reasonCode.trim();
        String requestedReason = reason == null ? "" : reason.trim();
        if (!Set.of("ADDRESS_CHANGE", "VOUCHER_CHANGE", "ITEM_CHANGE", "OTHER").contains(normalizedCode)
                || !hasText(requestedReason) || requestedReason.length() > 500) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        String normalizedReason = switch (normalizedCode) {
            case "ADDRESS_CHANGE" -> "Muốn thay đổi địa chỉ giao hàng";
            case "VOUCHER_CHANGE" -> "Muốn thay đổi voucher";
            case "ITEM_CHANGE" -> "Muốn thay đổi món ăn";
            case "OTHER" -> requestedReason;
            default -> throw new AppException(ErrorCode.INVALID_REQUEST);
        };
        order.setCancellationCode(normalizedCode);
        order.setCancellationDetail(normalizedReason);
        cancel(order, OrderCancellationReason.CANCELLED_BY_USER, account,
                OrderStatusActorType.USER, normalizedReason);
        return response(order);
    }

    @Override
    @Transactional
    public OrderResponse confirmReceivedByUser(Long orderId) {
        Account account = currentAccount();
        Order order = lockedOrder(orderId);
        if (!order.getAccount().getId().equals(account.getId())) {
            throw new AppException(ErrorCode.ORDER_NOT_FOUND);
        }
        if (order.getStatus() != OrderStatus.ARRIVED) {
            throw new AppException(ErrorCode.ORDER_INVALID_TRANSITION);
        }

        Payment payment = latestPaymentForUpdate(orderId);
        LocalDateTime completedAt = now();
        if (payment.getPaymentMethod() == PaymentMethod.VNPAY) {
            if (payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
                throw new AppException(ErrorCode.ORDER_PAYMENT_NOT_READY);
            }
        } else if (payment.getPaymentMethod() == PaymentMethod.COD) {
            if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
                throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
            }
            payment.setPaymentStatus(PaymentStatus.SUCCESS);
            payment.setPaidAt(completedAt);
            payment.setPaymentMessage("Khách hàng xác nhận đã nhận hàng và thanh toán COD");
            paymentRepository.save(payment);
            voucherService.applyForOrder(orderId);
        } else {
            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }

        order.setStatus(OrderStatus.COMPLETED);
        awardLoyaltyPoints(order, completedAt);
        recordHistory(order, OrderStatus.ARRIVED, OrderStatus.COMPLETED, account,
                OrderStatusActorType.USER, "Khách hàng xác nhận đã nhận hàng");
        return response(orderRepository.save(order));
    }

    @Override
    @Transactional
    public OrderResponse completeCodByAdmin(Long orderId, boolean paymentCollected) {
        if (!paymentCollected) {
            throw new AppException(ErrorCode.COD_COLLECTION_REQUIRED);
        }
        Account actor = currentAccountOrNull();
        Order order = lockedOrder(orderId);
        OrderStatus oldStatus = order.getStatus();
        if (order.getStatus() != OrderStatus.ARRIVED) {
            throw new AppException(ErrorCode.ORDER_INVALID_TRANSITION);
        }
        Payment payment = latestPaymentForUpdate(orderId);
        if (payment.getPaymentMethod() != PaymentMethod.COD) {
            throw new AppException(ErrorCode.ORDER_NOT_COD);
        }
        if (payment.getPaymentStatus() == PaymentStatus.SUCCESS) {
            if (order.getStatus() != OrderStatus.COMPLETED) {
                order.setStatus(OrderStatus.COMPLETED);
                awardLoyaltyPoints(order, now());
                recordHistory(order, oldStatus, OrderStatus.COMPLETED, actor,
                        OrderStatusActorType.ADMIN, "Admin xác nhận hoàn tất và đã thu tiền COD");
            }
            return response(order);
        }
        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }
        payment.setPaymentStatus(PaymentStatus.SUCCESS);
        payment.setPaidAt(now());
        payment.setPaymentMessage("Đã xác nhận thu tiền COD");
        order.setStatus(OrderStatus.COMPLETED);
        awardLoyaltyPoints(order, now());
        recordHistory(order, oldStatus, OrderStatus.COMPLETED, actor,
                OrderStatusActorType.ADMIN, "Admin xác nhận hoàn tất và đã thu tiền COD");
        paymentRepository.save(payment);
        voucherService.applyForOrder(orderId);
        return response(orderRepository.save(order));
    }

    private void awardLoyaltyPoints(Order order, LocalDateTime completedAt) {
        if (Boolean.TRUE.equals(order.getLoyaltyPointsAwarded())) return;
        if (accountRepository == null) return;

        Account account = accountRepository.findByIdForUpdate(order.getAccount().getId())
                .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_NOT_FOUND));
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate deliveryDate = completedAt.atZone(zone).toLocalDate();
        LocalDateTime start = deliveryDate.atStartOfDay();
        LocalDateTime end = deliveryDate.plusDays(1).atStartOfDay();
        long dailyOrdinal = orderRepository
                .countByAccountIdAndLoyaltyPointsAwardedTrueAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
                        account.getId(), start, end) + 1;

        int earned = 10;
        if (dailyOrdinal == 5) earned += 30;
        if (dailyOrdinal == 10) earned += 50;
        int loyalty = Objects.requireNonNullElse(account.getLoyaltyPoints(), 0) + earned;
        account.setLoyaltyPoints(loyalty);
        account.setAvailablePoints(Objects.requireNonNullElse(account.getAvailablePoints(), 0) + earned);
        account.setMembershipRank(MembershipRank.fromPoints(loyalty));
        order.setCompletedAt(completedAt);
        order.setLoyaltyPointsAwarded(true);
        accountRepository.save(account);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminOrderPageResponse searchAdminOrders(Long orderId, String customer, String restaurant,
                                                     OrderStatus status, LocalDateTime createdFrom,
                                                     LocalDateTime createdTo, int page, int size) {
        validateSearch(page, size, createdFrom, createdTo);
        Specification<Order> specification = (root, query, cb) -> cb.conjunction();
        if (orderId != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("id"), orderId));
        }
        if (hasText(customer)) {
            String pattern = "%" + customer.trim().toLowerCase(Locale.ROOT) + "%";
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.join("account").get("username")), pattern),
                    cb.like(cb.lower(root.join("account").get("email")), pattern),
                    cb.like(cb.lower(root.join("account").get("phoneNumber")), pattern)));
        }
        if (hasText(restaurant)) {
            String pattern = "%" + restaurant.trim().toLowerCase(Locale.ROOT) + "%";
            specification = specification.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.join("restaurant").get("name")), pattern),
                    cb.like(cb.lower(root.join("restaurant").get("address")), pattern)));
        }
        if (status != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (createdFrom != null) {
            specification = specification.and((root, query, cb) ->
                    cb.greaterThanOrEqualTo(root.get("createdAt"), createdFrom));
        }
        if (createdTo != null) {
            specification = specification.and((root, query, cb) ->
                    cb.lessThanOrEqualTo(root.get("createdAt"), createdTo));
        }
        Page<Order> result = orderRepository.findAll(specification,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        if (result.hasContent()) {
            orderRepository.fetchItemsForOrders(result.getContent().stream().map(Order::getId).toList());
        }
        return AdminOrderPageResponse.builder()
                .content(result.getContent().stream().map(order -> adminResponse(order, false)).toList())
                .page(result.getNumber()).size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).sortBy("createdAt,id").sortDirection("DESC").build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminOrderResponse getAdminOrder(Long orderId) {
        Order order = orderRepository.findAdminDetailById(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        return adminResponse(order, true);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderStatusHistoryResponse> getStatusHistory(Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new AppException(ErrorCode.ORDER_NOT_FOUND);
        }
        return historyRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId).stream()
                .map(this::historyResponse).toList();
    }

    @Override
    @Transactional
    public OrderResponse cancelByAdmin(Long orderId, String reason) {
        if (!hasText(reason) || reason.trim().length() > 500) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        Account actor = currentAccountOrNull();
        Order order = lockedOrder(orderId);
        if (order.getStatus() == OrderStatus.COMPLETED || order.getStatus() == OrderStatus.CANCELLED
                || order.getStatus() == OrderStatus.DELIVERING
                || order.getStatus() == OrderStatus.ARRIVED) {
            throw new AppException(ErrorCode.ORDER_CANCELLATION_NOT_ALLOWED);
        }
        order.setCancellationDetail(reason.trim());
        cancel(order, OrderCancellationReason.CANCELLED_BY_ADMIN, actor,
                OrderStatusActorType.ADMIN, reason.trim());
        return response(order);
    }

    @Override
    @Transactional
    public int confirmEligibleAutoOrders() {
        LocalDateTime cutoff = now().minus(properties.getAutoConfirmationDelay());
        List<Order> eligible = orderRepository.findAutoPendingForUpdate(cutoff,
                PageRequest.of(0, properties.getSchedulerBatchSize()));
        int confirmed = 0;
        for (Order order : eligible) {
            if (order.getStatus() != OrderStatus.PENDING
                    || order.getConfirmationDeadline() != null
                    || order.getCreatedAt() == null
                    || order.getCreatedAt().isAfter(cutoff)) {
                continue;
            }
            Payment payment = latestPaymentForUpdate(order.getId());
            if (payment.getPaymentMethod() == PaymentMethod.VNPAY
                    && payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
                continue;
            }
            LocalDateTime confirmedAt = now();
            OrderStatus oldStatus = order.getStatus();
            order.setStatus(OrderStatus.CONFIRMED);
            order.setAcceptedAt(confirmedAt);
            order.setConfirmedAt(confirmedAt);
            order.setConfirmationSource(ConfirmationSource.AUTO);
            recordHistory(order, oldStatus, OrderStatus.CONFIRMED, null,
                    OrderStatusActorType.SYSTEM, "Hệ thống tự động xác nhận đơn hàng");
            orderRepository.save(order);
            confirmed++;
        }
        return confirmed;
    }

    @Override
    @Transactional
    public int cancelExpiredManualOrders() {
        LocalDateTime currentTime = now();
        List<Order> expired = orderRepository.findExpiredPendingForUpdate(currentTime,
                PageRequest.of(0, properties.getSchedulerBatchSize()));
        int cancelled = 0;
        for (Order order : expired) {
            if (order.getStatus() != OrderStatus.PENDING || order.getConfirmationDeadline() == null
                    || order.getConfirmationDeadline().isAfter(currentTime)) {
                continue;
            }
            cancel(order, OrderCancellationReason.CONFIRMATION_TIMEOUT,
                    null, OrderStatusActorType.SYSTEM,
                    "Nhà hàng không xác nhận đơn trong thời hạn cho phép");
            cancelled++;
        }
        return cancelled;
    }

    @Override
    @Transactional
    public int markExpiredPaymentsForReconciliation() {
        LocalDateTime cutoff = now().minus(properties.getPaymentPendingTimeout());
        List<Payment> expired = paymentRepository.findExpiredGatewayPaymentsForUpdate(cutoff,
                PageRequest.of(0, properties.getSchedulerBatchSize()));
        expired.forEach(payment -> {
            payment.setPaymentStatus(PaymentStatus.NEEDS_RECONCILIATION);
            payment.setPaymentMessage("Quá thời gian chờ IPN; cần đối soát với VNPay");
        });
        paymentRepository.saveAll(expired);
        return expired.size();
    }

    private void cancel(Order order, OrderCancellationReason reason, Account actor,
                        OrderStatusActorType actorType, String detail) {
        OrderStatus oldStatus = order.getStatus();
        List<Payment> payments = paymentRepository.findByOrderIdForUpdate(order.getId());
        boolean paid = payments.stream().anyMatch(p -> p.getPaymentStatus() == PaymentStatus.SUCCESS);
        boolean uncertain = payments.stream().anyMatch(p -> p.getPaymentStatus() == PaymentStatus.NEEDS_RECONCILIATION);
        payments.stream().filter(p -> p.getPaymentStatus() == PaymentStatus.PENDING)
                .forEach(p -> {
                    p.setPaymentStatus(PaymentStatus.CANCELLED);
                    p.setPaymentMessage("Đơn hàng đã bị hủy");
                });
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason(reason);
        order.setCancelledAt(now());
        order.setConfirmationDeadline(null);
        order.setRefundRequired(paid || uncertain);
        voucherService.releaseForOrder(order.getId());
        paymentRepository.saveAll(payments);
        recordHistory(order, oldStatus, OrderStatus.CANCELLED, actor, actorType, detail);
        orderRepository.save(order);
    }

    private void recordHistory(Order order, OrderStatus oldStatus, OrderStatus newStatus,
                               Account actor, OrderStatusActorType actorType, String reason) {
        LocalDateTime changedAt = now();
        historyRepository.save(OrderStatusHistory.builder().order(order).oldStatus(oldStatus)
                .newStatus(newStatus).actorAccount(actor).actorType(actorType)
                .changedAt(changedAt).reason(reason).build());
        publishOrderUpdate(order, changedAt);
    }

    private void publishOrderUpdate(Order order, LocalDateTime changedAt) {
        if (eventPublisher != null) {
            PaymentStatus paymentStatus = paymentRepository.findFirstByOrderIdOrderByIdDesc(order.getId())
                    .map(Payment::getPaymentStatus).orElse(null);
            eventPublisher.publishEvent(new OrderStatusChangedEvent(
                    OrderStatusChangedEvent.Type.STATUS_CHANGED,
                    order.getId(), order.getAccount().getId(), order.getStatus(), paymentStatus, changedAt));
        }
    }

    private void validateSearch(int page, int size, LocalDateTime from, LocalDateTime to) {
        if (page < 0 || size < 1 || size > 100 || (from != null && to != null && from.isAfter(to))) {
            throw new AppException(ErrorCode.ORDER_INVALID_SEARCH_REQUEST);
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private Order lockedOrder(Long id) {
        return orderRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
    }

    private Payment latestPaymentForUpdate(Long orderId) {
        return paymentRepository.findByOrderIdForUpdate(orderId).stream()
                .reduce((first, second) -> second)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }

    private Account currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account account)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return account;
    }

    private Account currentAccountOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof Account account ? account : null;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private OrderResponse response(Order order) {
        LocalDateTime estimatedDeliveryAt = estimatedDeliveryAt(order);
        List<OrderItemResponse> items = order.getItems().stream().map(item -> OrderItemResponse.builder()
                .id(item.getId()).menuItemId(item.getMenuItem().getId()).itemName(item.getItemName())
                .imageUrl(item.getImageUrl()).note(item.getNote())
                .unitPrice(item.getUnitPrice()).quantity(item.getQuantity()).lineTotal(item.getLineTotal()).build())
                .toList();
        return OrderResponse.builder()
                .id(order.getId()).restaurantId(order.getRestaurant().getId())
                .restaurantName(order.getRestaurant().getName())
                .shipperId(order.getShipper() == null ? null : order.getShipper().getId())
                .shipperName(order.getShipper() == null ? null : order.getShipper().getFullName())
                .shipperPhone(order.getShipper() == null ? null : order.getShipper().getPhoneNumber())
                .status(order.getStatus())
                .confirmationDeadline(order.getConfirmationDeadline())
                .cancellationDeadline(order.getCreatedAt() == null ? null
                        : order.getCreatedAt().plus(properties.getCustomerCancellationWindow()))
                .acceptedAt(order.getAcceptedAt())
                .confirmedAt(order.getConfirmedAt()).confirmationSource(order.getConfirmationSource())
                .cancellationReason(order.getCancellationReason()).cancelledAt(order.getCancelledAt())
                .cancellationCode(order.getCancellationCode()).cancellationDetail(order.getCancellationDetail())
                .refundRequired(order.getRefundRequired()).subtotal(order.getSubtotal())
                .deliveryFee(order.getDeliveryFee()).deliveryLatitude(order.getDeliveryLatitude())
                .deliveryLongitude(order.getDeliveryLongitude()).restaurantLatitude(order.getRestaurantLatitude())
                .restaurantLongitude(order.getRestaurantLongitude()).deliveryDistanceKm(order.getDeliveryDistanceKm())
                .estimatedDeliveryAt(estimatedDeliveryAt)
                .deliveryOverdue(isDeliveryOverdue(order, estimatedDeliveryAt))
                .deliveryRadiusKmSnapshot(order.getDeliveryRadiusKmSnapshot())
                .baseDeliveryFeeSnapshot(order.getBaseDeliveryFeeSnapshot())
                .baseDistanceKmSnapshot(order.getBaseDistanceKmSnapshot())
                .additionalFeePerKmSnapshot(order.getAdditionalFeePerKmSnapshot())
                .discountAmount(order.getDiscountAmount()).voucherId(order.getVoucherId())
                .voucherCode(order.getVoucherCode()).totalAmount(order.getTotalAmount())
                .recipientName(order.getRecipientName()).recipientPhone(order.getRecipientPhone())
                .deliveryAddress(order.getDeliveryAddress()).deliveryNote(order.getDeliveryNote())
                .items(items).createdAt(order.getCreatedAt()).updatedAt(order.getUpdatedAt()).build();
    }

    private LocalDateTime estimatedDeliveryAt(Order order) {
        if (order.getCreatedAt() == null || order.getDeliveryDistanceKm() == null) return null;
        long deliveryMinutes = order.getDeliveryDistanceKm()
                .multiply(BigDecimal.valueOf(15))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
        return order.getCreatedAt().plusMinutes(deliveryMinutes);
    }

    private boolean isDeliveryOverdue(Order order, LocalDateTime estimatedDeliveryAt) {
        if (estimatedDeliveryAt == null
                || order.getStatus() == OrderStatus.COMPLETED
                || order.getStatus() == OrderStatus.CANCELLED) return false;
        return now().isAfter(estimatedDeliveryAt.plusMinutes(20));
    }

    private AdminOrderResponse adminResponse(Order order, boolean includeHistory) {
        Account account = order.getAccount();
        Payment payment = paymentRepository.findFirstByOrderIdOrderByIdDesc(order.getId()).orElse(null);
        return AdminOrderResponse.builder().order(response(order)).accountId(account.getId())
                .username(account.getUsername()).email(account.getEmail()).phoneNumber(account.getPhoneNumber())
                .paymentMethod(payment == null ? null : payment.getPaymentMethod())
                .paymentStatus(payment == null ? null : payment.getPaymentStatus())
                .statusHistory(includeHistory
                        ? historyRepository.findByOrderIdOrderByChangedAtAscIdAsc(order.getId()).stream()
                        .map(this::historyResponse).toList()
                        : List.of())
                .build();
    }

    private OrderStatusHistoryResponse historyResponse(OrderStatusHistory history) {
        Account actor = history.getActorAccount();
        return OrderStatusHistoryResponse.builder().id(history.getId())
                .oldStatus(history.getOldStatus()).newStatus(history.getNewStatus())
                .actorAccountId(actor == null ? null : actor.getId())
                .actorUsername(actor == null ? null : actor.getUsername())
                .actorType(history.getActorType()).changedAt(history.getChangedAt())
                .reason(history.getReason()).build();
    }
}
