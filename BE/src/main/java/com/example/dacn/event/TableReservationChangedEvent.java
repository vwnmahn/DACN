package com.example.dacn.event;

import com.example.dacn.entity.ReservationStatus;

import java.time.LocalDateTime;

public record TableReservationChangedEvent(
        Type type,
        Long reservationId,
        Long accountId,
        ReservationStatus status,
        LocalDateTime changedAt
) {
    public enum Type {
        CREATED,
        STATUS_CHANGED
    }
}
