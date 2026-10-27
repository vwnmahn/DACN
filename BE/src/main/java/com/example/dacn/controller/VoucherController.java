
package com.example.dacn.controller;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import com.example.dacn.service.VoucherService;
import com.example.dacn.entity.CategoryVoucher;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ApiResponse<PageResponse<VoucherResponse>> all(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Long restaurantId,
            @RequestParam(required = false) CategoryVoucher category,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<VoucherResponse> page =
                service.getAll(active, restaurantId, category, pageable);

        return ApiResponse.<PageResponse<VoucherResponse>>builder()
                .code(1000)
                .message("Lấy danh sách voucher thành công")
                .data(PageResponse.from(page))
                .build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
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
    public ApiResponse<PageResponse<VoucherResponse>> available(
            @RequestParam(required = false) Long restaurantId,
            @RequestParam(required = false) CategoryVoucher category,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<VoucherResponse> page =
                service.getAvailable(restaurantId, category, pageable);

        return ApiResponse.<PageResponse<VoucherResponse>>builder()
                .code(1000)
                .message("Lấy voucher khả dụng thành công")
                .data(PageResponse.from(page))
                .build();
    }

    @GetMapping("/redeemable")
    @PreAuthorize("hasRole('USER')")
    public ApiResponse<PageResponse<VoucherResponse>> redeemable(
            @RequestParam(required = false) CategoryVoucher category,
            @PageableDefault(size = 20) Pageable pageable) {

        Page<VoucherResponse> page =
                service.getRedeemable(category, pageable);

        return ApiResponse.<PageResponse<VoucherResponse>>builder()
                .code(1000)
                .message("Lấy voucher đổi điểm thành công")
                .data(PageResponse.from(page))
                .build();
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('USER')")
    public ApiResponse<List<VoucherRedemptionResponse>> mine() {

        return ApiResponse.<List<VoucherRedemptionResponse>>builder()
                .code(1000)
                .message("Lấy voucher đã đổi thành công")
                .data(service.getMyRedemptions())
                .build();
    }

    @PostMapping("/{id}/redeem")
    @PreAuthorize("hasRole('USER')")
    public ApiResponse<VoucherRedemptionResponse> redeem(
            @PathVariable Long id,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {

        return ApiResponse.<VoucherRedemptionResponse>builder()
                .code(1000)
                .message("Đổi 300 điểm lấy voucher thành công")
                .data(service.redeem(id, idempotencyKey))
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
