package com.example.dacn.entity;

public enum OrderStatus {
    PENDING,
    AWAITING_PAYMENT,
    CONFIRMED,
    PREPARING,
    READY_FOR_DELIVERY,
    DELIVERING,
    ARRIVED,
    COMPLETED,
    CANCELLED;

    public boolean canTransitionTo(OrderStatus target) {
        if (target == null || target == this) {
            return false;
        }
        return switch (this) {
            case PENDING -> target == AWAITING_PAYMENT || target == CONFIRMED || target == CANCELLED;
            case AWAITING_PAYMENT -> target == CONFIRMED || target == CANCELLED;
            case CONFIRMED -> target == PREPARING || target == CANCELLED;
            case PREPARING -> target == READY_FOR_DELIVERY || target == CANCELLED;
            case READY_FOR_DELIVERY -> target == DELIVERING || target == CANCELLED;
            case DELIVERING -> target == ARRIVED;
            case ARRIVED -> target == COMPLETED;
            case COMPLETED, CANCELLED -> false;
        };
    }
}
