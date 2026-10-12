package com.example.dacn;

import com.example.dacn.config.VnPayConfig;
import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.gateway.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.*;
import com.example.dacn.service.Impl.PaymentOperationsServiceImpl;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentOperationsServiceImplTest {
    @Mock PaymentService paymentService;
    @Mock PaymentRepository paymentRepository;
    @Mock PaymentRefundRepository refundRepository;
    @Mock PaymentOperationStateService stateService;
    @Mock VnPayTransactionGateway gateway;
    private PaymentOperationsServiceImpl service;
    private Payment payment;
    private PaymentReconciliationHistory history;
    private Account admin;

    @BeforeEach
    void setUp() {
        VnPayConfig config = new VnPayConfig();
        config.setTmnCode("TESTCODE");
        service = new PaymentOperationsServiceImpl(paymentService, paymentRepository, refundRepository,
                stateService, gateway, config);
        admin = Account.builder().id(9L).username("admin").role(Role.ADMIN).build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null,
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        payment = Payment.builder().id(1L).orderId(2L).paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.NEEDS_RECONCILIATION).amount(new BigDecimal("82500"))
                .transactionReference("FCA-REF").gatewayTransactionId("123456")
                .createdAt(LocalDateTime.now()).build();
        history = PaymentReconciliationHistory.builder().id(3L).payment(payment)
                .requestId("request").actorAccountId(9L).status(PaymentReconciliationStatus.PROCESSING).build();
        lenient().when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void reconciliationSuccessRequiresVerifiedGatewayEvidence() {
        when(stateService.claimReconciliation(eq(1L), eq(9L), anyString())).thenReturn(history);
        when(gateway.query(eq(payment), anyString(), anyString())).thenReturn(result(true, "00", "00", "8250000"));
        when(stateService.finishReconciliation(eq(3L), any(), eq(PaymentReconciliationStatus.SUCCEEDED), any()))
                .thenAnswer(inv -> { history.setStatus(inv.getArgument(2)); return history; });
        assertEquals(PaymentReconciliationStatus.SUCCEEDED, service.reconcile(1L, "127.0.0.1").getReconciliationStatus());
        verify(paymentService).confirmPaymentSuccess("FCA-REF", "123456");
    }

    @Test void invalidSignatureNeverConfirmsPayment() {
        when(stateService.claimReconciliation(eq(1L), eq(9L), anyString())).thenReturn(history);
        when(gateway.query(eq(payment), anyString(), anyString())).thenReturn(result(false, "00", "00", "8250000"));
        assertThrows(AppException.class, () -> service.reconcile(1L, "127.0.0.1"));
        verify(paymentService, never()).confirmPaymentSuccess(anyString(), anyString());
        verify(stateService).finishReconciliation(eq(3L), any(), eq(PaymentReconciliationStatus.FAILED), anyString());
    }

    @Test void amountMismatchNeverConfirmsPayment() {
        when(stateService.claimReconciliation(eq(1L), eq(9L), anyString())).thenReturn(history);
        when(gateway.query(eq(payment), anyString(), anyString())).thenReturn(result(true, "00", "00", "100"));
        assertThrows(AppException.class, () -> service.reconcile(1L, "127.0.0.1"));
        verify(paymentService, never()).confirmPaymentSuccess(anyString(), anyString());
    }

    @Test void timeoutIsRecordedUnknownAndNotRetried() {
        when(stateService.claimReconciliation(eq(1L), eq(9L), anyString())).thenReturn(history);
        when(gateway.query(eq(payment), anyString(), anyString())).thenThrow(new RuntimeException("timeout"));
        assertThrows(AppException.class, () -> service.reconcile(1L, "127.0.0.1"));
        verify(stateService).finishReconciliation(3L, null, PaymentReconciliationStatus.UNKNOWN,
                "Không xác định được kết quả QueryDR");
    }

    @Test void failedTransactionIsNotMarkedSuccess() {
        when(stateService.claimReconciliation(eq(1L), eq(9L), anyString())).thenReturn(history);
        when(gateway.query(eq(payment), anyString(), anyString())).thenReturn(result(true, "00", "02", "8250000"));
        when(stateService.finishReconciliation(eq(3L), any(), eq(PaymentReconciliationStatus.FAILED), any()))
                .thenAnswer(inv -> { history.setStatus(inv.getArgument(2)); return history; });
        service.reconcile(1L, "127.0.0.1");
        verify(paymentService).confirmPaymentFailed(eq("FCA-REF"), anyString());
        verify(paymentService, never()).confirmPaymentSuccess(anyString(), anyString());
    }

    @Test void refundOnlyBecomesSucceededAfterVerifiedFinalStatus() {
        PaymentRefund refund = refund(PaymentRefundStatus.PROCESSING, "pending");
        when(stateService.claimRefund(eq(1L), any(), eq(9L), anyString())).thenAnswer(inv -> {
            refund.setRequestId(inv.getArgument(3)); return refund;
        });
        when(gateway.refund(eq(payment), any(), anyString(), eq("admin9"), anyString(), anyString()))
                .thenReturn(refundResult(true, "00", "00", "8250000"));
        when(stateService.finishRefund(eq(4L), any(), eq(PaymentRefundStatus.SUCCEEDED), any()))
                .thenAnswer(inv -> { refund.setStatus(inv.getArgument(2)); return refund; });
        assertEquals(PaymentRefundStatus.SUCCEEDED,
                service.refund(1L, request("key-1"), "127.0.0.1").getStatus());
    }

    @Test void refundProcessingResponseDoesNotMarkRefunded() {
        PaymentRefund refund = refund(PaymentRefundStatus.PROCESSING, "pending");
        when(stateService.claimRefund(eq(1L), any(), eq(9L), anyString())).thenAnswer(inv -> {
            refund.setRequestId(inv.getArgument(3)); return refund;
        });
        when(gateway.refund(any(), any(), any(), any(), any(), any()))
                .thenReturn(refundResult(true, "00", "05", "8250000"));
        when(stateService.finishRefund(eq(4L), any(), eq(PaymentRefundStatus.PROCESSING), any()))
                .thenReturn(refund);
        service.refund(1L, request("key-2"), "127.0.0.1");
        verify(stateService, never()).finishRefund(eq(4L), any(), eq(PaymentRefundStatus.SUCCEEDED), any());
    }

    @Test void duplicateRefundIdempotencyDoesNotCallGatewayAgain() {
        PaymentRefund existing = refund(PaymentRefundStatus.UNKNOWN, "old-request");
        when(stateService.claimRefund(eq(1L), any(), eq(9L), anyString())).thenReturn(existing);
        assertEquals(PaymentRefundStatus.UNKNOWN,
                service.refund(1L, request("same-key"), "127.0.0.1").getStatus());
        verifyNoInteractions(gateway);
    }

    private PaymentRefundRequest request(String key) {
        return PaymentRefundRequest.builder().idempotencyKey(key).reason("Đơn bị hủy").build();
    }
    private PaymentRefund refund(PaymentRefundStatus status, String requestId) {
        return PaymentRefund.builder().id(4L).payment(payment).amount(payment.getAmount()).status(status)
                .requestId(requestId).idempotencyKey("key").actorAccountId(9L).reason("Đơn bị hủy").build();
    }
    private VnPayTransactionResult result(boolean valid, String response, String status, String amount) {
        return VnPayTransactionResult.builder().signatureValid(valid).command("querydr")
                .tmnCode("TESTCODE").transactionReference("FCA-REF").amount(amount)
                .responseCode(response).transactionStatus(status).transactionNo("123456")
                .transactionType("02").message("result").build();
    }
    private VnPayTransactionResult refundResult(boolean valid, String response, String status, String amount) {
        VnPayTransactionResult result = result(valid, response, status, amount);
        result.setCommand("refund");
        return result;
    }
}
