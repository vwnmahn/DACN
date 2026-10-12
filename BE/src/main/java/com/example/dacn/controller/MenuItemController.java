package com.example.dacn.controller;

import com.example.dacn.dto.request.MenuItemRequest;
import com.example.dacn.dto.request.MenuItemUpdateRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.MenuItemResponse;
import com.example.dacn.service.MenuItemService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/menu-items")
@RequiredArgsConstructor
public class MenuItemController {
    private final MenuItemService menuItemService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<MenuItemResponse>> create(@Valid @RequestBody MenuItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<MenuItemResponse>builder()
                .code(1000).message("Tạo món ăn thành công").data(menuItemService.create(request)).build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<MenuItemResponse>> update(
            @PathVariable Long id, @Valid @RequestBody MenuItemUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.<MenuItemResponse>builder()
                .code(1000).message("Cập nhật món ăn thành công").data(menuItemService.update(id, request)).build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MenuItemResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<MenuItemResponse>builder()
                .code(1000).message("Lấy thông tin món ăn thành công").data(menuItemService.getById(id)).build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MenuItemResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.<List<MenuItemResponse>>builder()
                .code(1000).message("Lấy danh sách món ăn thành công").data(menuItemService.getAll()).build());
    }

    @GetMapping("/restaurant/{restaurantId}")
    public ResponseEntity<ApiResponse<List<MenuItemResponse>>> getByRestaurant(
            @PathVariable Long restaurantId,
            @RequestParam(defaultValue = "true") boolean availableOnly) {
        return ResponseEntity.ok(ApiResponse.<List<MenuItemResponse>>builder()
                .code(1000).message("Lấy danh sách món ăn theo nhà hàng thành công")
                .data(menuItemService.getByRestaurant(restaurantId, availableOnly)).build());
    }
}
