package com.example.dacn.controller;

import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.PaymentStatusResponse;
import com.example.dacn.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;

    @GetMapping("/{orderId}/status")
    public ResponseEntity<ApiResponse<PaymentStatusResponse>> status(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.<PaymentStatusResponse>builder()
                .code(1000).message("Lấy trạng thái thanh toán thành công")
                .data(paymentService.getStatusForCurrentUser(orderId)).build());
    }
}
