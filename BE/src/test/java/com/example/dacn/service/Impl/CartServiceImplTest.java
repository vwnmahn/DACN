package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.CartItemQuantityRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceImplTest {
    @Mock CartRepository carts; @Mock CartItemRepository items;
    @Mock MenuItemRepository menus; @Mock AccountRepository accounts;
    CartServiceImpl service;

    @BeforeEach void setUp() {
        service = new CartServiceImpl(carts, items, menus, accounts);
        Account account = Account.builder().id(11L).username("user-a").build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(account, null, List.of()));
    }
    @AfterEach void cleanUp() { SecurityContextHolder.clearContext(); }

    @Test void getCurrentUsesAuthenticatedAccount() {
        Restaurant restaurant = Restaurant.builder().id(3L).name("FCA").active(true).build();
        MenuItem menu = MenuItem.builder().id(7L).restaurant(restaurant).name("Món A")
                .price(BigDecimal.valueOf(50000)).active(true).available(true).build();
        Cart cart = Cart.builder().id(5L).account(Account.builder().id(11L).build()).build();
        cart.getItems().add(CartItem.builder().id(9L).cart(cart).menuItem(menu).quantity(2).build());
        when(carts.findByAccountId(11L)).thenReturn(Optional.of(cart));
        var result = service.getCurrent();
        assertEquals(2, result.getTotalQuantity());
        assertEquals(0, BigDecimal.valueOf(100000).compareTo(result.getSubtotal()));
        verify(carts).findByAccountId(11L);
    }

    @Test void updateRejectsAnotherAccountsItem() {
        when(items.findByIdAndCartAccountId(99L, 11L)).thenReturn(Optional.empty());
        CartItemQuantityRequest request = new CartItemQuantityRequest(); request.setQuantity(2);
        assertThrows(AppException.class, () -> service.updateItem(99L, request));
        verify(items, never()).save(any());
    }

    @Test void clearOnlyUsesAuthenticatedAccountsCart() {
        Cart cart = Cart.builder().id(5L).account(Account.builder().id(11L).build()).build();
        when(carts.findByAccountIdForUpdate(11L)).thenReturn(Optional.of(cart));
        assertTrue(service.clear().getItems().isEmpty());
        verify(carts).findByAccountIdForUpdate(11L);
        verify(carts).save(cart);
    }
}
