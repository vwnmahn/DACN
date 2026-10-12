package com.example.dacn.dto.response;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentRefundPageResponse {
    private List<PaymentRefundResponse> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
}
