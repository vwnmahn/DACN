package com.example.dacn.controller;

import com.example.dacn.dto.request.VnPayCreatePaymentRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.service.VnPayService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments/vnpay")
@RequiredArgsConstructor
public class VnPayController {
    private final VnPayService vnPayService;

    @PostMapping("/create")
    public ResponseEntity<ApiResponse<PaymentUrlResponse>> create(
            @Valid @RequestBody VnPayCreatePaymentRequest request,
            HttpServletRequest servletRequest) {
        PaymentUrlResponse data = vnPayService.createPaymentUrl(
                request.getOrderId(), request.getLocale(), clientIp(servletRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<PaymentUrlResponse>builder()
                .code(1000).message("Tạo URL thanh toán VNPay thành công").data(data).build());
    }

    @GetMapping("/return")
    public ResponseEntity<ApiResponse<VnPayReturnResponse>> paymentReturn(
            @RequestParam Map<String, String> parameters) {
        return ResponseEntity.ok(ApiResponse.<VnPayReturnResponse>builder()
                .code(1000).message("Đã kiểm tra kết quả trả về từ VNPay")
                .data(vnPayService.processReturn(parameters)).build());
    }

    @GetMapping("/ipn")
    public ResponseEntity<VnPayIpnResponse> ipn(@RequestParam Map<String, String> parameters) {
        return ResponseEntity.ok(vnPayService.processIpn(parameters));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded;
    }
}
