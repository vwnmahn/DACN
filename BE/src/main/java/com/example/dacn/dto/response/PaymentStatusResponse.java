package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentStatusResponse {
    private Long paymentId;
    private Long orderId;
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private BigDecimal amount;
    private String transactionReference;
    private LocalDateTime paidAt;
    private String message;
}
