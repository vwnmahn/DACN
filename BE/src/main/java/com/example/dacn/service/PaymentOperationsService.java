package com.example.dacn.service;

import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.PaymentRefundStatus;
import java.util.List;

public interface PaymentOperationsService {
    AdminPaymentPageResponse reconciliationQueue(int page, int size);
    PaymentReconciliationResponse reconcile(Long paymentId, String clientIp);
    PaymentRefundPageResponse refunds(PaymentRefundStatus status, int page, int size);
    PaymentRefundResponse refund(Long paymentId, PaymentRefundRequest request, String clientIp);
    List<PaymentRefundResponse> refundHistory(Long paymentId);
}
