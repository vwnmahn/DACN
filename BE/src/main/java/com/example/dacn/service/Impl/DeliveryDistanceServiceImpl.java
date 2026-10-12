package com.example.dacn.service.Impl;

import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.*;
import com.example.dacn.service.*;
import org.springframework.stereotype.Service;
import java.math.*;

@Service
public class DeliveryDistanceServiceImpl implements DeliveryDistanceService {
    private static final double EARTH_RADIUS_KM = 6371.0;

    @Override
    public BigDecimal calculateDistanceKm(BigDecimal lat1, BigDecimal lon1, BigDecimal lat2, BigDecimal lon2) {
        validateCoordinate(lat1, lon1); validateCoordinate(lat2, lon2);
        double p1 = Math.toRadians(lat1.doubleValue()), p2 = Math.toRadians(lat2.doubleValue());
        double dp = Math.toRadians(lat2.subtract(lat1).doubleValue());
        double dl = Math.toRadians(lon2.subtract(lon1).doubleValue());
        double a = Math.pow(Math.sin(dp / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2);
        a = Math.max(0, Math.min(1, a));
        double raw = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return BigDecimal.valueOf(raw);
    }

    @Override
    public DeliveryCalculation calculateDelivery(Restaurant r, BigDecimal customerLat, BigDecimal customerLon) {
        if (r == null || r.getLatitude() == null || r.getLongitude() == null)
            throw new AppException(ErrorCode.RESTAURANT_GPS_NOT_CONFIGURED);
        validatePolicy(r);
        BigDecimal raw = calculateDistanceKm(r.getLatitude(), r.getLongitude(), customerLat, customerLon);
        BigDecimal radius = BigDecimal.valueOf(r.getDeliveryRadiusKm());
        if (raw.compareTo(radius) > 0) throw new AppException(ErrorCode.DELIVERY_DISTANCE_EXCEEDED);
        BigDecimal excess = raw.subtract(r.getBaseDistanceKm()).max(BigDecimal.ZERO);
        BigDecimal fee = r.getDeliveryFee().add(excess.multiply(r.getAdditionalFeePerKm()))
                .setScale(0, RoundingMode.HALF_UP);
        return new DeliveryCalculation(raw.setScale(3, RoundingMode.HALF_UP),
                radius.setScale(3, RoundingMode.HALF_UP), fee);
    }

    private void validateCoordinate(BigDecimal lat, BigDecimal lon) {
        if (lat == null || lon == null || lat.compareTo(new BigDecimal("-90")) < 0
                || lat.compareTo(new BigDecimal("90")) > 0 || lon.compareTo(new BigDecimal("-180")) < 0
                || lon.compareTo(new BigDecimal("180")) > 0)
            throw new AppException(ErrorCode.INVALID_GPS_COORDINATES);
    }

    private void validatePolicy(Restaurant r) {
        if (r.getDeliveryRadiusKm() == null || !Double.isFinite(r.getDeliveryRadiusKm()) || r.getDeliveryRadiusKm() <= 0
                || r.getDeliveryFee() == null || r.getDeliveryFee().signum() < 0
                || r.getBaseDistanceKm() == null || r.getBaseDistanceKm().signum() < 0
                || r.getAdditionalFeePerKm() == null || r.getAdditionalFeePerKm().signum() < 0)
            throw new AppException(ErrorCode.RESTAURANT_DELIVERY_POLICY_INVALID);
    }
}
