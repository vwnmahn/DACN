package com.example.dacn.repository;

import com.example.dacn.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    Optional<CartItem> findByIdAndCartAccountId(Long id, Long accountId);
    Optional<CartItem> findByCartIdAndMenuItemId(Long cartId, Long menuItemId);
    Optional<CartItem> findByCartAccountIdAndMenuItemId(Long accountId, Long menuItemId);
}
