package com.example.dacn.entity;

public enum ReservationStatus {
    PENDING,    // Chờ nhà hàng xác nhận
    CONFIRMED,  // Đã xác nhận
    CANCELLED,  // Đã hủy
    COMPLETED,  // Đã sử dụng xong
    NO_SHOW     // Khách không đến
}