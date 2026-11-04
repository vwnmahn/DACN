package com.example.dacn.controller;

import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.TableReservationResponse;
import com.example.dacn.dto.request.TableReservationStatusUpdateRequest;
import com.example.dacn.service.TableReservationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/table-reservations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTableReservationController {
    private final TableReservationService reservationService;

    @GetMapping
    public ApiResponse<List<TableReservationResponse>> getAll() {
        return ApiResponse.<List<TableReservationResponse>>builder()
                .code(1000)
                .message("Lấy danh sách đặt bàn quản trị thành công")
                .data(reservationService.getAllForAdmin())
                .build();
    }

    @GetMapping("/{reservationId}")
    public ApiResponse<TableReservationResponse> getById(@PathVariable Long reservationId) {
        return ApiResponse.<TableReservationResponse>builder()
                .code(1000)
                .message("Lấy chi tiết đặt bàn quản trị thành công")
                .data(reservationService.getByIdForAdmin(reservationId))
                .build();
    }

    @PatchMapping("/{reservationId}/status")
    public ApiResponse<TableReservationResponse> updateStatus(
            @PathVariable Long reservationId,
            @Valid @RequestBody TableReservationStatusUpdateRequest request) {
        return ApiResponse.<TableReservationResponse>builder()
                .code(1000)
                .message("Cập nhật trạng thái đặt bàn thành công")
                .data(reservationService.updateStatusForAdmin(reservationId, request.status()))
                .build();
    }
}
