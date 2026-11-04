package com.example.dacn.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CartResponse {
    private Long id;
    private List<Item> items;
    private Integer totalQuantity;
    private BigDecimal subtotal;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Item {
        private Long id;
        private Long menuItemId;
        private Long restaurantId;
        private String restaurantName;
        private String name;
        private String description;
        private BigDecimal price;
        private String imageUrl;
        private Integer quantity;
        private String note;
        private BigDecimal lineTotal;
    }
}
