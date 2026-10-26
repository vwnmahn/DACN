package com.example.dacn.repository;

import com.example.dacn.entity.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RestaurantTableRepository
        extends JpaRepository<RestaurantTable, Long> {

    // Lấy danh sách bàn đang hoạt động của một nhà hàng
    List<RestaurantTable>
    findByRestaurant_IdAndActiveTrueOrderByTableNumberAsc(
            Long restaurantId
    );

    // Tìm bàn theo nhà hàng và số bàn
    Optional<RestaurantTable> findByRestaurant_IdAndTableNumber(
            Long restaurantId,
            Integer tableNumber
    );

    // Kiểm tra số bàn đã tồn tại trong nhà hàng chưa
    boolean existsByRestaurant_IdAndTableNumber(
            Long restaurantId,
            Integer tableNumber
    );
}
