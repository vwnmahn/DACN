package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class MenuItemUpdateRequest {
    @NotBlank(message = "Tên món không được để trống")
    @Size(max = 150, message = "Tên món không được vượt quá 150 ký tự")
    private String name;

    @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự")
    private String description;

    @NotNull(message = "Giá món không được để trống")
    @DecimalMin(value = "0.0", inclusive = true, message = "Giá món không được âm")
    @Digits(integer = 13, fraction = 2, message = "Giá món không hợp lệ")
    private BigDecimal price;

    @Size(max = 500, message = "URL ảnh không được vượt quá 500 ký tự")
    private String imageUrl;

    @NotNull(message = "Trạng thái active không được để trống")
    private Boolean active;

    @NotNull(message = "Trạng thái available không được để trống")
    private Boolean available;
}
