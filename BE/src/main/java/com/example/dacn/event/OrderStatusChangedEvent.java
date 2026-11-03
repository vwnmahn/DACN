package com.example.dacn.event;

import com.example.dacn.entity.OrderStatus;
import com.example.dacn.entity.PaymentStatus;

import java.time.LocalDateTime;

public record OrderStatusChangedEvent(
        Type type,
        Long orderId,
        Long accountId,
        OrderStatus status,
        PaymentStatus paymentStatus,
        LocalDateTime changedAt
) {
    public enum Type {
        CREATED,
        STATUS_CHANGED
    }
}
