package com.example.dacn.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class RestaurantRentCostHistoryResponse {
    private Long id;
    private Long restaurantId;
    private Integer year;
    private Integer month;
    private BigDecimal oldAmount;
    private BigDecimal newAmount;
    private LocalDateTime changedAt;
    private Long performedByAccountId;
    private String performedByRole;
}
