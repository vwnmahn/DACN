package com.example.dacn.dto.response;

import com.example.dacn.entity.OrderStatus;
import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class AdminPaymentResponse {
    private Long id;
    private Long orderId;
    private Long accountId;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private BigDecimal amount;
    private String transactionReference;
    private String gatewayTransactionId;
    private LocalDateTime paidAt;
    private String paymentMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private OrderStatus orderStatus;
    private boolean needsReconciliation;
    private boolean refundRequired;
}
