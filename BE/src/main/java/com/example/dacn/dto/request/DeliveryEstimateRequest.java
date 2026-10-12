package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class DeliveryEstimateRequest {
    @NotNull @Positive private Long restaurantId;
    @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") private BigDecimal latitude;
    @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") private BigDecimal longitude;
}
