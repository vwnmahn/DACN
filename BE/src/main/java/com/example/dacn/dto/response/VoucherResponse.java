package com.example.dacn.dto.response;

import com.example.dacn.entity.DiscountType;
import com.example.dacn.entity.CategoryVoucher;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VoucherResponse {
    private Long id;
    private String code;
    private String description;
    private CategoryVoucher categoryVoucher;
    private DiscountType discountType;
    private BigDecimal discountValue;
    private BigDecimal minOrderAmount;
    private BigDecimal maxDiscountAmount;
    private Integer usageLimit;
    private Integer usedCount;
    private Integer perUserLimit;
    private Boolean active;
    private String customerStatus;
    private Long restaurantId;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
