package com.example.dacn.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;
import java.math.BigDecimal;

@Data
public class VoucherValidateRequest {
    @NotBlank @Size(max = 50)
    private String voucherCode;
    @NotNull @Positive
    private Long restaurantId;
    @DecimalMin(value = "-90.0", message = "Vĩ độ không hợp lệ")
    @DecimalMax(value = "90.0", message = "Vĩ độ không hợp lệ")
    private BigDecimal deliveryLatitude;
    @DecimalMin(value = "-180.0", message = "Kinh độ không hợp lệ")
    @DecimalMax(value = "180.0", message = "Kinh độ không hợp lệ")
    private BigDecimal deliveryLongitude;
    @NotEmpty
    private List<@Valid Item> items;

    @Data
    public static class Item {
        @NotNull @Positive
        private Long menuItemId;
        @NotNull @Min(1) @Max(100)
        private Integer quantity;
    }
}
