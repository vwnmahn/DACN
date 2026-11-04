package com.example.dacn.service;


import com.example.dacn.dto.request.CreateTableReservationRequest;
import com.example.dacn.dto.response.TableAvailabilityResponse;
import com.example.dacn.dto.response.TableReservationResponse;
import com.example.dacn.entity.ReservationStatus;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public interface TableReservationService {

    TableAvailabilityResponse getAvailability(
            Long restaurantId,
            LocalDate date,
            LocalTime time,
            Integer guestCount
    );

    TableReservationResponse createReservation(
            CreateTableReservationRequest request
    );

    List<TableReservationResponse> getMyReservations();

    List<TableReservationResponse> getAllForAdmin();

    TableReservationResponse getByIdForAdmin(Long reservationId);

    TableReservationResponse updateStatusForAdmin(Long reservationId, ReservationStatus status);

    TableReservationResponse cancelReservation(Long reservationId);
}
