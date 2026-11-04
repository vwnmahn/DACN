package com.example.dacn.dto.request;

import com.example.dacn.entity.ReservationStatus;
import jakarta.validation.constraints.NotNull;

public record TableReservationStatusUpdateRequest(
        @NotNull ReservationStatus status
) {}
