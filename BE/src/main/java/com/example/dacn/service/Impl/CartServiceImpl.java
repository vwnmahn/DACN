package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.CartResponse;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor
public class CartServiceImpl implements CartService {
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final MenuItemRepository menuItemRepository;
    private final AccountRepository accountRepository;

    @Override @Transactional(readOnly = true)
    public CartResponse getCurrent() {
        Long accountId = accountId();
        return cartRepository.findByAccountId(accountId).map(this::response)
                .orElseGet(() -> emptyResponse());
    }

    @Override @Transactional
    public CartResponse addItem(CartItemAddRequest request) {
        Long accountId = accountId();
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_EXISTED));
        Cart cart = cartRepository.findByAccountIdForUpdate(accountId)
                .orElseGet(() -> cartRepository.save(Cart.builder()
                        .account(account)
                        .build()));
        MenuItem menu = activeMenuItem(request.getMenuItemId());
        if (!cart.getItems().isEmpty() && cart.getItems().stream().anyMatch(
                item -> !item.getMenuItem().getRestaurant().getId().equals(menu.getRestaurant().getId()))) {
            throw new AppException(ErrorCode.MENU_ITEM_NOT_IN_RESTAURANT);
        }
        CartItem item = cartItemRepository.findByCartIdAndMenuItemId(cart.getId(), menu.getId())
                .orElseGet(() -> CartItem.builder().cart(cart).menuItem(menu).quantity(0).build());
        int quantity = item.getQuantity() + request.getQuantity();
        if (quantity > 100) throw new AppException(ErrorCode.ORDER_INVALID_QUANTITY);
        item.setQuantity(quantity);
        cartItemRepository.save(item);
        return response(reload(cart.getId()));
    }

    @Override @Transactional
    public CartResponse updateItem(Long itemId, CartItemQuantityRequest request) {
        Long accountId = accountId();
        CartItem item = cartItemRepository.findByIdAndCartAccountId(itemId, accountId)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));
        activeMenuItem(item.getMenuItem().getId());
        item.setQuantity(request.getQuantity());
        if (request.getNote() != null) {
            String note = request.getNote().trim();
            item.setNote(note.isEmpty() ? null : note);
        }
        cartItemRepository.save(item);
        return response(reload(item.getCart().getId()));
    }

    @Override @Transactional
    public CartResponse removeItem(Long itemId) {
        Long accountId = accountId();
        CartItem item = cartItemRepository.findByIdAndCartAccountId(itemId, accountId)
                .orElseThrow(() -> new AppException(ErrorCode.CART_ITEM_NOT_FOUND));
        Long cartId = item.getCart().getId();
        cartItemRepository.delete(item);
        cartItemRepository.flush();
        return response(reload(cartId));
    }

    @Override @Transactional
    public CartResponse clear() {
        Long accountId = accountId();
        Optional<Cart> cart = cartRepository.findByAccountIdForUpdate(accountId);
        cart.ifPresent(value -> { value.getItems().clear(); cartRepository.save(value); });
        return cart.map(this::response).orElseGet(this::emptyResponse);
    }

    private MenuItem activeMenuItem(Long id) {
        MenuItem item = menuItemRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.MENU_ITEM_NOT_FOUND));
        if (!Boolean.TRUE.equals(item.getActive()) || !Boolean.TRUE.equals(item.getAvailable())
                || !Boolean.TRUE.equals(item.getRestaurant().getActive())) {
            throw new AppException(ErrorCode.MENU_ITEM_UNAVAILABLE);
        }
        return item;
    }

    private Cart reload(Long id) {
        return cartRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.CART_NOT_FOUND));
    }

    private CartResponse response(Cart cart) {
        List<CartResponse.Item> items = cart.getItems().stream().sorted(Comparator.comparing(CartItem::getId))
                .map(i -> CartResponse.Item.builder().id(i.getId()).menuItemId(i.getMenuItem().getId())
                        .restaurantId(i.getMenuItem().getRestaurant().getId())
                        .restaurantName(i.getMenuItem().getRestaurant().getName()).name(i.getMenuItem().getName())
                        .description(i.getMenuItem().getDescription()).price(i.getMenuItem().getPrice())
                        .imageUrl(i.getMenuItem().getImageUrl()).quantity(i.getQuantity()).note(i.getNote())
                        .lineTotal(i.getMenuItem().getPrice().multiply(BigDecimal.valueOf(i.getQuantity()))).build())
                .toList();
        return CartResponse.builder().id(cart.getId()).items(items)
                .totalQuantity(items.stream().mapToInt(CartResponse.Item::getQuantity).sum())
                .subtotal(items.stream().map(CartResponse.Item::getLineTotal).reduce(BigDecimal.ZERO, BigDecimal::add)).build();
    }

    private CartResponse emptyResponse() {
        return CartResponse.builder().items(List.of()).totalQuantity(0).subtotal(BigDecimal.ZERO).build();
    }

    private Long accountId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof Account account))
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        return account.getId();
    }
}
