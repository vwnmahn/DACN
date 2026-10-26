package com.example.dacn.service;

import com.example.dacn.dto.response.AdminOrderPageResponse;
import com.example.dacn.dto.response.AdminOrderResponse;
import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.dto.response.OrderStatusHistoryResponse;
import com.example.dacn.entity.OrderStatus;

import java.time.LocalDateTime;
import java.util.List;

public interface OrderManagementService {
    OrderResponse confirmByAdmin(Long orderId);
    OrderResponse updateStatusByAdmin(Long orderId, OrderStatus target);
    OrderResponse cancelMyOrder(Long orderId);
    OrderResponse completeCodByAdmin(Long orderId, boolean paymentCollected);
    AdminOrderPageResponse searchAdminOrders(Long orderId, String customer, String restaurant,
                                              OrderStatus status, LocalDateTime createdFrom,
                                              LocalDateTime createdTo, int page, int size);
    AdminOrderResponse getAdminOrder(Long orderId);
    List<OrderStatusHistoryResponse> getStatusHistory(Long orderId);
    OrderResponse cancelByAdmin(Long orderId, String reason);
    int confirmEligibleAutoOrders();
    int cancelExpiredManualOrders();
    int markExpiredPaymentsForReconciliation();
}
