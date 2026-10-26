package com.example.dacn.dto.response;

import com.example.dacn.entity.ReservationStatus;
import java.time.LocalDateTime;

public record TableReservationResponse(
        Long reservationId,
        Long restaurantId,
        String restaurantName,
        Long tableId,
        Integer tableNumber,
        String customerName,
        String customerPhone,
        Integer guestCount,
        LocalDateTime startTime,
        LocalDateTime endTime,
        ReservationStatus status,
        String note,
        boolean cancellable
) {}
