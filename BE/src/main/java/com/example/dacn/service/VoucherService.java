package com.example.dacn.service;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import org.springframework.data.domain.*;

import java.math.BigDecimal;
import com.example.dacn.entity.CategoryVoucher;
import com.example.dacn.entity.Account;

public interface VoucherService {
    VoucherResponse create(VoucherRequest request);
    VoucherResponse update(Long id, VoucherRequest request);
    VoucherResponse updateStatus(Long id, boolean active);
    VoucherResponse getById(Long id);
    Page<VoucherResponse> getAll(Boolean active, Long restaurantId, Pageable pageable);
    Page<VoucherResponse> getAll(Boolean active, Long restaurantId, CategoryVoucher category, Pageable pageable);
    Page<VoucherResponse> getAvailable(Long restaurantId, Pageable pageable);
    Page<VoucherResponse> getAvailable(Long restaurantId, CategoryVoucher category, Pageable pageable);
    Page<VoucherResponse> getRedeemable(Pageable pageable);
    Page<VoucherResponse> getRedeemable(CategoryVoucher category, Pageable pageable);
    java.util.List<VoucherRedemptionResponse> getMyRedemptions();
    VoucherRedemptionResponse redeem(Long voucherId, String idempotencyKey);
    VoucherValidationResponse validate(VoucherValidateRequest request);
    BigDecimal calculateDiscount(String voucherCode, BigDecimal orderAmount);
    VoucherReservationResult reserveForOrder(String voucherCode, Long accountId, Long orderId,
                                             Long restaurantId, BigDecimal subtotal, BigDecimal deliveryFee);
    VoucherReservationResult reserveForOrder(String voucherCode, Long accountId, Long orderId,
                                             Long restaurantId, BigDecimal subtotal);
    void grantWelcomeVouchers(Account account);
    void applyForOrder(Long orderId);
    void releaseForOrder(Long orderId);
}
