package com.example.dacn.mapper;

import com.example.dacn.dto.request.RestaurantRequest;
import com.example.dacn.dto.request.RestaurantUpdateRequest;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.entity.Restaurant;

import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface RestaurantMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "reviewCount", ignore = true)
    @Mapping(target = "averageRating", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "orderConfirmationMode", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Restaurant toEntity(RestaurantRequest request);

    RestaurantResponse toResponse(Restaurant restaurant);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "reviewCount", ignore = true)
    @Mapping(target = "averageRating", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "orderConfirmationMode", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateEntity(
            RestaurantUpdateRequest request,
            @MappingTarget Restaurant restaurant
    );

}
