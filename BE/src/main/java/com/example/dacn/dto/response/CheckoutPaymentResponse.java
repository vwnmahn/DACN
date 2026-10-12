package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
import lombok.*;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutPaymentResponse {
    private Long paymentId;
    private PaymentMethod method;
    private PaymentStatus status;
    private String transactionReference;
    private BigDecimal amount;
    @ToString.Exclude
    private String paymentUrl;
}
