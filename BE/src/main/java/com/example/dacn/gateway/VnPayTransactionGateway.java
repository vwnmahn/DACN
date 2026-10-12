package com.example.dacn.gateway;

import com.example.dacn.entity.Payment;
import java.math.BigDecimal;

public interface VnPayTransactionGateway {
    VnPayTransactionResult query(Payment payment, String requestId, String clientIp);
    VnPayTransactionResult refund(Payment payment, BigDecimal amount, String requestId,
                                  String createdBy, String clientIp, String reason);
}
