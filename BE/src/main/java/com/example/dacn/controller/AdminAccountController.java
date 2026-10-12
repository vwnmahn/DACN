package com.example.dacn.controller;

import com.example.dacn.dto.request.AccountRequest.Lock;
import com.example.dacn.dto.request.AccountRequest.UpdateRole;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.Role;
import com.example.dacn.service.AdminAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/accounts")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccountController {
    private final AdminAccountService service;

    @GetMapping
    public ApiResponse<AdminAccountPageResponse> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) Boolean locked,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {
        return ok("Lấy danh sách tài khoản thành công",
                service.search(keyword, role, locked, page, size, sortBy, sortDirection));
    }

    @GetMapping("/statistics")
    public ApiResponse<AccountStatisticsResponse> statistics() {
        return ok("Lấy thống kê tài khoản thành công", service.statistics());
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminAccountResponse> getById(@PathVariable Long id) {
        return ok("Lấy thông tin tài khoản thành công", service.getById(id));
    }

    @PatchMapping("/{id}/lock")
    public ApiResponse<AdminAccountResponse> changeLock(@PathVariable Long id,
                                                        @Valid @RequestBody Lock request) {
        return ok(request.getLocked() ? "Khóa tài khoản thành công" : "Mở khóa tài khoản thành công",
                service.changeLock(id, request.getLocked()));
    }

    @PatchMapping("/{id}/role")
    public ApiResponse<AdminAccountResponse> changeRole(@PathVariable Long id,
                                                        @Valid @RequestBody UpdateRole request) {
        return ok("Cập nhật vai trò tài khoản thành công", service.changeRole(id, request.getRole()));
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().code(1000).message(message).data(data).build();
    }
}
