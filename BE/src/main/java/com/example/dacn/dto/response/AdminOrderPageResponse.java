package com.example.dacn.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class AdminOrderPageResponse {
    private List<AdminOrderResponse> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private String sortBy;
    private String sortDirection;
}
