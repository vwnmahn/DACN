package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.DeliveryAvailabilityRequest;
import com.example.dacn.dto.response.DeliveryAvailabilityResponse;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.service.DeliveryAvailabilityService;
import com.example.dacn.service.DeliveryCalculation;
import com.example.dacn.service.DeliveryDistanceService;
import com.example.dacn.service.AddressGeocodingService;
import com.example.dacn.service.GeocodedAddress;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class DeliveryAvailabilityServiceImpl
        implements DeliveryAvailabilityService {

    private final RestaurantRepository restaurantRepository;
    private final DeliveryDistanceService deliveryDistanceService;
    private final AddressGeocodingService addressGeocodingService;

    @Override
    @Transactional(readOnly = true)
    public DeliveryAvailabilityResponse checkAvailability(
            DeliveryAvailabilityRequest request) {

        if (request == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }

        Restaurant restaurant = restaurantRepository
                .findById(request.getRestaurantId())
                .orElseThrow(() ->
                        new AppException(ErrorCode.RESTAURANT_NOT_FOUND));

        if (!Boolean.TRUE.equals(restaurant.getActive())) {
            throw new AppException(ErrorCode.RESTAURANT_INACTIVE);
        }

        if (restaurant.getLatitude() == null
                || restaurant.getLongitude() == null) {
            throw new AppException(
                    ErrorCode.RESTAURANT_GPS_NOT_CONFIGURED);
        }

        BigDecimal deliveryLatitude = request.getDeliveryLatitude();
        BigDecimal deliveryLongitude = request.getDeliveryLongitude();
        if (deliveryLatitude == null || deliveryLongitude == null) {
            GeocodedAddress geocoded = addressGeocodingService.geocode(request.getDeliveryAddress());
            deliveryLatitude = geocoded.latitude();
            deliveryLongitude = geocoded.longitude();
        }

        DeliveryCalculation calculation =
                deliveryDistanceService.calculateDelivery(
                        restaurant,
                        deliveryLatitude,
                        deliveryLongitude
                );

        return DeliveryAvailabilityResponse.builder()
                .restaurantId(restaurant.getId())
                .deliverable(true)
                .distanceKm(calculation.distanceKm())
                .deliveryRadiusKm(calculation.deliveryRadiusKm())
                .deliveryFee(calculation.deliveryFee())
                .deliveryLatitude(deliveryLatitude)
                .deliveryLongitude(deliveryLongitude)
                .message("Địa chỉ nằm trong phạm vi giao hàng")
                .build();
    }
}
