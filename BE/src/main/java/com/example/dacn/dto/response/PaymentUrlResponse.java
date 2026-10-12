package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentStatus;
import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentUrlResponse {
    private Long paymentId;
    private Long orderId;
    private String transactionReference;
    private BigDecimal amount;
    private PaymentStatus status;
    @ToString.Exclude
    private String paymentUrl;
}
