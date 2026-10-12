package com.example.dacn.service;

import com.example.dacn.dto.request.MenuItemRequest;
import com.example.dacn.dto.request.MenuItemUpdateRequest;
import com.example.dacn.dto.response.MenuItemResponse;
import java.util.List;

public interface MenuItemService {
    MenuItemResponse create(MenuItemRequest request);
    MenuItemResponse update(Long id, MenuItemUpdateRequest request);
    MenuItemResponse getById(Long id);
    List<MenuItemResponse> getAll();
    List<MenuItemResponse> getByRestaurant(Long restaurantId, boolean availableOnly);
}
