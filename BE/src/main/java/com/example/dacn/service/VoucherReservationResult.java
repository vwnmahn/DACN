package com.example.dacn.service;

import java.math.BigDecimal;

public record VoucherReservationResult(Long voucherId, String voucherCode, BigDecimal discountAmount) {
}
