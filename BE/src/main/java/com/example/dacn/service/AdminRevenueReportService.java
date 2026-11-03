package com.example.dacn.service;

import com.example.dacn.dto.response.AdminRevenueReportResponse;

import java.time.LocalDate;

public interface AdminRevenueReportService {
    AdminRevenueReportResponse getReport(LocalDate from, LocalDate to, Long restaurantId);
}
