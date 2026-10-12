package com.example.dacn;

import com.example.dacn.entity.OrderConfirmationMode;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.repository.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminRestaurantIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired RestaurantRepository restaurantRepository;

    @BeforeEach
    void seedRestaurants() {
        restaurantRepository.save(restaurant("FCA Central", "District 1", true, OrderConfirmationMode.MANUAL));
        restaurantRepository.save(restaurant("Night Kitchen", "District 7", false, OrderConfirmationMode.AUTO));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanCombineSearchFiltersPaginationAndSorting() throws Exception {
        mockMvc.perform(get("/api/v1/admin/restaurants")
                        .param("keyword", "central")
                        .param("active", "true")
                        .param("confirmationMode", "MANUAL")
                        .param("page", "0").param("size", "10")
                        .param("sortBy", "name").param("sortDirection", "desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000))
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].name").value("FCA Central"))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(1));
    }

    @Test
    @WithMockUser(roles = "USER")
    void userCannotAccessAdminRestaurantSearch() throws Exception {
        mockMvc.perform(get("/api/v1/admin/restaurants"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));
    }

    @Test
    void anonymousCannotAccessAdminRestaurantSearch() throws Exception {
        mockMvc.perform(get("/api/v1/admin/restaurants"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(1009));
    }

    private Restaurant restaurant(String name, String address, boolean active, OrderConfirmationMode mode) {
        return Restaurant.builder()
                .name(name).address(address).phoneNumber(active ? "0901111111" : "0902222222")
                .openingTime(LocalTime.of(8, 0)).closingTime(LocalTime.of(22, 0))
                .deliveryFee(new BigDecimal("15000")).deliveryRadiusKm(10.0)
                .latitude(new BigDecimal("10.7700000")).longitude(new BigDecimal("106.6700000"))
                .baseDistanceKm(new BigDecimal("3.000")).additionalFeePerKm(new BigDecimal("5000"))
                .reviewCount(0).averageRating(0.0).active(active).orderConfirmationMode(mode)
                .build();
    }
}
