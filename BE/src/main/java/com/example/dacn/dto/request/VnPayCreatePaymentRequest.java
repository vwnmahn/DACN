package com.example.dacn.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class VnPayCreatePaymentRequest {
    @NotNull(message = "Mã đơn hàng không được để trống")
    @Positive(message = "Mã đơn hàng không hợp lệ")
    private Long orderId;

    @Pattern(regexp = "^(vn|en)$", message = "Ngôn ngữ VNPay chỉ hỗ trợ vn hoặc en")
    private String locale = "vn";
}
