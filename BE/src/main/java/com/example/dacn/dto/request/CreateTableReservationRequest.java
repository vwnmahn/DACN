package com.example.dacn.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public record CreateTableReservationRequest(
        @NotNull
        @Positive
        Long restaurantId,

        @NotBlank
        @Size(max = 150)
        String customerName,

        @NotBlank
        @Size(max = 20)
        String customerPhone,

        @NotNull
        @Min(1)
        @Max(50)
        Integer guestCount,

        @NotNull
        @FutureOrPresent
        LocalDate date,

        @NotNull
        LocalTime time,

        @Size(max = 500)
        String note
) {}