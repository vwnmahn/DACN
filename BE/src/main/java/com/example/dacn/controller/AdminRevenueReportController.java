package com.example.dacn.controller;

import com.example.dacn.dto.response.AdminRevenueReportResponse;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.service.AdminRevenueReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/admin/reports")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRevenueReportController {
    private final AdminRevenueReportService reportService;

    @GetMapping("/revenue")
    public ApiResponse<AdminRevenueReportResponse> revenue(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long restaurantId) {
        return ApiResponse.<AdminRevenueReportResponse>builder()
                .code(1000).message("Lấy báo cáo doanh thu thành công")
                .data(reportService.getReport(from, to, restaurantId)).build();
    }
}
