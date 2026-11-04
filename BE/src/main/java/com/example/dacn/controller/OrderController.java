package com.example.dacn.controller;

import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.service.OrderService;
import com.example.dacn.service.OrderManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import com.example.dacn.dto.request.OrderManagementRequest.CustomerCancellation;
import java.util.List;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;
    private final OrderManagementService orderManagementService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getMyOrders() {
        return ResponseEntity.ok(ApiResponse.<List<OrderResponse>>builder()
                .code(1000).message("Lấy danh sách đơn hàng thành công")
                .data(orderService.getMyOrders()).build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderResponse>> getMyOrder(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000).message("Lấy thông tin đơn hàng thành công")
                .data(orderService.getMyOrder(id)).build());
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancelMyOrder(
            @PathVariable Long id, @Valid @RequestBody CustomerCancellation request) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000).message("Hủy đơn hàng thành công")
                .data(orderManagementService.cancelMyOrder(id, request.getReasonCode(), request.getReason())).build());
    }

    @PatchMapping("/{id}/confirm-received")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ApiResponse<OrderResponse>> confirmReceived(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000).message("Xác nhận đã nhận hàng thành công")
                .data(orderManagementService.confirmReceivedByUser(id)).build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @jakarta.validation.Valid
            @org.springframework.web.bind.annotation.RequestBody
            com.example.dacn.dto.request.CreateOrderRequest request) {

        return ResponseEntity.ok(
                ApiResponse.<OrderResponse>builder()
                        .code(1000)
                        .message("Tạo đơn hàng thành công")
                        .data(orderService.createOrder(request))
                        .build()
        );
    }

}
