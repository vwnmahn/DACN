package com.example.dacn;

import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.repository.*;
import com.example.dacn.service.PaymentOperationStateService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentOperationStateServiceTest {
    @Mock PaymentRepository paymentRepository;
    @Mock OrderRepository orderRepository;
    @Mock PaymentReconciliationHistoryRepository reconciliationRepository;
    @Mock PaymentRefundRepository refundRepository;
    PaymentOperationStateService service;
    Payment payment;

    @BeforeEach void setUp() {
        service = new PaymentOperationStateService(paymentRepository, orderRepository,
                reconciliationRepository, refundRepository);
        payment = Payment.builder().id(1L).orderId(2L).paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.SUCCESS).amount(new BigDecimal("82500"))
                .gatewayTransactionId("123").transactionReference("FCA-1").build();
        lenient().when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));
        lenient().when(orderRepository.findByIdForUpdate(2L)).thenReturn(Optional.of(
                com.example.dacn.entity.Order.builder().id(2L).build()));
        lenient().when(paymentRepository.findByOrderIdForUpdate(2L)).thenReturn(List.of(payment));
        lenient().when(refundRepository.sumAmountByPaymentAndStatuses(eq(1L), anyCollection()))
                .thenReturn(BigDecimal.ZERO);
        lenient().when(refundRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(reconciliationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test void codRefundIsBlockedBeforeGatewayCall() {
        payment.setPaymentMethod(PaymentMethod.COD);
        assertThrows(AppException.class, () -> service.claimRefund(1L, request(null), 9L, "request"));
        verify(refundRepository, never()).save(any());
    }

    @Test void overPaymentRefundIsBlocked() {
        assertThrows(AppException.class, () -> service.claimRefund(1L,
                request(new BigDecimal("82501")), 9L, "request"));
        verify(refundRepository, never()).save(any());
    }

    @Test void partialRefundIsDeliberatelyBlocked() {
        assertThrows(AppException.class, () -> service.claimRefund(1L,
                request(new BigDecimal("10000")), 9L, "request"));
    }

    @Test void secondAdminCannotReconcileWhileFirstRequestIsProcessing() {
        payment.setPaymentStatus(PaymentStatus.NEEDS_RECONCILIATION);
        when(reconciliationRepository.existsByPaymentIdAndStatus(1L, PaymentReconciliationStatus.PROCESSING))
                .thenReturn(true);
        assertThrows(AppException.class, () -> service.claimReconciliation(1L, 10L, "request-2"));
        verify(reconciliationRepository, never()).save(any());
    }

    @Test void existingRefundIdempotencyKeyReturnsSameOperation() {
        PaymentRefund existing = PaymentRefund.builder().id(7L).payment(payment)
                .idempotencyKey("same-key").requestId("old").amount(payment.getAmount())
                .status(PaymentRefundStatus.UNKNOWN).actorAccountId(9L).reason("reason").build();
        when(refundRepository.findByIdempotencyKey("same-key")).thenReturn(Optional.of(existing));
        assertSame(existing, service.claimRefund(1L, request(null), 9L, "new"));
        verify(refundRepository, never()).save(any());
    }

    private PaymentRefundRequest request(BigDecimal amount) {
        return PaymentRefundRequest.builder().amount(amount).reason("Đơn đã hủy")
                .idempotencyKey("same-key").build();
    }
}
