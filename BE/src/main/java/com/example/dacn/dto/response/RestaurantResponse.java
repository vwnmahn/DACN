package com.example.dacn.dto.response;

import com.example.dacn.entity.CategoryStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import com.example.dacn.entity.OrderConfirmationMode;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RestaurantResponse {// k dùng

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
    // Hai ảnh bổ sung — dùng ở trang chi tiết nhà hàng
    private String imageUrl2;
    private String imageUrl3;

    private Integer reviewCount;

    private Double averageRating;

    private Boolean active;
    private OrderConfirmationMode orderConfirmationMode;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private CategoryStatus categoryStatus;
}
