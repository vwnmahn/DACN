package com.example.dacn.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VoucherRedemptionResponse {
    private Long id;
    private VoucherResponse voucher;
    private LocalDateTime redeemedAt;
    private LocalDateTime expiresAt;
    private Integer availablePoints;
}
