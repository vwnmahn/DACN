package com.example.dacn.repository;
import com.example.dacn.entity.RestaurantRentCostHistory; import org.springframework.data.jpa.repository.JpaRepository; import java.util.List;
public interface RestaurantRentCostHistoryRepository extends JpaRepository<RestaurantRentCostHistory,Long> {
 List<RestaurantRentCostHistory> findByRentCostRestaurantIdOrderByCreatedAtDesc(Long restaurantId);
}
