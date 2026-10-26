package com.example.dacn.service.Impl;


import com.example.dacn.dto.request.CreateTableReservationRequest;
import com.example.dacn.dto.response.TableAvailabilityResponse;
import com.example.dacn.dto.response.TableReservationResponse;
import com.example.dacn.entity.*;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.repository.RestaurantTableRepository;
import com.example.dacn.repository.TableReservationRepository;
import com.example.dacn.service.TableReservationService;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TableReservationServiceImpl implements  TableReservationService {

    private static final int RESERVATION_MINUTES = 120;
    private static final int CANCELLATION_LIMIT_MINUTES = 60;

    private static final Set<ReservationStatus> HOLDING_STATUSES =
            EnumSet.of(
                    ReservationStatus.PENDING,
                    ReservationStatus.CONFIRMED
            );

    private final RestaurantTableRepository tableRepository;
    private final TableReservationRepository reservationRepository;
    private final RestaurantRepository restaurantRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public TableAvailabilityResponse getAvailability(
            Long restaurantId,
            LocalDate date,
            LocalTime time,
            Integer guestCount
    ) {
        validateSelection(date, time, guestCount);

        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Không tìm thấy nhà hàng"));

        LocalDateTime start = LocalDateTime.of(date, time);
        LocalDateTime end = start.plusMinutes(RESERVATION_MINUTES);

        List<RestaurantTable> activeTables =
                tableRepository
                        .findByRestaurant_IdAndActiveTrueOrderByTableNumberAsc(
                                restaurantId
                        );

        List<RestaurantTable> suitableTables = activeTables.stream()
                .filter(t -> t.getCapacity() != null
                        && t.getCapacity() >= guestCount)
                .toList();

        List<Long> reservedIds =
                reservationRepository.findReservedTableIds(
                        restaurantId,
                        HOLDING_STATUSES,
                        start,
                        end
                );

        Set<Long> reservedSet = new HashSet<>(reservedIds);

        List<TableAvailabilityResponse.AvailableTableResponse> available =
                suitableTables.stream()
                        .filter(t -> !reservedSet.contains(t.getId()))
                        .map(t ->
                                new TableAvailabilityResponse
                                        .AvailableTableResponse(
                                        t.getId(),
                                        t.getTableNumber(),
                                        t.getCapacity()
                                ))
                        .toList();

        return new TableAvailabilityResponse(
                restaurant.getId(),
                date,
                time,
                end.toLocalTime(),
                guestCount,
                activeTables.size(),
                suitableTables.size(),
                available.size(),
                available
        );
    }

    @Override
    @Transactional
    public TableReservationResponse createReservation(
            CreateTableReservationRequest request
    ) {
        validateSelection(
                request.date(),
                request.time(),
                request.guestCount()
        );

        LocalDateTime start =
                LocalDateTime.of(request.date(), request.time());
        LocalDateTime end = start.plusMinutes(RESERVATION_MINUTES);

        Restaurant restaurant = restaurantRepository
                .findById(request.restaurantId())
                .orElseThrow(() ->
                        new IllegalArgumentException("Không tìm thấy nhà hàng"));

        List<RestaurantTable> suitableTables =
                tableRepository
                        .findByRestaurant_IdAndActiveTrueOrderByTableNumberAsc(
                                request.restaurantId()
                        )
                        .stream()
                        .filter(t -> t.getCapacity() != null
                                && t.getCapacity() >= request.guestCount())
                        .toList();

        if (suitableTables.isEmpty()) {
            throw new IllegalStateException(
                    "Không có bàn phù hợp với số lượng khách");
        }

        for (RestaurantTable candidate : suitableTables) {
            RestaurantTable locked = entityManager.find(
                    RestaurantTable.class,
                    candidate.getId(),
                    LockModeType.PESSIMISTIC_WRITE
            );

            if (locked == null
                    || !Boolean.TRUE.equals(locked.getActive())
                    || locked.getCapacity() < request.guestCount()) {
                continue;
            }

            long overlap =
                    reservationRepository.countOverlappingReservations(
                            locked.getId(),
                            HOLDING_STATUSES,
                            start,
                            end
                    );

            if (overlap > 0) {
                continue;
            }

            TableReservation reservation = new TableReservation();
            reservation.setRestaurant(restaurant);
            reservation.setAccount(currentAccount());
            reservation.setTable(locked);
            reservation.setCustomerName(request.customerName().trim());
            reservation.setCustomerPhone(request.customerPhone().trim());
            reservation.setGuestCount(request.guestCount());
            reservation.setStartTime(start);
            reservation.setEndTime(end);
            reservation.setStatus(ReservationStatus.PENDING);
            reservation.setNote(request.note());

            TableReservation saved =
                    reservationRepository.save(reservation);

            return toResponse(saved);
        }

        throw new IllegalStateException(
                "Bàn vừa được đặt hoặc không còn bàn phù hợp. "
                        + "Vui lòng tải lại danh sách bàn."
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<TableReservationResponse> getMyReservations() {
        return reservationRepository
                .findByAccount_IdOrderByStartTimeDesc(currentAccount().getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public TableReservationResponse cancelReservation(Long reservationId) {
        TableReservation reservation = reservationRepository
                .findByIdAndAccount_Id(reservationId, currentAccount().getId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy phiếu đặt bàn"));

        if (reservation.getStatus() != ReservationStatus.PENDING
                && reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new IllegalStateException(
                    "Phiếu đặt bàn này không thể hủy");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime cancellationDeadline =
                reservation.getStartTime()
                        .minusMinutes(CANCELLATION_LIMIT_MINUTES);

        // Phải hủy trước mốc còn đúng 60 phút.
        if (!now.isBefore(cancellationDeadline)) {
            throw new IllegalStateException(
                    "Chỉ được hủy trước giờ đặt bàn ít nhất hơn 1 tiếng. "
                            + "Vui lòng liên hệ nhà hàng để được hỗ trợ."
            );
        }

        reservation.setStatus(ReservationStatus.CANCELLED);

        TableReservation saved =
                reservationRepository.save(reservation);

        return toResponse(saved);
    }

    private Account currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account account)) {
            throw new IllegalStateException("Vui lòng đăng nhập để sử dụng chức năng đặt bàn");
        }
        return account;
    }

    private void validateSelection(
            LocalDate date,
            LocalTime time,
            Integer guestCount
    ) {
        if (date == null || time == null
                || guestCount == null
                || guestCount < 1 || guestCount > 50) {
            throw new IllegalArgumentException(
                    "Ngày, giờ hoặc số lượng khách không hợp lệ");
        }

        LocalDateTime start = LocalDateTime.of(date, time);

        if (!start.isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException(
                    "Thời gian đặt bàn phải ở tương lai");
        }
    }

    private TableReservationResponse toResponse(
            TableReservation reservation
    ) {
        return new TableReservationResponse(
                reservation.getId(),
                reservation.getRestaurant().getId(),
                reservation.getRestaurant().getName(),
                reservation.getTable().getId(),
                reservation.getTable().getTableNumber(),
                reservation.getCustomerName(),
                reservation.getCustomerPhone(),
                reservation.getGuestCount(),
                reservation.getStartTime(),
                reservation.getEndTime(),
                reservation.getStatus(),
                reservation.getNote(),
                (reservation.getStatus() == ReservationStatus.PENDING
                        || reservation.getStatus() == ReservationStatus.CONFIRMED)
                        && LocalDateTime.now().isBefore(
                                reservation.getStartTime().minusMinutes(CANCELLATION_LIMIT_MINUTES))
        );
    }
}
