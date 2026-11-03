package com.example.dacn.dto.request;
import jakarta.validation.constraints.*; import lombok.Data; import java.math.BigDecimal;
@Data public class RestaurantRentRequest { @NotNull @Min(2000) private Integer year; @NotNull @Min(1) @Max(12) private Integer month; @NotNull @DecimalMin("0.00") private BigDecimal amount; }
