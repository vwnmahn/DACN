
package com.example.dacn.controller;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import com.example.dacn.service.VoucherService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vouchers")
@RequiredArgsConstructor
public class VoucherController {

    private final VoucherService service;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<VoucherResponse>> create(
            @Valid @RequestBody VoucherRequest request) {

        VoucherResponse data = service.create(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<VoucherResponse>builder()
                        .code(1000)
                        .message("Tạo voucher thành công")
                        .data(data)
                        .build());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<VoucherResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody VoucherRequest request) {

        VoucherResponse data = service.update(id, request);

        return ApiResponse.<VoucherResponse>builder()
                .code(1000)
                .message("Cập nhật voucher thành công")
                .data(data)
                .build();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<VoucherResponse>> all(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Long restaurantId,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<VoucherResponse> data =
                service.getAll(active, restaurantId, pageable);

        return ApiResponse.<Page<VoucherResponse>>builder()
                .code(1000)
                .message("Lấy danh sách voucher thành công")
                .data(data)
                .build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<VoucherResponse> one(
            @PathVariable Long id) {

        VoucherResponse data = service.getById(id);

        return ApiResponse.<VoucherResponse>builder()
                .code(1000)
                .message("Lấy voucher thành công")
                .data(data)
                .build();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<VoucherResponse> status(
            @PathVariable Long id,
            @Valid @RequestBody VoucherStatusRequest request) {

        VoucherResponse data =
                service.updateStatus(id, request.getActive());

        return ApiResponse.<VoucherResponse>builder()
                .code(1000)
                .message("Cập nhật trạng thái voucher thành công")
                .data(data)
                .build();
    }

    @GetMapping("/available")
    @PreAuthorize("hasRole('USER')")
    public ApiResponse<Page<VoucherResponse>> available(
            @RequestParam(required = false) Long restaurantId,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<VoucherResponse> data =
                service.getAvailable(restaurantId, pageable);

        return ApiResponse.<Page<VoucherResponse>>builder()
                .code(1000)
                .message("Lấy voucher khả dụng thành công")
                .data(data)
                .build();
    }

    @PostMapping("/validate")
    @PreAuthorize("hasRole('USER')")
    public ApiResponse<VoucherValidationResponse> validate(
            @Valid @RequestBody VoucherValidateRequest request) {

        VoucherValidationResponse data = service.validate(request);

        return ApiResponse.<VoucherValidationResponse>builder()
                .code(1000)
                .message("Kiểm tra voucher thành công")
                .data(data)
                .build();
    }
}
