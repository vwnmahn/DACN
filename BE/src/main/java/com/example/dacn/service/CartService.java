package com.example.dacn.service;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.CartResponse;

public interface CartService {
    CartResponse getCurrent();
    CartResponse addItem(CartItemAddRequest request);
    CartResponse updateItem(Long itemId, CartItemQuantityRequest request);
    CartResponse removeItem(Long itemId);
    CartResponse clear();
}
