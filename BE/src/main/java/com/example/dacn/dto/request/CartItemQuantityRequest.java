package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CartItemQuantityRequest {
    @NotNull @Min(1) @Max(100)
    private Integer quantity;
}
