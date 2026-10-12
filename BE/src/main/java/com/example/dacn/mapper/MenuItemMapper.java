package com.example.dacn.mapper;

import com.example.dacn.dto.request.MenuItemRequest;
import com.example.dacn.dto.request.MenuItemUpdateRequest;
import com.example.dacn.dto.response.MenuItemResponse;
import com.example.dacn.entity.MenuItem;
import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface MenuItemMapper {
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "restaurant", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    MenuItem toEntity(MenuItemRequest request);

    @Mapping(target = "restaurantId", source = "restaurant.id")
    @Mapping(target = "restaurantName", source = "restaurant.name")
    MenuItemResponse toResponse(MenuItem menuItem);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "restaurant", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateEntity(MenuItemUpdateRequest request, @MappingTarget MenuItem menuItem);
}
