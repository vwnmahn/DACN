package com.example.dacn;

import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.*;
import com.example.dacn.service.Impl.DeliveryDistanceServiceImpl;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class DeliveryDistanceServiceImplTest {
    private final DeliveryDistanceServiceImpl service = new DeliveryDistanceServiceImpl();

    @Test void zeroDistanceUsesBaseFee() {
        var result = service.calculateDelivery(restaurant(6, "15000", "2", "5000"), bd("10.77"), bd("106.69"));
        assertEquals(new BigDecimal("0.000"), result.distanceKm());
        assertEquals(new BigDecimal("15000"), result.deliveryFee());
    }

    @Test void invalidCoordinatesAreRejected() {
        AppException e = assertThrows(AppException.class,
                () -> service.calculateDistanceKm(bd("91"), bd("0"), bd("0"), bd("0")));
        assertEquals(ErrorCode.INVALID_GPS_COORDINATES, e.getErrorCode());
    }

    @Test void withinRangeAndAdditionalFeeAreCalculated() {
        Restaurant r = restaurant(10, "10000", "1", "5000");
        var result = service.calculateDelivery(r, bd("10.797"), bd("106.69"));
        assertTrue(result.distanceKm().compareTo(new BigDecimal("2.9")) > 0);
        assertTrue(result.deliveryFee().compareTo(new BigDecimal("10000")) > 0);
    }

    @Test void exactRadiusBoundaryIsAccepted() {
        Restaurant r = restaurant(1, "10000", "0", "0");
        BigDecimal targetLat = bd("10.779");
        BigDecimal raw = service.calculateDistanceKm(r.getLatitude(), r.getLongitude(), targetLat, r.getLongitude());
        r.setDeliveryRadiusKm(raw.doubleValue());
        assertDoesNotThrow(() -> service.calculateDelivery(r, targetLat, r.getLongitude()));
    }

    @Test void outsideRadiusIsRejectedBeforeRounding() {
        AppException e = assertThrows(AppException.class,
                () -> service.calculateDelivery(restaurant(1, "10000", "1", "5000"), bd("10.80"), bd("106.69")));
        assertEquals(ErrorCode.DELIVERY_DISTANCE_EXCEEDED, e.getErrorCode());
    }

    @Test void missingGpsAndInvalidPolicyAreRejected() {
        Restaurant missing = restaurant(6, "10000", "2", "5000"); missing.setLatitude(null);
        assertEquals(ErrorCode.RESTAURANT_GPS_NOT_CONFIGURED,
                assertThrows(AppException.class, () -> service.calculateDelivery(missing, bd("10"), bd("106"))).getErrorCode());
        Restaurant invalid = restaurant(6, "-1", "2", "5000");
        assertEquals(ErrorCode.RESTAURANT_DELIVERY_POLICY_INVALID,
                assertThrows(AppException.class, () -> service.calculateDelivery(invalid, bd("10"), bd("106"))).getErrorCode());
    }

    private Restaurant restaurant(double radius, String baseFee, String baseKm, String perKm) {
        return Restaurant.builder().id(1L).latitude(bd("10.77")).longitude(bd("106.69"))
                .deliveryRadiusKm(radius).deliveryFee(bd(baseFee)).baseDistanceKm(bd(baseKm))
                .additionalFeePerKm(bd(perKm)).build();
    }
    private BigDecimal bd(String v) { return new BigDecimal(v); }
}
