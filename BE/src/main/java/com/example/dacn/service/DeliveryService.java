package com.example.dacn.service;

import com.example.dacn.dto.request.DeliveryEstimateRequest;
import com.example.dacn.dto.response.DeliveryEstimateResponse;

public interface DeliveryService {
    DeliveryEstimateResponse estimate(DeliveryEstimateRequest request);
}
