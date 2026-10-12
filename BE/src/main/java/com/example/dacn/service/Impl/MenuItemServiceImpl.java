package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.MenuItemRequest;
import com.example.dacn.dto.request.MenuItemUpdateRequest;
import com.example.dacn.dto.response.MenuItemResponse;
import com.example.dacn.entity.MenuItem;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.mapper.MenuItemMapper;
import com.example.dacn.repository.MenuItemRepository;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.service.MenuItemService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
@RequiredArgsConstructor
public class MenuItemServiceImpl implements MenuItemService {
    private final MenuItemRepository menuItemRepository;
    private final RestaurantRepository restaurantRepository;
    private final MenuItemMapper menuItemMapper;

    @Override
    @Transactional
    public MenuItemResponse create(MenuItemRequest request) {
        validatePrice(request.getPrice());
        Restaurant restaurant = restaurantRepository.findById(request.getRestaurantId())
                .orElseThrow(() -> new AppException(ErrorCode.RESTAURANT_NOT_FOUND));
        MenuItem item = menuItemMapper.toEntity(request);
        item.setRestaurant(restaurant);
        item.setName(request.getName().trim());
        item.setActive(request.getActive() == null || request.getActive());
        item.setAvailable(request.getAvailable() == null || request.getAvailable());
        return menuItemMapper.toResponse(menuItemRepository.save(item));
    }

    @Override
    @Transactional
    public MenuItemResponse update(Long id, MenuItemUpdateRequest request) {
        validatePrice(request.getPrice());
        MenuItem item = findItem(id);
        menuItemMapper.updateEntity(request, item);
        item.setName(request.getName().trim());
        return menuItemMapper.toResponse(menuItemRepository.save(item));
    }

    @Override
    @Transactional(readOnly = true)
    public MenuItemResponse getById(Long id) {
        MenuItem item = isAdmin() ? findItem(id)
                : menuItemRepository.findByIdAndActiveTrueAndRestaurantActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.MENU_ITEM_NOT_FOUND));
        return menuItemMapper.toResponse(item);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MenuItemResponse> getAll() {
        List<MenuItem> items = isAdmin() ? menuItemRepository.findAll()
                : menuItemRepository.findByActiveTrueAndRestaurantActiveTrueOrderByIdDesc();
        return items.stream().map(menuItemMapper::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MenuItemResponse> getByRestaurant(Long restaurantId, boolean availableOnly) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new AppException(ErrorCode.RESTAURANT_NOT_FOUND));
        boolean admin = isAdmin();
        if (!admin && !Boolean.TRUE.equals(restaurant.getActive()))
            throw new AppException(ErrorCode.RESTAURANT_NOT_FOUND);
        List<MenuItem> items;
        if (admin) {
            items = availableOnly
                    ? menuItemRepository.findByRestaurantIdAndActiveTrueAndAvailableTrueOrderByIdDesc(restaurantId)
                    : menuItemRepository.findByRestaurantIdOrderByIdDesc(restaurantId);
        } else {
            items = availableOnly
                    ? menuItemRepository.findByRestaurantIdAndActiveTrueAndAvailableTrueAndRestaurantActiveTrueOrderByIdDesc(restaurantId)
                    : menuItemRepository.findByRestaurantIdAndActiveTrueAndRestaurantActiveTrueOrderByIdDesc(restaurantId);
        }
        return items.stream().map(menuItemMapper::toResponse).toList();
    }

    private MenuItem findItem(Long id) {
        return menuItemRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.MENU_ITEM_NOT_FOUND));
    }

    private void validatePrice(BigDecimal price) {
        if (price == null || price.compareTo(BigDecimal.ZERO) < 0) {
            throw new AppException(ErrorCode.MENU_ITEM_INVALID_PRICE);
        }
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
