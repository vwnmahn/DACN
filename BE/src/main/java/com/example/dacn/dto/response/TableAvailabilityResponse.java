package com.example.dacn.dto.response;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record TableAvailabilityResponse(
        Long restaurantId,
        LocalDate date,
        LocalTime time,
        LocalTime endTime,
        int guestCount,
        int totalActiveTables,
        int suitableTableCount,
        int availableTableCount,
        List<AvailableTableResponse> availableTables
) {
    public record AvailableTableResponse(
            Long tableId,
            Integer tableNumber,
            Integer capacity
    ) {}
}