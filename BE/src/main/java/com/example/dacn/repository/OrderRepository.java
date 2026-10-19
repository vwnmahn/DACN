package com.example.dacn.repository;

import com.example.dacn.entity.Order;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {
    boolean existsByRestaurantId(Long restaurantId);
    @EntityGraph(attributePaths = {"restaurant", "items", "items.menuItem"})
    List<Order> findByAccountIdOrderByIdDesc(Long accountId);

    @EntityGraph(attributePaths = {"restaurant", "items", "items.menuItem"})
    Optional<Order> findByIdAndAccountId(Long id, Long accountId);

    @EntityGraph(attributePaths = {"restaurant", "items", "items.menuItem"})
    Optional<Order> findByAccountIdAndIdempotencyKey(Long accountId, String idempotencyKey);

    @Override
    @EntityGraph(attributePaths = {"account", "restaurant"})
    Page<Order> findAll(Specification<Order> specification, Pageable pageable);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items i "
            + "LEFT JOIN FETCH i.menuItem WHERE o.id IN :ids")
    List<Order> fetchItemsForOrders(@Param("ids") List<Long> ids);

    @EntityGraph(attributePaths = {"account", "restaurant", "items", "items.menuItem"})
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findAdminDetailById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o JOIN FETCH o.account WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.status = com.example.dacn.entity.OrderStatus.PENDING "
            + "AND o.confirmationDeadline IS NOT NULL AND o.confirmationDeadline <= :now ORDER BY o.id")
    List<Order> findExpiredPendingForUpdate(@Param("now") LocalDateTime now, Pageable pageable);

    long countByAccountIdAndLoyaltyPointsAwardedTrueAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
            Long accountId, LocalDateTime start, LocalDateTime end);
}
