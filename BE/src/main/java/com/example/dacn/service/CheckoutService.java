package com.example.dacn.service;

import com.example.dacn.dto.request.CheckoutRequest;
import com.example.dacn.dto.response.CheckoutResponse;

public interface CheckoutService {
    CheckoutResponse checkout(CheckoutRequest request, String clientIp);
}
