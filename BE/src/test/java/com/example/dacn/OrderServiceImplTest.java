package com.example.dacn;

import com.example.dacn.dto.request.CreateOrderRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.*;
import com.example.dacn.service.Impl.OrderServiceImpl;
import com.example.dacn.service.VoucherService;
import com.example.dacn.service.VoucherReservationResult;
import com.example.dacn.service.DeliveryDistanceService;
import com.example.dacn.service.DeliveryCalculation;
import com.example.dacn.config.OrderManagementProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {
    @Mock OrderRepository orderRepository;
    @Mock AccountRepository accountRepository;
    @Mock RestaurantRepository restaurantRepository;
    @Mock MenuItemRepository menuItemRepository;
    @Mock VoucherService voucherService;
    @Mock DeliveryDistanceService deliveryDistanceService;
    OrderServiceImpl service;

    private Account account;
    private Restaurant restaurant;

    @BeforeEach
    void setUp() {
        service = new OrderServiceImpl(orderRepository, accountRepository, restaurantRepository,
                menuItemRepository, Clock.fixed(Instant.parse("2026-10-12T05:00:00Z"),
                ZoneId.of("Asia/Ho_Chi_Minh")), voucherService, deliveryDistanceService,
                new OrderManagementProperties());
        account = Account.builder().id(10L).role(Role.USER).locked(false).build();
        restaurant = Restaurant.builder().id(20L).name("FCA")
                .active(true).openingTime(LocalTime.of(8, 0)).closingTime(LocalTime.of(22, 0))
                .deliveryFee(new BigDecimal("15000")).deliveryRadiusKm(6.0)
                .latitude(new BigDecimal("10.77")).longitude(new BigDecimal("106.69"))
                .baseDistanceKm(new BigDecimal("2")).additionalFeePerKm(new BigDecimal("5000")).build();
        lenient().when(deliveryDistanceService.calculateDelivery(eq(restaurant), any(), any()))
                .thenReturn(new DeliveryCalculation(new BigDecimal("3.000"), new BigDecimal("6.000"), new BigDecimal("20000")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(account, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void calculatesTotalsAndSnapshotsMenuItemData() {
        CreateOrderRequest request = validRequest("key-1", 2);
        MenuItem menuItem = MenuItem.builder().id(30L).restaurant(restaurant)
                .name("Cơm gà").price(new BigDecimal("45000"))
                .active(true).available(true).build();
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "key-1")).thenReturn(Optional.empty());
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.findById(30L)).thenReturn(Optional.of(menuItem));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createOrder(request);

        assertEquals(new BigDecimal("90000"), response.getSubtotal());
        assertEquals(new BigDecimal("110000"), response.getTotalAmount());
        assertEquals(OrderStatus.PENDING, response.getStatus());
        assertEquals(LocalDateTime.now(Clock.fixed(Instant.parse("2026-10-12T05:00:00Z"),
                ZoneId.of("Asia/Ho_Chi_Minh"))).plusSeconds(60), response.getConfirmationDeadline());
        assertEquals("Cơm gà", response.getItems().getFirst().getItemName());
        assertEquals(new BigDecimal("45000"), response.getItems().getFirst().getUnitPrice());

        menuItem.setName("Tên mới");
        menuItem.setPrice(new BigDecimal("99000"));
        assertEquals("Cơm gà", response.getItems().getFirst().getItemName());
        assertEquals(new BigDecimal("45000"), response.getItems().getFirst().getUnitPrice());
    }

    @Test
    void autoCodOrderStartsPendingWithoutManualDeadline() {
        restaurant.setOrderConfirmationMode(OrderConfirmationMode.AUTO);
        CreateOrderRequest request = validRequest("auto-key", 1);
        request.setPaymentMethod(PaymentMethod.COD);
        MenuItem menuItem = MenuItem.builder().id(30L).restaurant(restaurant)
                .name("Món").price(BigDecimal.TEN).active(true).available(true).build();
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "auto-key")).thenReturn(Optional.empty());
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.findById(30L)).thenReturn(Optional.of(menuItem));
        when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));

        var response = service.createOrder(request);

        assertEquals(OrderStatus.PENDING, response.getStatus());
        assertNull(response.getConfirmationSource());
        assertNull(response.getConfirmedAt());
        assertNull(response.getConfirmationDeadline());
    }

    @Test
    void returnsExistingOrderForSameIdempotentRequest() {
        CreateOrderRequest request = validRequest("same-key", 1);
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));

        Order existing = existingOrder(request, "same-key");
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "same-key"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(existing));
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        MenuItem menuItem = MenuItem.builder().id(30L).restaurant(restaurant).name("Món")
                .price(new BigDecimal("10000")).active(true).available(true).build();
        when(menuItemRepository.findById(30L)).thenReturn(Optional.of(menuItem));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            existing.setRequestFingerprint(saved.getRequestFingerprint());
            existing.setItems(saved.getItems());
            existing.setSubtotal(saved.getSubtotal());
            existing.setTotalAmount(saved.getTotalAmount());
            return existing;
        });

        service.createOrder(request);
        var second = service.createOrder(request);

        assertEquals(99L, second.getId());
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    void cannotReadAnotherAccountsOrder() {
        when(orderRepository.findByIdAndAccountId(99L, 10L)).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> service.getMyOrder(99L));
        assertEquals(ErrorCode.ORDER_NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void rejectsInvalidQuantity() {
        CreateOrderRequest request = validRequest("key", 0);
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));

        AppException exception = assertThrows(AppException.class, () -> service.createOrder(request));
        assertEquals(ErrorCode.ORDER_INVALID_QUANTITY, exception.getErrorCode());
    }

    @Test
    void rejectsMissingMenuItem() {
        CreateOrderRequest request = validRequest("missing-item", 1);
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "missing-item"))
                .thenReturn(Optional.empty());
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.findById(30L)).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> service.createOrder(request));
        assertEquals(ErrorCode.MENU_ITEM_NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void rejectsClosedRestaurant() {
        restaurant.setOpeningTime(LocalTime.of(13, 0));
        restaurant.setClosingTime(LocalTime.of(22, 0));
        CreateOrderRequest request = validRequest("closed", 1);
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "closed"))
                .thenReturn(Optional.empty());
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));

        AppException exception = assertThrows(AppException.class, () -> service.createOrder(request));
        assertEquals(ErrorCode.RESTAURANT_CLOSED, exception.getErrorCode());
        verifyNoInteractions(menuItemRepository);
    }

    @Test
    void reservesVoucherAndCalculatesDiscountedTotal() {
        CreateOrderRequest request = validRequest("voucher-key", 2);
        request.setVoucherCode(" save10 ");
        MenuItem menuItem = MenuItem.builder().id(30L).restaurant(restaurant).name("Cơm gà")
                .price(new BigDecimal("45000")).active(true).available(true).build();
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "voucher-key")).thenReturn(Optional.empty());
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.findById(30L)).thenReturn(Optional.of(menuItem));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0); if (saved.getId() == null) saved.setId(99L); return saved;
        });
        when(voucherService.reserveForOrder(" save10 ", 10L, 99L, 20L, new BigDecimal("90000")))
                .thenReturn(new VoucherReservationResult(5L, "SAVE10", new BigDecimal("10000")));

        var response = service.createOrder(request);

        assertEquals(5L, response.getVoucherId());
        assertEquals("SAVE10", response.getVoucherCode());
        assertEquals(new BigDecimal("10000"), response.getDiscountAmount());
        assertEquals(new BigDecimal("100000"), response.getTotalAmount());
    }

    @Test
    void sameIdempotencyKeyWithChangedGpsConflicts() {
        CreateOrderRequest first = validRequest("gps-key", 1);
        Order existing = existingOrder(first, "gps-key");
        when(accountRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(account));
        when(orderRepository.findByAccountIdAndIdempotencyKey(10L, "gps-key"))
                .thenReturn(Optional.empty()).thenReturn(Optional.of(existing));
        when(restaurantRepository.findById(20L)).thenReturn(Optional.of(restaurant));
        MenuItem item = MenuItem.builder().id(30L).restaurant(restaurant).name("Món")
                .price(new BigDecimal("10000")).active(true).available(true).build();
        when(menuItemRepository.findById(30L)).thenReturn(Optional.of(item));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0); saved.setId(99L);
            existing.setRequestFingerprint(saved.getRequestFingerprint()); return saved;
        });
        service.createOrder(first);
        CreateOrderRequest changed = validRequest("gps-key", 1);
        changed.setDeliveryLatitude(new BigDecimal("10.7900000"));

        AppException e = assertThrows(AppException.class, () -> service.createOrder(changed));
        assertEquals(ErrorCode.ORDER_IDEMPOTENCY_CONFLICT, e.getErrorCode());
    }

    @Test
    void enforcesOrderLifecycleTransitions() {
        assertTrue(OrderStatus.PENDING.canTransitionTo(OrderStatus.CONFIRMED));
        assertTrue(OrderStatus.PENDING.canTransitionTo(OrderStatus.CANCELLED));
        assertFalse(OrderStatus.PENDING.canTransitionTo(OrderStatus.COMPLETED));
        assertTrue(OrderStatus.DELIVERING.canTransitionTo(OrderStatus.ARRIVED));
        assertFalse(OrderStatus.DELIVERING.canTransitionTo(OrderStatus.COMPLETED));
        assertTrue(OrderStatus.ARRIVED.canTransitionTo(OrderStatus.COMPLETED));
        assertFalse(OrderStatus.COMPLETED.canTransitionTo(OrderStatus.CANCELLED));
        assertFalse(OrderStatus.CANCELLED.canTransitionTo(OrderStatus.CONFIRMED));
    }

    private CreateOrderRequest validRequest(String key, int quantity) {
        CreateOrderRequest request = new CreateOrderRequest();
        request.setRestaurantId(20L);
        request.setIdempotencyKey(key);
        request.setRecipientName("Nguyễn Văn A");
        request.setRecipientPhone("0901234567");
        request.setDeliveryAddress("1 Đường FCA");
        request.setDeliveryLatitude(new BigDecimal("10.78"));
        request.setDeliveryLongitude(new BigDecimal("106.70"));
        CreateOrderRequest.Item item = new CreateOrderRequest.Item();
        item.setMenuItemId(30L);
        item.setQuantity(quantity);
        request.setItems(List.of(item));
        return request;
    }

    private Order existingOrder(CreateOrderRequest request, String key) {
        return Order.builder().id(99L).account(account).restaurant(restaurant)
                .status(OrderStatus.PENDING).subtotal(BigDecimal.ZERO)
                .deliveryFee(restaurant.getDeliveryFee()).discountAmount(BigDecimal.ZERO)
                .totalAmount(restaurant.getDeliveryFee()).recipientName(request.getRecipientName())
                .recipientPhone(request.getRecipientPhone()).deliveryAddress(request.getDeliveryAddress())
                .idempotencyKey(key).requestFingerprint("pending").build();
    }
}
