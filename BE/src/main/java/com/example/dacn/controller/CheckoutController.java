package com.example.dacn.controller;

import com.example.dacn.dto.request.CheckoutRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.CheckoutResponse;
import com.example.dacn.service.CheckoutService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/checkout")
@RequiredArgsConstructor
public class CheckoutController {
    private final CheckoutService checkoutService;

    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<CheckoutResponse>> checkout(
            @Valid @RequestBody CheckoutRequest request, HttpServletRequest servletRequest) {
        CheckoutResponse data = checkoutService.checkout(request, clientIp(servletRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<CheckoutResponse>builder()
                .code(1000).message("Checkout thành công").data(data).build());
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded;
    }
}
