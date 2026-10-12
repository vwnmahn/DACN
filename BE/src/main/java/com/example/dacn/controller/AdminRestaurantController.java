package com.example.dacn.controller;

import com.example.dacn.dto.request.RestaurantConfirmationModeRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.dto.response.RestaurantPageResponse;
import com.example.dacn.entity.OrderConfirmationMode;
import com.example.dacn.service.RestaurantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/restaurants")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRestaurantController {
    private final RestaurantService restaurantService;

    @GetMapping
    public ResponseEntity<ApiResponse<RestaurantPageResponse>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) OrderConfirmationMode confirmationMode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        RestaurantPageResponse data = restaurantService.search(
                keyword, active, confirmationMode, page, size, sortBy, sortDirection);
        return ResponseEntity.ok(ApiResponse.<RestaurantPageResponse>builder()
                .code(1000)
                .message("Lấy danh sách nhà hàng quản trị thành công")
                .data(data)
                .build());
    }

    @PatchMapping("/{restaurantId}/confirmation-mode")
    public ResponseEntity<ApiResponse<RestaurantResponse>> changeConfirmationMode(
            @PathVariable Long restaurantId,
            @Valid @RequestBody RestaurantConfirmationModeRequest request) {
        return ResponseEntity.ok(ApiResponse.<RestaurantResponse>builder()
                .code(1000)
                .message("Cập nhật chế độ xác nhận đơn hàng thành công")
                .data(restaurantService.changeConfirmationMode(restaurantId, request.getMode()))
                .build());
    }
}
