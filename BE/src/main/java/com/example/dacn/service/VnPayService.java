package com.example.dacn.service;

import com.example.dacn.dto.response.PaymentUrlResponse;
import com.example.dacn.dto.response.VnPayIpnResponse;
import com.example.dacn.dto.response.VnPayReturnResponse;
import java.util.Map;

public interface VnPayService {
    PaymentUrlResponse createPaymentUrl(Long orderId, String locale, String clientIp);
    VnPayReturnResponse processReturn(Map<String, String> parameters);
    VnPayIpnResponse processIpn(Map<String, String> parameters);
    boolean isValidSignature(Map<String, String> parameters);
}
