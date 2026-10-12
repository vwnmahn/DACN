package com.example.dacn.controller;

import com.example.dacn.dto.request.OrderManagementRequest.CodCompletion;
import com.example.dacn.dto.request.OrderManagementRequest.Cancellation;
import com.example.dacn.dto.request.OrderManagementRequest.StatusUpdate;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.OrderStatus;
import com.example.dacn.service.OrderManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/orders")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrderController {
    private final OrderManagementService orderManagementService;

    @PatchMapping("/{orderId}/confirm")
    public ResponseEntity<ApiResponse<OrderResponse>> confirm(@PathVariable Long orderId) {
        return ok("Xác nhận đơn hàng thành công", orderManagementService.confirmByAdmin(orderId));
    }

    @PatchMapping("/{orderId}/status")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @PathVariable Long orderId, @Valid @RequestBody StatusUpdate request) {
        return ok("Cập nhật trạng thái đơn hàng thành công",
                orderManagementService.updateStatusByAdmin(orderId, request.getStatus()));
    }

    @PatchMapping("/{orderId}/complete-cod")
    public ResponseEntity<ApiResponse<OrderResponse>> completeCod(
            @PathVariable Long orderId, @Valid @RequestBody CodCompletion request) {
        return ok("Hoàn tất đơn hàng COD và ghi nhận thu tiền thành công",
                orderManagementService.completeCodByAdmin(orderId, request.isPaymentCollected()));
    }

    @PatchMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<OrderResponse>> cancel(
            @PathVariable Long orderId, @Valid @RequestBody Cancellation request) {
        return ok("Hủy đơn hàng thành công",
                orderManagementService.cancelByAdmin(orderId, request.getReason()));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<AdminOrderPageResponse>> search(
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String customer,
            @RequestParam(required = false) String restaurant,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime createdTo,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.<AdminOrderPageResponse>builder()
                .code(1000).message("Lấy danh sách đơn hàng thành công")
                .data(orderManagementService.searchAdminOrders(orderId, customer, restaurant,
                        status, createdFrom, createdTo, page, size)).build());
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<AdminOrderResponse>> detail(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.<AdminOrderResponse>builder()
                .code(1000).message("Lấy chi tiết đơn hàng thành công")
                .data(orderManagementService.getAdminOrder(orderId)).build());
    }

    @GetMapping("/{orderId}/history")
    public ResponseEntity<ApiResponse<List<OrderStatusHistoryResponse>>> history(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.<List<OrderStatusHistoryResponse>>builder()
                .code(1000).message("Lấy lịch sử trạng thái đơn hàng thành công")
                .data(orderManagementService.getStatusHistory(orderId)).build());
    }

    private ResponseEntity<ApiResponse<OrderResponse>> ok(String message, OrderResponse data) {
        return ResponseEntity.ok(ApiResponse.<OrderResponse>builder()
                .code(1000).message(message).data(data).build());
    }
}

