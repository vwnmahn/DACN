package com.example.dacn.repository;
import com.example.dacn.entity.*; import jakarta.persistence.LockModeType; import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.time.LocalDateTime; import java.util.*;
public interface RestaurantEmployeeRepository extends JpaRepository<RestaurantEmployee,Long> {
 List<RestaurantEmployee> findByRestaurantIdOrderByFullNameAsc(Long restaurantId);
 List<RestaurantEmployee> findByStatusAndTerminationEffectiveAtLessThanEqual(EmploymentStatus status, LocalDateTime deadline);
 @Query("select e from RestaurantEmployee e where e.restaurant.id=:rid and (:q is null or lower(e.fullName) like lower(concat('%',:q,'%')) or lower(e.employeeCode) like lower(concat('%',:q,'%'))) and (:position is null or e.position=:position) and (:status is null or e.status=:status) order by e.fullName")
 List<RestaurantEmployee> search(@Param("rid") Long restaurantId,@Param("q") String keyword,@Param("position") EmployeePosition position,@Param("status") EmploymentStatus status);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select e from RestaurantEmployee e where e.restaurant.id=:rid and e.position=com.example.dacn.entity.EmployeePosition.SHIPPER and e.status=com.example.dacn.entity.EmploymentStatus.ACTIVE order by e.id")
 List<RestaurantEmployee> findActiveShippersForUpdate(@Param("rid") Long restaurantId);
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 @Query("select e from RestaurantEmployee e where e.id=:id")
 Optional<RestaurantEmployee> findByIdForUpdate(@Param("id") Long id);
}
