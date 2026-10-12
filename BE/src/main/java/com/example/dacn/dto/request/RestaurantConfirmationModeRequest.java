package com.example.dacn.dto.request;

import com.example.dacn.entity.OrderConfirmationMode;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RestaurantConfirmationModeRequest {
    @NotNull(message = "Chế độ xác nhận đơn hàng không được để trống")
    private OrderConfirmationMode mode;
}
