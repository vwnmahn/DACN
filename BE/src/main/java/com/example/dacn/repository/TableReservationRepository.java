package com.example.dacn.repository;

import com.example.dacn.entity.ReservationStatus;
import com.example.dacn.entity.TableReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TableReservationRepository
        extends JpaRepository<TableReservation, Long> {
    List<TableReservation> findByAccount_IdOrderByStartTimeDesc(Long accountId);

    Optional<TableReservation> findByIdAndAccount_Id(Long reservationId, Long accountId);

    // Lấy ID các bàn đã được giữ trong khoảng thời gian yêu cầu
    @Query("""
        SELECT r.table.id
        FROM TableReservation r
        WHERE r.restaurant.id = :restaurantId
          AND r.status IN :statuses
          AND r.startTime < :requestedEnd
          AND r.endTime > :requestedStart
        """)
    List<Long> findReservedTableIds(
            @Param("restaurantId") Long restaurantId,
            @Param("statuses") Collection<ReservationStatus> statuses,
            @Param("requestedStart") LocalDateTime requestedStart,
            @Param("requestedEnd") LocalDateTime requestedEnd
    );

    // Đếm lượt đặt trùng giờ của một bàn
    @Query("""
        SELECT COUNT(r)
        FROM TableReservation r
        WHERE r.table.id = :tableId
          AND r.status IN :statuses
          AND r.startTime < :requestedEnd
          AND r.endTime > :requestedStart
        """)
    long countOverlappingReservations(
            @Param("tableId") Long tableId,
            @Param("statuses") Collection<ReservationStatus> statuses,
            @Param("requestedStart") LocalDateTime requestedStart,
            @Param("requestedEnd") LocalDateTime requestedEnd
    );

    // Lấy lịch đặt của một bàn theo trạng thái
    List<TableReservation>
    findByTable_IdAndStatusInOrderByStartTimeAsc(
            Long tableId,
            Collection<ReservationStatus> statuses
    );

    // Lấy các phiếu đặt của một nhà hàng theo trạng thái
    List<TableReservation>
    findByRestaurant_IdAndStatusInOrderByStartTimeAsc(
            Long restaurantId,
            Collection<ReservationStatus> statuses
    );
}
