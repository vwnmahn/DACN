package com.example.dacn.dto.response;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutResponse {
    private OrderResponse order;
    private CheckoutPaymentResponse payment;
}
