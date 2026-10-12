package com.example.dacn.service;

import com.example.dacn.entity.Restaurant;
import java.math.BigDecimal;

public interface DeliveryDistanceService {
    BigDecimal calculateDistanceKm(BigDecimal fromLatitude, BigDecimal fromLongitude,
                                   BigDecimal toLatitude, BigDecimal toLongitude);
    DeliveryCalculation calculateDelivery(Restaurant restaurant,
                                          BigDecimal customerLatitude,
                                          BigDecimal customerLongitude);
}
