package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentStatus;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VnPayReturnResponse {
    private boolean signatureValid;
    private String transactionReference;
    private String responseCode;
    private String transactionStatus;
    private PaymentStatus paymentStatus;
    private String message;
}
