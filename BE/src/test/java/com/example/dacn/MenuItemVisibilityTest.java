package com.example.dacn;

import com.example.dacn.dto.response.MenuItemResponse;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.mapper.MenuItemMapper;
import com.example.dacn.repository.*;
import com.example.dacn.service.Impl.MenuItemServiceImpl;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MenuItemVisibilityTest {
    @Mock MenuItemRepository menuItems;
    @Mock RestaurantRepository restaurants;
    @Mock MenuItemMapper mapper;
    @InjectMocks MenuItemServiceImpl service;
    Restaurant activeRestaurant;
    MenuItem inactiveItem;

    @BeforeEach void setUp() {
        activeRestaurant = Restaurant.builder().id(1L).active(true).build();
        inactiveItem = MenuItem.builder().id(2L).restaurant(activeRestaurant)
                .active(false).available(true).build();
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void userCannotViewInactiveItem() {
        authenticate(Role.USER);
        when(menuItems.findByIdAndActiveTrueAndRestaurantActiveTrue(2L)).thenReturn(Optional.empty());
        assertCode(ErrorCode.MENU_ITEM_NOT_FOUND, () -> service.getById(2L));
    }

    @Test void adminCanViewInactiveItem() {
        authenticate(Role.ADMIN);
        when(menuItems.findById(2L)).thenReturn(Optional.of(inactiveItem));
        when(mapper.toResponse(inactiveItem)).thenReturn(MenuItemResponse.builder().id(2L).active(false).build());
        assertFalse(service.getById(2L).getActive());
    }

    @Test void userCannotListItemsOfInactiveRestaurant() {
        authenticate(Role.USER);
        Restaurant inactiveRestaurant = Restaurant.builder().id(3L).active(false).build();
        when(restaurants.findById(3L)).thenReturn(Optional.of(inactiveRestaurant));
        assertCode(ErrorCode.RESTAURANT_NOT_FOUND, () -> service.getByRestaurant(3L, false));
    }

    @Test void unavailableButActiveItemRemainsVisibleWhenAvailableOnlyIsFalse() {
        authenticate(Role.USER);
        MenuItem unavailable = MenuItem.builder().id(4L).restaurant(activeRestaurant)
                .active(true).available(false).build();
        when(restaurants.findById(1L)).thenReturn(Optional.of(activeRestaurant));
        when(menuItems.findByRestaurantIdAndActiveTrueAndRestaurantActiveTrueOrderByIdDesc(1L))
                .thenReturn(List.of(unavailable));
        when(mapper.toResponse(unavailable)).thenReturn(MenuItemResponse.builder()
                .id(4L).active(true).available(false).build());
        assertFalse(service.getByRestaurant(1L, false).getFirst().getAvailable());
    }

    @Test void missingItemReturnsNotFound() {
        authenticate(Role.USER);
        when(menuItems.findByIdAndActiveTrueAndRestaurantActiveTrue(99L)).thenReturn(Optional.empty());
        assertCode(ErrorCode.MENU_ITEM_NOT_FOUND, () -> service.getById(99L));
    }

    private void authenticate(Role role) {
        Account account = Account.builder().id(1L).role(role).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                account, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }
    private void assertCode(ErrorCode expected, Runnable action) {
        AppException exception = assertThrows(AppException.class, action::run);
        assertEquals(expected, exception.getErrorCode());
    }
}
