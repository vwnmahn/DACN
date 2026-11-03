package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
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
    private PaymentMethod paymentMethod;
    private PaymentStatus paymentStatus;
    private List<OrderStatusHistoryResponse> statusHistory;
}
