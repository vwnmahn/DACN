package com.example.dacn;

import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.Impl.PaymentServiceImpl;
import com.example.dacn.service.VoucherService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {
    @Mock PaymentRepository paymentRepository;
    @Mock OrderRepository orderRepository;
    @Mock OrderStatusHistoryRepository historyRepository;
    @Mock VoucherService voucherService;
    @InjectMocks PaymentServiceImpl service;
    private Account account;

    @BeforeEach
    void setUp() {
        account = Account.builder().id(1L).role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(account, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createsPaymentUsingOrderAmount() {
        Order order = order(OrderStatus.PENDING, account, "125000.00");
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(paymentRepository.findByOrderIdForUpdate(10L)).thenReturn(List.of());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Payment result = service.createPendingPayment(10L, PaymentMethod.VNPAY);

        assertEquals(new BigDecimal("125000.00"), result.getAmount());
        assertEquals(10L, result.getOrderId());
    }

    @Test
    void rejectsMissingOrder() {
        when(orderRepository.findByIdForUpdate(999L)).thenReturn(Optional.empty());
        AppException exception = assertThrows(AppException.class,
                () -> service.createPendingPayment(999L, PaymentMethod.VNPAY));
        assertEquals(ErrorCode.ORDER_NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void hidesOrderOwnedByAnotherAccount() {
        Account other = Account.builder().id(2L).build();
        when(orderRepository.findByIdForUpdate(10L))
                .thenReturn(Optional.of(order(OrderStatus.PENDING, other, "1000.00")));
        AppException exception = assertThrows(AppException.class,
                () -> service.createPendingPayment(10L, PaymentMethod.VNPAY));
        assertEquals(ErrorCode.ORDER_NOT_FOUND, exception.getErrorCode());
    }

    @Test
    void rejectsCancelledOrder() {
        when(orderRepository.findByIdForUpdate(10L))
                .thenReturn(Optional.of(order(OrderStatus.CANCELLED, account, "1000.00")));
        AppException exception = assertThrows(AppException.class,
                () -> service.createPendingPayment(10L, PaymentMethod.VNPAY));
        assertEquals(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE, exception.getErrorCode());
    }

    @Test
    void paymentStatusHidesAnotherUsersOrder() {
        Account other = Account.builder().id(2L).role(Role.USER).build();
        when(orderRepository.findById(10L))
                .thenReturn(Optional.of(order(OrderStatus.PENDING, other, "1000.00")));

        AppException exception = assertThrows(AppException.class,
                () -> service.getStatusForCurrentUser(10L));

        assertEquals(ErrorCode.ORDER_NOT_FOUND, exception.getErrorCode());
        verify(paymentRepository, never()).findFirstByOrderIdOrderByIdDesc(anyLong());
    }

    @Test
    void ownerCanQueryPaymentStatus() {
        Order ownOrder = order(OrderStatus.AWAITING_PAYMENT, account, "1000.00");
        Payment payment = Payment.builder().id(11L).orderId(10L).paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.PENDING).amount(new BigDecimal("1000.00"))
                .transactionReference("FCA-STATUS").build();
        when(orderRepository.findById(10L)).thenReturn(Optional.of(ownOrder));
        when(paymentRepository.findFirstByOrderIdOrderByIdDesc(10L)).thenReturn(Optional.of(payment));

        var result = service.getStatusForCurrentUser(10L);

        assertEquals(PaymentStatus.PENDING, result.getPaymentStatus());
        assertEquals("FCA-STATUS", result.getTransactionReference());
    }

    private Order order(OrderStatus status, Account owner, String amount) {
        return Order.builder().id(10L).account(owner).status(status)
                .totalAmount(new BigDecimal(amount)).build();
    }
}
