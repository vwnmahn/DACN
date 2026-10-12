package com.example.dacn.service;

import java.math.BigDecimal;

public record DeliveryCalculation(BigDecimal distanceKm, BigDecimal deliveryRadiusKm,
                                  BigDecimal deliveryFee) {
}
