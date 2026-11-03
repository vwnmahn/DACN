package com.example.dacn.controller;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import com.example.dacn.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/v1/cart") @RequiredArgsConstructor
public class CartController {
    private final CartService cartService;

    @GetMapping public ApiResponse<CartResponse> get() { return ok("Lấy giỏ hàng thành công", cartService.getCurrent()); }
    @PostMapping("/items") public ApiResponse<CartResponse> add(@Valid @RequestBody CartItemAddRequest request) {
        return ok("Thêm món vào giỏ thành công", cartService.addItem(request));
    }
    @PutMapping("/items/{itemId}") public ApiResponse<CartResponse> update(@PathVariable Long itemId,
            @Valid @RequestBody CartItemQuantityRequest request) {
        return ok("Cập nhật số lượng thành công", cartService.updateItem(itemId, request));
    }
    @DeleteMapping("/items/{itemId}") public ApiResponse<CartResponse> remove(@PathVariable Long itemId) {
        return ok("Xóa món khỏi giỏ thành công", cartService.removeItem(itemId));
    }
    @DeleteMapping public ApiResponse<CartResponse> clear() { return ok("Xóa giỏ hàng thành công", cartService.clear()); }

    private ApiResponse<CartResponse> ok(String message, CartResponse data) {
        return ApiResponse.<CartResponse>builder().code(1000).message(message).data(data).build();
    }
}
