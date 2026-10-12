package com.example.dacn.service.Impl;

import com.example.dacn.config.VnPayConfig;
import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.gateway.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PaymentOperationsServiceImpl implements PaymentOperationsService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<PaymentRefundStatus> ACTIVE_REFUNDS = EnumSet.of(
            PaymentRefundStatus.REQUESTED, PaymentRefundStatus.PROCESSING, PaymentRefundStatus.UNKNOWN);
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final PaymentRefundRepository refundRepository;
    private final PaymentOperationStateService stateService;
    private final VnPayTransactionGateway gateway;
    private final VnPayConfig config;

    @Override
    public AdminPaymentPageResponse reconciliationQueue(int page, int size) {
        return paymentService.searchAdminPayments(PaymentStatus.NEEDS_RECONCILIATION, null,
                null, null, null, null, null, page, size, "createdAt", "asc");
    }

    @Override
    public PaymentReconciliationResponse reconcile(Long paymentId, String clientIp) {
        Account actor = actor();
        String requestId = requestId();
        PaymentReconciliationHistory history = stateService.claimReconciliation(paymentId, actor.getId(), requestId);
        Payment snapshot = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        VnPayTransactionResult result;
        try {
            result = gateway.query(snapshot, requestId, clientIp);
        } catch (RuntimeException exception) {
            PaymentReconciliationHistory saved = stateService.finishReconciliation(history.getId(), null,
                    PaymentReconciliationStatus.UNKNOWN, "Không xác định được kết quả QueryDR");
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_UNAVAILABLE);
        }
        Optional<PaymentRefund> activeRefund = refundRepository
                .findFirstByPaymentIdAndStatusInOrderByIdDesc(paymentId, ACTIVE_REFUNDS);
        BigDecimal expectedAmount = activeRefund.isPresent() && "02".equals(result.getTransactionType())
                ? activeRefund.get().getAmount() : snapshot.getAmount();
        String validationError = validate(result, snapshot, "querydr", expectedAmount);
        if (validationError != null) {
            stateService.finishReconciliation(history.getId(), result,
                    PaymentReconciliationStatus.FAILED, validationError);
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_RESPONSE_INVALID);
        }
        PaymentReconciliationStatus status;
        if (activeRefund.isPresent() && "02".equals(result.getTransactionType())) {
            PaymentRefundStatus refundStatus = refundStatus(result);
            stateService.finishRefund(activeRefund.get().getId(), result, refundStatus, result.getMessage());
            status = refundStatus == PaymentRefundStatus.SUCCEEDED ? PaymentReconciliationStatus.SUCCEEDED
                    : refundStatus == PaymentRefundStatus.FAILED ? PaymentReconciliationStatus.FAILED
                    : PaymentReconciliationStatus.UNKNOWN;
        } else if ("00".equals(result.getResponseCode()) && "00".equals(result.getTransactionStatus())) {
            paymentService.confirmPaymentSuccess(snapshot.getTransactionReference(), result.getTransactionNo());
            status = PaymentReconciliationStatus.SUCCEEDED;
        } else if ("00".equals(result.getResponseCode())
                && Set.of("02", "09").contains(result.getTransactionStatus())) {
            paymentService.confirmPaymentFailed(snapshot.getTransactionReference(),
                    "QueryDR xác nhận giao dịch không thành công");
            status = PaymentReconciliationStatus.FAILED;
        } else {
            status = PaymentReconciliationStatus.UNKNOWN;
        }
        return reconciliationResponse(stateService.finishReconciliation(history.getId(), result, status,
                result.getMessage()));
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentRefundPageResponse refunds(PaymentRefundStatus status, int page, int size) {
        validatePage(page, size);
        Collection<PaymentRefundStatus> statuses = status == null
                ? Arrays.asList(PaymentRefundStatus.values()) : List.of(status);
        Page<PaymentRefund> result = refundRepository.findByStatusIn(statuses,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return PaymentRefundPageResponse.builder().content(result.map(this::refundResponse).getContent())
                .page(page).size(size).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).build();
    }

    @Override
    public PaymentRefundResponse refund(Long paymentId, PaymentRefundRequest request, String clientIp) {
        Account actor = actor();
        String requestId = requestId();
        PaymentRefund refund = stateService.claimRefund(paymentId, request, actor.getId(), requestId);
        if (!requestId.equals(refund.getRequestId())) return refundResponse(refund); // idempotent replay
        Payment snapshot = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        VnPayTransactionResult result;
        try {
            result = gateway.refund(snapshot, refund.getAmount(), requestId, "admin" + actor.getId(),
                    clientIp, refund.getReason());
        } catch (RuntimeException exception) {
            return refundResponse(stateService.finishRefund(refund.getId(), null,
                    PaymentRefundStatus.UNKNOWN, "Không xác định được kết quả yêu cầu hoàn tiền"));
        }
        String validationError = validate(result, snapshot, "refund", refund.getAmount());
        if (validationError != null) {
            return refundResponse(stateService.finishRefund(refund.getId(), result,
                    PaymentRefundStatus.UNKNOWN, validationError));
        }
        PaymentRefundStatus status = refundStatus(result);
        return refundResponse(stateService.finishRefund(refund.getId(), result, status, result.getMessage()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PaymentRefundResponse> refundHistory(Long paymentId) {
        if (!paymentRepository.existsById(paymentId)) throw new AppException(ErrorCode.PAYMENT_NOT_FOUND);
        return refundRepository.findByPaymentIdOrderByIdDesc(paymentId).stream().map(this::refundResponse).toList();
    }

    private String validate(VnPayTransactionResult result, Payment payment, String command, BigDecimal amount) {
        if (!result.isSignatureValid()) return "Chữ ký response VNPay không hợp lệ";
        if (!command.equals(result.getCommand())) return "Sai command VNPay";
        if (!config.getTmnCode().trim().equals(result.getTmnCode())) return "Sai merchant VNPay";
        if (!payment.getTransactionReference().equals(result.getTransactionReference())) return "Sai mã giao dịch";
        try {
            if (amount.movePointRight(2).longValueExact() != Long.parseLong(result.getAmount()))
                return "Sai số tiền giao dịch";
        } catch (RuntimeException exception) { return "Số tiền VNPay không hợp lệ"; }
        return null;
    }

    private PaymentRefundStatus refundStatus(VnPayTransactionResult result) {
        if ("00".equals(result.getResponseCode()) && "00".equals(result.getTransactionStatus())
                && "02".equals(result.getTransactionType())) return PaymentRefundStatus.SUCCEEDED;
        if ("00".equals(result.getResponseCode())
                && Set.of("05", "06").contains(result.getTransactionStatus()))
            return PaymentRefundStatus.PROCESSING;
        if (Set.of("03", "91", "95", "97").contains(result.getResponseCode())
                || "09".equals(result.getTransactionStatus())) return PaymentRefundStatus.FAILED;
        return PaymentRefundStatus.UNKNOWN;
    }

    private Account actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Account account) || account.getId() == null)
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        return account;
    }
    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE)
            throw new AppException(ErrorCode.PAYMENT_INVALID_PAGE_REQUEST);
    }
    private String requestId() { return UUID.randomUUID().toString().replace("-", ""); }
    private PaymentRefundResponse refundResponse(PaymentRefund refund) {
        return PaymentRefundResponse.builder().id(refund.getId()).paymentId(refund.getPayment().getId())
                .orderId(refund.getPayment().getOrderId()).amount(refund.getAmount()).status(refund.getStatus())
                .gatewayRefundTransactionId(refund.getGatewayRefundTransactionId())
                .responseCode(refund.getResponseCode()).transactionStatus(refund.getTransactionStatus())
                .reason(refund.getReason()).message(refund.getMessage())
                .createdAt(refund.getCreatedAt()).updatedAt(refund.getUpdatedAt()).build();
    }
    private PaymentReconciliationResponse reconciliationResponse(PaymentReconciliationHistory h) {
        Payment payment = h.getPayment();
        return PaymentReconciliationResponse.builder().historyId(h.getId()).paymentId(payment.getId())
                .orderId(payment.getOrderId()).transactionReference(payment.getTransactionReference())
                .paymentStatus(payment.getPaymentStatus()).reconciliationStatus(h.getStatus())
                .responseCode(h.getResponseCode()).transactionStatus(h.getTransactionStatus())
                .gatewayTransactionId(h.getGatewayTransactionId()).message(h.getMessage())
                .createdAt(h.getCreatedAt()).updatedAt(h.getUpdatedAt()).build();
    }
}
