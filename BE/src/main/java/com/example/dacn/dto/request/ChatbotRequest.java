package com.example.dacn.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ChatbotRequest(
        @NotBlank(message = "Nội dung câu hỏi không được để trống")
        @Size(max = 2000, message = "Nội dung câu hỏi không được vượt quá 2000 ký tự")
        String message,
        @DecimalMin(value = "-90.0", message = "Vĩ độ phải từ -90 đến 90")
        @DecimalMax(value = "90.0", message = "Vĩ độ phải từ -90 đến 90")
        BigDecimal latitude,
        @DecimalMin(value = "-180.0", message = "Kinh độ phải từ -180 đến 180")
        @DecimalMax(value = "180.0", message = "Kinh độ phải từ -180 đến 180")
        BigDecimal longitude
) {}
