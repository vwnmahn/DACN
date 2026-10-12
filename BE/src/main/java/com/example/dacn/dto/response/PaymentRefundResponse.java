package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentRefundStatus;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentRefundResponse {
    private Long id;
    private Long paymentId;
    private Long orderId;
    private BigDecimal amount;
    private PaymentRefundStatus status;
    private String gatewayRefundTransactionId;
    private String responseCode;
    private String transactionStatus;
    private String reason;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
