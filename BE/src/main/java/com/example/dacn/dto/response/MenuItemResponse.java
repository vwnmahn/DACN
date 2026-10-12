package com.example.dacn.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MenuItemResponse {
    private Long id;
    private Long restaurantId;
    private String restaurantName;
    private String name;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private Boolean active;
    private Boolean available;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
