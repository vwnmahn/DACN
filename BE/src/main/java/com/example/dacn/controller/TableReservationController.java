
package com.example.dacn.controller;


import com.example.dacn.dto.request.CreateTableReservationRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.TableAvailabilityResponse;
import com.example.dacn.dto.response.TableReservationResponse;
import com.example.dacn.service.TableReservationService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import lombok.RequiredArgsConstructor;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/table-reservations")
@RequiredArgsConstructor
@Validated
public class TableReservationController {

    private final TableReservationService reservationService;


    /**
     * Tạo yêu cầu đặt bàn.
     */
    @PostMapping
    public ApiResponse<TableReservationResponse> createReservation(
            @Valid @RequestBody CreateTableReservationRequest request) {

        TableReservationResponse result =
                reservationService.createReservation(request);

        return ApiResponse.<TableReservationResponse>builder()
                .code(1000)
                .message("Đặt bàn thành công")
                .data(result)
                .build();
    }

    @GetMapping("/mine")
    public ApiResponse<List<TableReservationResponse>> getMyReservations() {
        return ApiResponse.<List<TableReservationResponse>>builder()
                .code(1000)
                .message("Lấy lịch sử đặt bàn thành công")
                .data(reservationService.getMyReservations())
                .build();
    }

    /**
     * Hủy đặt bàn.
     */
    @PatchMapping("/{reservationId}/cancel")
    public ApiResponse<TableReservationResponse> cancelReservation(
            @PathVariable @NotNull @Min(1) Long reservationId) {

        TableReservationResponse result =
                reservationService.cancelReservation(reservationId);

        return ApiResponse.<TableReservationResponse>builder()
                .code(1000)
                .message("Hủy đặt bàn thành công")
                .data(result)
                .build();
    }
}
