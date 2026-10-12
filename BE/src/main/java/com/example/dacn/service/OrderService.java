package com.example.dacn.service;

import com.example.dacn.dto.request.CreateOrderRequest;
import com.example.dacn.dto.response.OrderResponse;
import java.util.List;

public interface OrderService {
    // Internal foundation for the future CheckoutService; intentionally not exposed by a controller.
    OrderResponse createOrder(CreateOrderRequest request);
    List<OrderResponse> getMyOrders();
    OrderResponse getMyOrder(Long orderId);
}
