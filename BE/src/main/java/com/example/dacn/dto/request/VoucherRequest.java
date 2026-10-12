package com.example.dacn.dto.request;

import com.example.dacn.entity.DiscountType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class VoucherRequest {
    @NotBlank @Size(max = 50)
    private String code;
    @Size(max = 255)
    private String description;
    @NotNull
    private DiscountType discountType;
    @NotNull @DecimalMin(value = "0.01")
    private BigDecimal discountValue;
    @NotNull @DecimalMin(value = "0.00")
    private BigDecimal minOrderAmount;
    @DecimalMin(value = "0.01")
    private BigDecimal maxDiscountAmount;
    @NotNull @Positive
    private Integer usageLimit;
    @NotNull @Positive
    private Integer perUserLimit;
    @NotNull
    private LocalDateTime startDate;
    @NotNull
    private LocalDateTime endDate;
    @NotNull
    private Boolean active;
    @Positive
    private Long restaurantId;
}
