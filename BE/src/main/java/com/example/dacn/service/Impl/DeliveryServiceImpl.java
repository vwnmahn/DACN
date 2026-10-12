package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.DeliveryEstimateRequest;
import com.example.dacn.dto.response.DeliveryEstimateResponse;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.*;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class DeliveryServiceImpl implements DeliveryService {
    private final RestaurantRepository restaurants;
    private final DeliveryDistanceService distanceService;

    @Override @Transactional(readOnly = true)
    public DeliveryEstimateResponse estimate(DeliveryEstimateRequest request) {
        Restaurant restaurant = restaurants.findById(request.getRestaurantId())
                .orElseThrow(() -> new AppException(ErrorCode.RESTAURANT_NOT_FOUND));
        if (!Boolean.TRUE.equals(restaurant.getActive())) throw new AppException(ErrorCode.RESTAURANT_INACTIVE);
        DeliveryCalculation c = distanceService.calculateDelivery(restaurant, request.getLatitude(), request.getLongitude());
        return DeliveryEstimateResponse.builder().restaurantId(restaurant.getId()).distanceKm(c.distanceKm())
                .deliveryRadiusKm(c.deliveryRadiusKm()).withinDeliveryArea(true).deliveryFee(c.deliveryFee())
                .distanceType("HAVERSINE").build();
    }
}
