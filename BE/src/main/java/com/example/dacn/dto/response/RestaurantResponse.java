package com.example.dacn.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import com.example.dacn.entity.OrderConfirmationMode;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestaurantResponse {

    private Long id;

    private String name;

    private String address;

    private String phoneNumber;

    private LocalTime openingTime;

    private LocalTime closingTime;

    private BigDecimal deliveryFee;

    private Double deliveryRadiusKm;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal baseDistanceKm;
    private BigDecimal additionalFeePerKm;

    private String imageUrl;

    private Integer reviewCount;

    private Double averageRating;

    private Boolean active;
    private OrderConfirmationMode orderConfirmationMode;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
