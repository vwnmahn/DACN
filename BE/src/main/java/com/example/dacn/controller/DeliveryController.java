package com.example.dacn.controller;

import com.example.dacn.dto.request.DeliveryEstimateRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.service.DeliveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/delivery") @RequiredArgsConstructor
public class DeliveryController {
    private final DeliveryService service;

    @PostMapping("/estimate") @PreAuthorize("hasRole('USER')")
    public ApiResponse<DeliveryEstimateResponse> estimate(@Valid @RequestBody DeliveryEstimateRequest request) {
        return ApiResponse.<DeliveryEstimateResponse>builder().code(1000)
                .message("Ước tính phí giao hàng thành công").data(service.estimate(request)).build();
    }
}
