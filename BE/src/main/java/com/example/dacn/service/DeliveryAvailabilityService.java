package com.example.dacn.service;

import com.example.dacn.dto.request.DeliveryAvailabilityRequest;
import com.example.dacn.dto.response.DeliveryAvailabilityResponse;

public interface DeliveryAvailabilityService {

    DeliveryAvailabilityResponse checkAvailability(
            DeliveryAvailabilityRequest request
    );
}