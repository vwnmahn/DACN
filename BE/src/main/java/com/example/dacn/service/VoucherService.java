package com.example.dacn.service;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import org.springframework.data.domain.*;

import java.math.BigDecimal;

public interface VoucherService {
    VoucherResponse create(VoucherRequest request);
    VoucherResponse update(Long id, VoucherRequest request);
    VoucherResponse updateStatus(Long id, boolean active);
    VoucherResponse getById(Long id);
    Page<VoucherResponse> getAll(Boolean active, Long restaurantId, Pageable pageable);
    Page<VoucherResponse> getAvailable(Long restaurantId, Pageable pageable);
    VoucherValidationResponse validate(VoucherValidateRequest request);
    BigDecimal calculateDiscount(String voucherCode, BigDecimal orderAmount);
    VoucherReservationResult reserveForOrder(String voucherCode, Long accountId, Long orderId,
                                             Long restaurantId, BigDecimal subtotal);
    void applyForOrder(Long orderId);
    void releaseForOrder(Long orderId);
}
