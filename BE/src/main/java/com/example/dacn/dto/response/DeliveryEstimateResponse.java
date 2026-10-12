package com.example.dacn.dto.response;

import lombok.*;
import java.math.BigDecimal;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class DeliveryEstimateResponse {
    private Long restaurantId;
    private BigDecimal distanceKm;
    private BigDecimal deliveryRadiusKm;
    private boolean withinDeliveryArea;
    private BigDecimal deliveryFee;
    private String distanceType;
}
