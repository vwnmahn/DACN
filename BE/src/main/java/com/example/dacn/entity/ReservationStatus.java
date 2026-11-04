package com.example.dacn.entity;

public enum ReservationStatus {
    PENDING,    // Dữ liệu cũ trước khi đặt bàn được tự động xác nhận
    CONFIRMED,  // Đã xác nhận
    CANCELLED,  // Đã hủy
    COMPLETED,  // Đã sử dụng xong
    NO_SHOW     // Khách không đến
}
