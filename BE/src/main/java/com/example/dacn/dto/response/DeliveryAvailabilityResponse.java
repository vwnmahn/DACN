package com.example.dacn.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class DeliveryAvailabilityResponse {

    private Long restaurantId;
    private boolean deliverable;
    private BigDecimal distanceKm;
    private BigDecimal deliveryRadiusKm;
    private BigDecimal deliveryFee;
    private BigDecimal deliveryLatitude;
    private BigDecimal deliveryLongitude;
    private String message;
}
