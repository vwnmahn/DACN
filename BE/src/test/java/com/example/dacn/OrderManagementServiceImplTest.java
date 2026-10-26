package com.example.dacn;

import com.example.dacn.config.OrderManagementProperties;
import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.OrderStatusHistoryRepository;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.service.Impl.OrderManagementServiceImpl;
import com.example.dacn.service.VoucherService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.PageImpl;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderManagementServiceImplTest {
    @Mock OrderRepository orderRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock OrderStatusHistoryRepository historyRepository;
    @Mock VoucherService voucherService;
    private OrderManagementServiceImpl service;
    private Account owner;
    private Order order;
    private Payment payment;
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-12T05:00:00Z"),
            ZoneId.of("Asia/Ho_Chi_Minh"));

    @BeforeEach
    void setUp() {
        OrderManagementProperties properties = new OrderManagementProperties();
        service = new OrderManagementServiceImpl(orderRepository, paymentRepository, historyRepository, voucherService,
                properties, clock);
        owner = Account.builder().id(1L).role(Role.USER).build();
        Restaurant restaurant = Restaurant.builder().id(2L).name("FCA").build();
        order = Order.builder().id(3L).account(owner).restaurant(restaurant)
                .status(OrderStatus.PENDING)
                .createdAt(LocalDateTime.now(clock))
                .confirmationDeadline(LocalDateTime.now(clock).plusMinutes(10))
                .subtotal(BigDecimal.TEN).deliveryFee(BigDecimal.ZERO)
                .discountAmount(BigDecimal.ZERO).totalAmount(BigDecimal.TEN)
                .recipientName("A").recipientPhone("0900000000").deliveryAddress("HCM")
                .idempotencyKey("key").requestFingerprint("hash").items(new ArrayList<>()).build();
        payment = Payment.builder().id(4L).orderId(3L).paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING).amount(BigDecimal.TEN)
                .transactionReference("FCA-1").build();
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminConfirmsManualCodBeforeDeadline() {
        lockOrderAndPayment();
        var result = service.confirmByAdmin(3L);
        assertEquals(OrderStatus.CONFIRMED, result.getStatus());
        assertEquals(ConfirmationSource.MANUAL, result.getConfirmationSource());
        assertNotNull(result.getConfirmedAt());
        assertNull(result.getConfirmationDeadline());
    }

    @Test
    void manualVnPayWaitsForPaymentAfterAdminAcceptance() {
        payment.setPaymentMethod(PaymentMethod.VNPAY);
        lockOrderAndPayment();
        var result = service.confirmByAdmin(3L);
        assertEquals(OrderStatus.AWAITING_PAYMENT, result.getStatus());
        assertNull(result.getConfirmedAt());
    }

    @Test
    void cannotConfirmAtDeadline() {
        order.setConfirmationDeadline(LocalDateTime.now(clock));
        when(orderRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(order));
        AppException error = assertThrows(AppException.class, () -> service.confirmByAdmin(3L));
        assertEquals(ErrorCode.ORDER_CONFIRMATION_EXPIRED, error.getErrorCode());
        verifyNoInteractions(paymentRepository);
    }

    @Test
    void expiredBatchCancelsAndReleasesVoucherExactlyOncePerSelection() {
        order.setConfirmationDeadline(LocalDateTime.now(clock));
        when(orderRepository.findExpiredPendingForUpdate(any(), any())).thenReturn(List.of(order));
        when(paymentRepository.findByOrderIdForUpdate(3L)).thenReturn(List.of(payment));
        assertEquals(1, service.cancelExpiredManualOrders());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        assertEquals(OrderCancellationReason.CONFIRMATION_TIMEOUT, order.getCancellationReason());
        assertEquals(PaymentStatus.CANCELLED, payment.getPaymentStatus());
        verify(voucherService).releaseForOrder(3L);
    }

    @Test
    void autoOrderIsConfirmedAfterFifteenSeconds() {
        order.setConfirmationDeadline(null);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(15));
        when(orderRepository.findAutoPendingForUpdate(any(), any())).thenReturn(List.of(order));
        when(paymentRepository.findByOrderIdForUpdate(3L)).thenReturn(List.of(payment));

        assertEquals(1, service.confirmEligibleAutoOrders());
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        assertEquals(ConfirmationSource.AUTO, order.getConfirmationSource());
        assertEquals(LocalDateTime.now(clock), order.getAcceptedAt());
        assertEquals(LocalDateTime.now(clock), order.getConfirmedAt());
    }

    @Test
    void autoOrderIsNotConfirmedBeforeFifteenSeconds() {
        order.setConfirmationDeadline(null);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(14));
        when(orderRepository.findAutoPendingForUpdate(any(), any())).thenReturn(List.of(order));

        assertEquals(0, service.confirmEligibleAutoOrders());
        assertEquals(OrderStatus.PENDING, order.getStatus());
        verifyNoInteractions(paymentRepository);
    }

    @Test
    void autoVnPayIsNotConfirmedBeforeSuccessfulPayment() {
        order.setConfirmationDeadline(null);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(15));
        payment.setPaymentMethod(PaymentMethod.VNPAY);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        when(orderRepository.findAutoPendingForUpdate(any(), any())).thenReturn(List.of(order));
        when(paymentRepository.findByOrderIdForUpdate(3L)).thenReturn(List.of(payment));

        assertEquals(0, service.confirmEligibleAutoOrders());
        assertEquals(OrderStatus.PENDING, order.getStatus());
        assertNull(order.getConfirmedAt());
    }

    @Test
    void customerCanCancelManualOrderWithinFifteenSeconds() {
        authenticate(owner);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(14));
        lockOrderAndPayment();

        OrderResponse result = service.cancelMyOrder(3L);

        assertEquals(OrderStatus.CANCELLED, result.getStatus());
        assertEquals(OrderCancellationReason.CANCELLED_BY_USER, result.getCancellationReason());
    }

    @Test
    void customerCannotCancelManualOrderAtOrAfterFifteenSeconds() {
        authenticate(owner);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(15));
        when(orderRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(order));

        AppException error = assertThrows(AppException.class, () -> service.cancelMyOrder(3L));

        assertEquals(ErrorCode.ORDER_CANCELLATION_NOT_ALLOWED, error.getErrorCode());
        verifyNoInteractions(paymentRepository);
    }

    @Test
    void schedulerDoesNotOverwriteOrderWhoseStatusAlreadyChanged() {
        order.setConfirmationDeadline(null);
        order.setCreatedAt(LocalDateTime.now(clock).minusMinutes(1));
        order.setStatus(OrderStatus.CONFIRMED);
        when(orderRepository.findAutoPendingForUpdate(any(), any())).thenReturn(List.of(order));

        assertEquals(0, service.confirmEligibleAutoOrders());
        verifyNoInteractions(paymentRepository);
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void timeoutSchedulerDoesNotCancelConfirmedOrder() {
        order.setStatus(OrderStatus.CONFIRMED);
        order.setConfirmationDeadline(LocalDateTime.now(clock).minusSeconds(1));
        when(orderRepository.findExpiredPendingForUpdate(any(), any())).thenReturn(List.of(order));

        assertEquals(0, service.cancelExpiredManualOrders());
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verifyNoInteractions(paymentRepository);
    }

    @Test
    void customerCannotCancelOrderAfterCancellationWindow() {
        payment.setPaymentMethod(PaymentMethod.VNPAY);
        payment.setPaymentStatus(PaymentStatus.SUCCESS);
        order.setCreatedAt(LocalDateTime.now(clock).minusSeconds(16));
        authenticate(owner);
        when(orderRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(order));
        AppException error = assertThrows(AppException.class, () -> service.cancelMyOrder(3L));
        assertEquals(ErrorCode.ORDER_CANCELLATION_NOT_ALLOWED, error.getErrorCode());
        verify(voucherService, never()).releaseForOrder(anyLong());
    }

    @Test
    void codCompletionRequiresCollectionConfirmation() {
        order.setStatus(OrderStatus.ARRIVED);
        AppException error = assertThrows(AppException.class,
                () -> service.completeCodByAdmin(3L, false));
        assertEquals(ErrorCode.COD_COLLECTION_REQUIRED, error.getErrorCode());
        verifyNoInteractions(paymentRepository);
    }

    @Test
    void codCompletionMarksPaymentSuccessAndAppliesVoucher() {
        order.setStatus(OrderStatus.ARRIVED);
        lockOrderAndPayment();
        var result = service.completeCodByAdmin(3L, true);
        assertEquals(OrderStatus.COMPLETED, result.getStatus());
        assertEquals(PaymentStatus.SUCCESS, payment.getPaymentStatus());
        assertNotNull(payment.getPaidAt());
        verify(voucherService).applyForOrder(3L);
    }

    @Test
    void expiredGatewayPaymentIsMarkedForReconciliationNotFailed() {
        payment.setPaymentMethod(PaymentMethod.VNPAY);
        payment.setPaymentUrl("https://sandbox/payment");
        when(paymentRepository.findExpiredGatewayPaymentsForUpdate(any(), any()))
                .thenReturn(List.of(payment));

        assertEquals(1, service.markExpiredPaymentsForReconciliation());
        assertEquals(PaymentStatus.NEEDS_RECONCILIATION, payment.getPaymentStatus());
        assertTrue(payment.getPaymentMessage().contains("đối soát"));
        verify(paymentRepository).saveAll(List.of(payment));
    }

    @Test
    void adminCancellationRequiresCancelableStateAndMarksPaidOrderForRefundReview() {
        Account admin = Account.builder().id(9L).username("admin").role(Role.ADMIN).build();
        authenticate(admin);
        payment.setPaymentStatus(PaymentStatus.SUCCESS);
        lockOrderAndPayment();

        OrderResponse result = service.cancelByAdmin(3L, "Nhà hàng không thể phục vụ");

        assertEquals(OrderStatus.CANCELLED, result.getStatus());
        assertTrue(result.getRefundRequired());
        assertEquals(PaymentStatus.SUCCESS, payment.getPaymentStatus());
        verify(voucherService).releaseForOrder(3L);
        ArgumentCaptor<OrderStatusHistory> history = ArgumentCaptor.forClass(OrderStatusHistory.class);
        verify(historyRepository).save(history.capture());
        assertEquals(admin, history.getValue().getActorAccount());
        assertEquals("Nhà hàng không thể phục vụ", history.getValue().getReason());
    }

    @Test
    void rejectsBackwardOrDuplicateAdminTransition() {
        authenticate(Account.builder().id(9L).role(Role.ADMIN).build());
        order.setStatus(OrderStatus.PREPARING);
        when(orderRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(order));

        AppException error = assertThrows(AppException.class,
                () -> service.updateStatusByAdmin(3L, OrderStatus.CONFIRMED));

        assertEquals(ErrorCode.ORDER_INVALID_TRANSITION, error.getErrorCode());
        verifyNoInteractions(paymentRepository);
        verifyNoInteractions(historyRepository);
    }

    @Test
    void adminPageBulkLoadsItemsOnceAndKeepsPaginationWithoutDuplicates() {
        MenuItem menuItem = MenuItem.builder().id(8L).build();
        OrderItem first = OrderItem.builder().id(10L).order(order).menuItem(menuItem)
                .itemName("Món 1").unitPrice(BigDecimal.TEN).quantity(1).lineTotal(BigDecimal.TEN).build();
        OrderItem second = OrderItem.builder().id(11L).order(order).menuItem(menuItem)
                .itemName("Món 2").unitPrice(BigDecimal.ONE).quantity(2).lineTotal(BigDecimal.valueOf(2)).build();
        order.setItems(new ArrayList<>(List.of(first, second)));
        when(orderRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order), org.springframework.data.domain.PageRequest.of(0, 20), 41));
        when(orderRepository.fetchItemsForOrders(List.of(3L))).thenReturn(List.of(order));

        var result = service.searchAdminOrders(null, null, null, null, null, null, 0, 20);

        assertEquals(1, result.getContent().size());
        assertEquals(2, result.getContent().getFirst().getOrder().getItems().size());
        assertEquals(41, result.getTotalElements());
        assertEquals(3, result.getTotalPages());
        verify(orderRepository, times(1)).fetchItemsForOrders(List.of(3L));
    }

    private void lockOrderAndPayment() {
        when(orderRepository.findByIdForUpdate(3L)).thenReturn(Optional.of(order));
        when(paymentRepository.findByOrderIdForUpdate(3L)).thenReturn(List.of(payment));
    }

    private void authenticate(Account account) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(account, null, List.of()));
    }
}
