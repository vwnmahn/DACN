package com.example.dacn.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class AdminOrderResponse {
    private OrderResponse order;
    private Long accountId;
    private String username;
    private String email;
    private String phoneNumber;
    private List<OrderStatusHistoryResponse> statusHistory;
}
