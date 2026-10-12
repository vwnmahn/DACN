package com.example.dacn.dto.response;

import com.example.dacn.entity.OrderStatus;
import com.example.dacn.entity.OrderStatusActorType;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class OrderStatusHistoryResponse {
    private Long id;
    private OrderStatus oldStatus;
    private OrderStatus newStatus;
    private Long actorAccountId;
    private String actorUsername;
    private OrderStatusActorType actorType;
    private LocalDateTime changedAt;
    private String reason;
}
