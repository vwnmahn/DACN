package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;

@Data
public class RestaurantRequest {
    @NotBlank(message = "Tên nhà hàng không được để trống")
    @Size(max = 150, message = "Tên nhà hàng không được vượt quá 150 ký tự")
    private String name;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 255, message = "Địa chỉ không được vượt quá 255 ký tự")
    private String address;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(
            regexp = "^0[0-9]{9}$",
            message = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0"
    )
    private String phoneNumber;

    @NotNull(message = "Giờ mở cửa không được để trống")
    private LocalTime openingTime;

    @NotNull(message = "Giờ đóng cửa không được để trống")
    private LocalTime closingTime;

    @NotNull(message = "Phí giao hàng không được để trống")
    @DecimalMin(value = "0.0", message = "Phí giao hàng không được âm")
    @Digits(integer = 10, fraction = 2)
    private BigDecimal deliveryFee;

    @NotNull(message = "Bán kính giao hàng không được để trống")
    @DecimalMin(
            value = "0.0",
            inclusive = false,
            message = "Bán kính giao hàng phải lớn hơn 0"
    )
    private Double deliveryRadiusKm;

    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0")
    private BigDecimal latitude;
    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0")
    private BigDecimal longitude;
    @NotNull @DecimalMin(value = "0.0")
    private BigDecimal baseDistanceKm;
    @NotNull @DecimalMin(value = "0.0")
    private BigDecimal additionalFeePerKm;

    @Size(max = 500, message = "URL ảnh không được vượt quá 500 ký tự")
    private String imageUrl;
}
