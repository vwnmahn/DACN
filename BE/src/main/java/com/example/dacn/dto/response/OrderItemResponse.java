package com.example.dacn.dto.response;

import lombok.*;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemResponse {
    private Long id;
    private Long menuItemId;
    private String itemName;
    private String imageUrl;
    private String note;
    private BigDecimal unitPrice;
    private Integer quantity;
    private BigDecimal lineTotal;
}
