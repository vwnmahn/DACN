package com.example.dacn.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DeliveryAvailabilityRequest {

    @NotNull(message = "Mã nhà hàng không được để trống")
    @Positive(message = "Mã nhà hàng không hợp lệ")
    private Long restaurantId;

    @DecimalMin(value = "-90.0", message = "Vĩ độ GPS không hợp lệ")
    @DecimalMax(value = "90.0", message = "Vĩ độ GPS không hợp lệ")
    private BigDecimal deliveryLatitude;

    @DecimalMin(value = "-180.0", message = "Kinh độ GPS không hợp lệ")
    @DecimalMax(value = "180.0", message = "Kinh độ GPS không hợp lệ")
    private BigDecimal deliveryLongitude;

    @Size(max = 500, message = "Địa chỉ giao hàng không được vượt quá 500 ký tự")
    private String deliveryAddress;

    @AssertTrue(message = "Phải cung cấp đầy đủ tọa độ hoặc địa chỉ giao hàng")
    public boolean isLocationProvided() {
        boolean hasLatitude = deliveryLatitude != null;
        boolean hasLongitude = deliveryLongitude != null;
        return (hasLatitude && hasLongitude)
                || (!hasLatitude && !hasLongitude
                && deliveryAddress != null && !deliveryAddress.isBlank());
    }
}
