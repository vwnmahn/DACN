package com.example.dacn.dto.response;

import lombok.*;
import java.math.BigDecimal;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VoucherValidationResponse {
    private boolean valid;
    private Integer reasonCode;
    private String reason;
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal discountAmount;
    private BigDecimal estimatedTotal;
}
