package com.example.dacn.service;

import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.gateway.VnPayTransactionResult;
import com.example.dacn.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PaymentOperationStateService {
    private static final Set<PaymentRefundStatus> RESERVED_REFUNDS = EnumSet.of(
            PaymentRefundStatus.REQUESTED, PaymentRefundStatus.PROCESSING,
            PaymentRefundStatus.SUCCEEDED, PaymentRefundStatus.UNKNOWN);
    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final PaymentReconciliationHistoryRepository reconciliationRepository;
    private final PaymentRefundRepository refundRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentReconciliationHistory claimReconciliation(Long paymentId, Long actorId, String requestId) {
        Payment payment = lockedPayment(paymentId);
        boolean activeRefund = refundRepository.existsByPaymentIdAndStatusIn(paymentId, RESERVED_REFUNDS);
        if (payment.getPaymentMethod() != PaymentMethod.VNPAY
                || (payment.getPaymentStatus() != PaymentStatus.NEEDS_RECONCILIATION && !activeRefund)) {
            throw new AppException(ErrorCode.PAYMENT_RECONCILIATION_NOT_ALLOWED);
        }
        if (reconciliationRepository.existsByPaymentIdAndStatus(paymentId, PaymentReconciliationStatus.PROCESSING)) {
            throw new AppException(ErrorCode.PAYMENT_RECONCILIATION_IN_PROGRESS);
        }
        return reconciliationRepository.save(PaymentReconciliationHistory.builder()
                .payment(payment).requestId(requestId).actorAccountId(actorId)
                .status(PaymentReconciliationStatus.PROCESSING).build());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentReconciliationHistory finishReconciliation(Long historyId, VnPayTransactionResult result,
                                                               PaymentReconciliationStatus status, String message) {
        PaymentReconciliationHistory history = reconciliationRepository.findById(historyId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_RECONCILIATION_NOT_ALLOWED));
        history.setStatus(status);
        history.setResponseCode(result == null ? null : result.getResponseCode());
        history.setTransactionStatus(result == null ? null : result.getTransactionStatus());
        history.setGatewayTransactionId(result == null ? null : result.getTransactionNo());
        history.setMessage(truncate(message));
        return reconciliationRepository.save(history);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentRefund claimRefund(Long paymentId, PaymentRefundRequest request, Long actorId, String requestId) {
        Optional<PaymentRefund> replay = refundRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
        if (replay.isPresent()) {
            if (!replay.get().getPayment().getId().equals(paymentId))
                throw new AppException(ErrorCode.PAYMENT_REFUND_IDEMPOTENCY_REQUIRED);
            return replay.get();
        }
        Payment payment = lockedPayment(paymentId);
        // Re-check after acquiring the payment/order lock so concurrent requests with the
        // same key return the first operation instead of creating or sending another refund.
        replay = refundRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
        if (replay.isPresent()) {
            if (!replay.get().getPayment().getId().equals(paymentId))
                throw new AppException(ErrorCode.PAYMENT_REFUND_IDEMPOTENCY_REQUIRED);
            return replay.get();
        }
        if (payment.getPaymentMethod() != PaymentMethod.VNPAY || payment.getPaymentStatus() != PaymentStatus.SUCCESS
                || payment.getGatewayTransactionId() == null || payment.getGatewayTransactionId().isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_REFUND_NOT_ALLOWED);
        }
        BigDecimal amount = request.getAmount() == null ? payment.getAmount() : request.getAmount();
        if (amount.compareTo(payment.getAmount()) != 0) {
            if (amount.signum() <= 0) throw new AppException(ErrorCode.PAYMENT_REFUND_AMOUNT_INVALID);
            if (amount.compareTo(payment.getAmount()) > 0)
                throw new AppException(ErrorCode.PAYMENT_REFUND_EXCEEDS_PAID_AMOUNT);
            throw new AppException(ErrorCode.PAYMENT_REFUND_NOT_ALLOWED); // full refund only
        }
        BigDecimal reserved = refundRepository.sumAmountByPaymentAndStatuses(paymentId, RESERVED_REFUNDS);
        if (reserved.add(amount).compareTo(payment.getAmount()) > 0)
            throw new AppException(ErrorCode.PAYMENT_REFUND_EXCEEDS_PAID_AMOUNT);
        if (refundRepository.existsByPaymentIdAndStatusIn(paymentId, RESERVED_REFUNDS))
            throw new AppException(ErrorCode.PAYMENT_REFUND_IN_PROGRESS);
        return refundRepository.save(PaymentRefund.builder().payment(payment)
                .idempotencyKey(request.getIdempotencyKey().trim()).requestId(requestId).amount(amount)
                .status(PaymentRefundStatus.PROCESSING).actorAccountId(actorId)
                .reason(request.getReason().trim()).build());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public PaymentRefund finishRefund(Long refundId, VnPayTransactionResult result,
                                      PaymentRefundStatus status, String message) {
        PaymentRefund refund = refundRepository.findById(refundId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_REFUND_NOT_FOUND));
        Payment payment = lockedPayment(refund.getPayment().getId());
        refund.setStatus(status);
        refund.setResponseCode(result == null ? null : result.getResponseCode());
        refund.setTransactionStatus(result == null ? null : result.getTransactionStatus());
        refund.setGatewayRefundTransactionId(result == null ? null : result.getTransactionNo());
        refund.setMessage(truncate(message));
        if (status == PaymentRefundStatus.SUCCEEDED) {
            payment.setPaymentStatus(PaymentStatus.REFUNDED);
            payment.setPaymentMessage("VNPay xác nhận hoàn tiền thành công");
            Order order = orderRepository.findByIdForUpdate(payment.getOrderId())
                    .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
            order.setRefundRequired(false);
            orderRepository.save(order);
            paymentRepository.save(payment);
        }
        return refundRepository.save(refund);
    }

    private Payment lockedPayment(Long paymentId) {
        Payment initial = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        orderRepository.findByIdForUpdate(initial.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        return paymentRepository.findByOrderIdForUpdate(initial.getOrderId()).stream()
                .filter(p -> p.getId().equals(paymentId)).findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }
    private String truncate(String value) {
        if (value == null) return null;
        return value.substring(0, Math.min(500, value.length()));
    }
}
