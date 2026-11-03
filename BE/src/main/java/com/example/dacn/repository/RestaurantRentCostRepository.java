package com.example.dacn.repository;
import com.example.dacn.entity.RestaurantRentCost; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface RestaurantRentCostRepository extends JpaRepository<RestaurantRentCost,Long> { Optional<RestaurantRentCost> findByRestaurantIdAndYearAndMonth(Long restaurantId,Integer year,Integer month); }
