package com.example.dacn.repository;

import com.example.dacn.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    boolean existsByRestaurantId(Long restaurantId);
    List<MenuItem> findByRestaurantIdOrderByIdDesc(Long restaurantId);
    List<MenuItem> findByRestaurantIdAndActiveTrueAndAvailableTrueOrderByIdDesc(Long restaurantId);
    List<MenuItem> findByActiveTrueAndRestaurantActiveTrueOrderByIdDesc();
    List<MenuItem> findByRestaurantIdAndActiveTrueAndRestaurantActiveTrueOrderByIdDesc(Long restaurantId);
    List<MenuItem> findByRestaurantIdAndActiveTrueAndAvailableTrueAndRestaurantActiveTrueOrderByIdDesc(Long restaurantId);
    Optional<MenuItem> findByIdAndActiveTrueAndRestaurantActiveTrue(Long id);
}
