package com.example.dacn;

import com.example.dacn.dto.request.DeliveryEstimateRequest;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.service.*;
import com.example.dacn.service.Impl.DeliveryServiceImpl;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DeliveryServiceImplTest {
    @Test void estimateReturnsHaversineQuoteWithoutCreatingAnything() {
        RestaurantRepository restaurants = mock(RestaurantRepository.class);
        DeliveryDistanceService distance = mock(DeliveryDistanceService.class);
        Restaurant restaurant = Restaurant.builder().id(1L).active(true).build();
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
        when(distance.calculateDelivery(eq(restaurant), any(), any()))
                .thenReturn(new DeliveryCalculation(new BigDecimal("2.345"), new BigDecimal("6.000"), new BigDecimal("17000")));
        DeliveryEstimateRequest request = new DeliveryEstimateRequest(); request.setRestaurantId(1L);
        request.setLatitude(new BigDecimal("10.78")); request.setLongitude(new BigDecimal("106.70"));

        var response = new DeliveryServiceImpl(restaurants, distance).estimate(request);

        assertEquals("HAVERSINE", response.getDistanceType());
        assertTrue(response.isWithinDeliveryArea());
        assertEquals(new BigDecimal("17000"), response.getDeliveryFee());
    }
}
