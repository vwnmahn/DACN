package com.example.dacn.repository;

import com.example.dacn.entity.Cart;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {
    @EntityGraph(attributePaths = {"items", "items.menuItem", "items.menuItem.restaurant"})
    Optional<Cart> findByAccountId(Long accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cart c where c.account.id = :accountId")
    Optional<Cart> findByAccountIdForUpdate(@Param("accountId") Long accountId);
}
