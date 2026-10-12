package com.example.dacn.repository;

import com.example.dacn.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, Long>, JpaSpecificationExecutor<Restaurant> {

    List<Restaurant> findByActiveTrue();
    Page<Restaurant> findByActiveTrue(Pageable pageable);
    Optional<Restaurant> findByIdAndActiveTrue(Long id);
    Optional<Restaurant> findByPhoneNumberAndActiveTrue(String phoneNumber);
    Optional<Restaurant> findByAddressAndActiveTrue(String address);

    boolean existsByPhoneNumber(String phoneNumber);

    boolean existsByAddress(String address);

    Optional<Restaurant> findByPhoneNumber(String phoneNumber);

    Optional<Restaurant> findByAddress(String address);
}
