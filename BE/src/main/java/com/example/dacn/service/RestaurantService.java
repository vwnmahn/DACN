package com.example.dacn.service;

import com.example.dacn.dto.request.RestaurantRequest;
import com.example.dacn.dto.request.RestaurantUpdateRequest;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.dto.response.RestaurantPageResponse;

import java.util.List;
import com.example.dacn.entity.OrderConfirmationMode;

public interface RestaurantService {

    RestaurantResponse create(RestaurantRequest request);

    RestaurantResponse update(Long id, RestaurantUpdateRequest request);

    RestaurantResponse getById(Long id);

    RestaurantResponse getByPhoneNumber(String phoneNumber);

    RestaurantResponse getByAddress(String address);

    List<RestaurantResponse> getAll();

    List<RestaurantResponse> getActive();

    RestaurantPageResponse getActivePage(int page, int size, String sortBy, String sortDirection);

    RestaurantResponse changeStatus(Long id, boolean active);

    void delete(Long id);

    RestaurantResponse changeConfirmationMode(Long id, OrderConfirmationMode mode);

    RestaurantPageResponse search(String keyword, Boolean active, OrderConfirmationMode confirmationMode,
                                  int page, int size, String sortBy, String sortDirection);
}
