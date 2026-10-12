package com.example.dacn.dto.response;

import com.example.dacn.entity.*;
import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentReconciliationResponse {
    private Long historyId;
    private Long paymentId;
    private Long orderId;
    private String transactionReference;
    private PaymentStatus paymentStatus;
    private PaymentReconciliationStatus reconciliationStatus;
    private String responseCode;
    private String transactionStatus;
    private String gatewayTransactionId;
    private String message;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
