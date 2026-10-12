package com.example.dacn.controller;

import com.example.dacn.dto.response.AdminPaymentPageResponse;
import com.example.dacn.dto.response.AdminPaymentResponse;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
import com.example.dacn.service.PaymentService;
import com.example.dacn.service.PaymentOperationsService;
import com.example.dacn.dto.request.PaymentRefundRequest;
import com.example.dacn.dto.response.PaymentReconciliationResponse;
import com.example.dacn.dto.response.PaymentRefundPageResponse;
import com.example.dacn.dto.response.PaymentRefundResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/payments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {
    private final PaymentService paymentService;
    private final PaymentOperationsService paymentOperationsService;

    @GetMapping
    public ApiResponse<AdminPaymentPageResponse> search(
            @RequestParam(required = false) PaymentStatus paymentStatus,
            @RequestParam(required = false) PaymentMethod paymentMethod,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) Long accountId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(required = false) String transactionReference,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection) {
        return ApiResponse.<AdminPaymentPageResponse>builder()
                .code(1000)
                .message("Lấy danh sách thanh toán thành công")
                .data(paymentService.searchAdminPayments(paymentStatus, paymentMethod, orderId,
                        accountId, createdFrom, createdTo, transactionReference,
                        page, size, sortBy, sortDirection))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminPaymentResponse> detail(@PathVariable Long id) {
        return ApiResponse.<AdminPaymentResponse>builder()
                .code(1000)
                .message("Lấy chi tiết thanh toán thành công")
                .data(paymentService.getAdminPayment(id))
                .build();
    }

    @GetMapping("/reconciliation")
    public ApiResponse<AdminPaymentPageResponse> reconciliation(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.<AdminPaymentPageResponse>builder().code(1000)
                .message("Lấy danh sách giao dịch cần đối soát thành công")
                .data(paymentOperationsService.reconciliationQueue(page, size)).build();
    }

    @PostMapping("/{id}/reconcile")
    public ApiResponse<PaymentReconciliationResponse> reconcile(@PathVariable Long id,
                                                                 HttpServletRequest request) {
        return ApiResponse.<PaymentReconciliationResponse>builder().code(1000)
                .message("Đã xử lý yêu cầu đối soát")
                .data(paymentOperationsService.reconcile(id, clientIp(request))).build();
    }

    @GetMapping("/refunds")
    public ApiResponse<PaymentRefundPageResponse> refunds(
            @RequestParam(required = false) com.example.dacn.entity.PaymentRefundStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.<PaymentRefundPageResponse>builder().code(1000)
                .message("Lấy danh sách hoàn tiền thành công")
                .data(paymentOperationsService.refunds(status, page, size)).build();
    }

    @PostMapping("/{id}/refund")
    public ApiResponse<PaymentRefundResponse> refund(@PathVariable Long id,
                                                     @Valid @RequestBody PaymentRefundRequest body,
                                                     HttpServletRequest request) {
        return ApiResponse.<PaymentRefundResponse>builder().code(1000)
                .message("Đã tiếp nhận yêu cầu hoàn tiền")
                .data(paymentOperationsService.refund(id, body, clientIp(request))).build();
    }

    @GetMapping("/{id}/refunds")
    public ApiResponse<List<PaymentRefundResponse>> refundHistory(@PathVariable Long id) {
        return ApiResponse.<List<PaymentRefundResponse>>builder().code(1000)
                .message("Lấy lịch sử hoàn tiền thành công")
                .data(paymentOperationsService.refundHistory(id)).build();
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded;
    }
}
