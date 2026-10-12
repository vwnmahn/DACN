package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.RestaurantRequest;
import com.example.dacn.dto.request.RestaurantUpdateRequest;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.dto.response.RestaurantPageResponse;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.entity.OrderConfirmationMode;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.mapper.RestaurantMapper;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.repository.MenuItemRepository;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.VoucherRepository;
import com.example.dacn.service.RestaurantService;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
@RequiredArgsConstructor
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final RestaurantMapper restaurantMapper;
    private final MenuItemRepository menuItemRepository;
    private final OrderRepository orderRepository;
    private final VoucherRepository voucherRepository;

    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "id", "name", "address", "active", "orderConfirmationMode", "createdAt", "updatedAt");

    @Override
    @Transactional
    public RestaurantResponse create(RestaurantRequest request) {

        validateBusinessHours(request.getOpeningTime(), request.getClosingTime());

        String phoneNumber = request.getPhoneNumber().trim();
        String address = request.getAddress().trim();

        if (restaurantRepository.existsByPhoneNumber(phoneNumber)) {
            throw new AppException(
                    ErrorCode.RESTAURANT_PHONE_ALREADY_EXISTS
            );
        }

        if (restaurantRepository.existsByAddress(address)) {
            throw new AppException(
                    ErrorCode.RESTAURANT_ADDRESS_ALREADY_EXISTS
            );
        }

        Restaurant restaurant = restaurantMapper.toEntity(request);

        restaurant.setName(request.getName().trim());
        restaurant.setAddress(address);
        restaurant.setPhoneNumber(phoneNumber);

        restaurant.setReviewCount(0);
        restaurant.setAverageRating(0.0);
        restaurant.setActive(true);
        restaurant.setOrderConfirmationMode(OrderConfirmationMode.MANUAL);

        Restaurant saved = restaurantRepository.save(restaurant);

        return restaurantMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public RestaurantResponse update(
            Long id,
            RestaurantUpdateRequest request
    ) {

        Restaurant restaurant = findRestaurant(id);
        validateBusinessHours(request.getOpeningTime(), request.getClosingTime());

        String phoneNumber = request.getPhoneNumber().trim();
        String address = request.getAddress().trim();

        restaurantRepository.findByPhoneNumber(phoneNumber)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new AppException(
                                ErrorCode.RESTAURANT_PHONE_ALREADY_EXISTS
                        );
                    }
                });

        restaurantRepository.findByAddress(address)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(id)) {
                        throw new AppException(
                                ErrorCode.RESTAURANT_ADDRESS_ALREADY_EXISTS
                        );
                    }
                });

        restaurantMapper.updateEntity(request, restaurant);

        restaurant.setName(request.getName().trim());
        restaurant.setAddress(address);
        restaurant.setPhoneNumber(phoneNumber);

        Restaurant saved = restaurantRepository.save(restaurant);

        return restaurantMapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public RestaurantResponse getById(Long id) {
        Restaurant restaurant = isAdmin() ? findRestaurant(id)
                : restaurantRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new AppException(ErrorCode.RESTAURANT_NOT_FOUND));

        return restaurantMapper.toResponse(restaurant);
    }

    @Override
    @Transactional(readOnly = true)
    public RestaurantResponse getByPhoneNumber(String phoneNumber) {

        Restaurant restaurant = (isAdmin()
                ? restaurantRepository.findByPhoneNumber(phoneNumber.trim())
                : restaurantRepository.findByPhoneNumberAndActiveTrue(phoneNumber.trim()))
                .orElseThrow(() -> new AppException(
                        ErrorCode.RESTAURANT_PHONE_NOT_FOUND
                ));

        return restaurantMapper.toResponse(restaurant);
    }

    @Override
    @Transactional(readOnly = true)
    public RestaurantResponse getByAddress(String address) {

        Restaurant restaurant = (isAdmin()
                ? restaurantRepository.findByAddress(address.trim())
                : restaurantRepository.findByAddressAndActiveTrue(address.trim()))
                .orElseThrow(() -> new AppException(
                        ErrorCode.RESTAURANT_ADDRESS_NOT_FOUND
                ));

        return restaurantMapper.toResponse(restaurant);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RestaurantResponse> getAll() {
        return restaurantRepository.findByActiveTrue()
                .stream()
                .map(restaurantMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RestaurantResponse> getActive() {

        return restaurantRepository.findByActiveTrue()
                .stream()
                .map(restaurantMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public RestaurantPageResponse getActivePage(int page, int size, String sortBy, String sortDirection) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || !ALLOWED_SORT_FIELDS.contains(sortBy))
            throw new AppException(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST);
        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(sortDirection);
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST);
        }
        Page<RestaurantResponse> result = restaurantRepository
                .findByActiveTrue(PageRequest.of(page, size, Sort.by(direction, sortBy)))
                .map(restaurantMapper::toResponse);
        return RestaurantPageResponse.builder().content(result.getContent()).page(result.getNumber())
                .size(result.getSize()).totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages()).sortBy(sortBy)
                .sortDirection(direction.name().toLowerCase(Locale.ROOT)).build();
    }

    @Override
    @Transactional
    public RestaurantResponse changeStatus(Long id, boolean active) {

        Restaurant restaurant = findRestaurant(id);

        if (Boolean.valueOf(active).equals(restaurant.getActive())) {

            if (active) {
                throw new AppException(
                        ErrorCode.RESTAURANT_ALREADY_ACTIVE
                );
            }

            throw new AppException(
                    ErrorCode.RESTAURANT_ALREADY_INACTIVE
            );
        }

        restaurant.setActive(active);

        Restaurant saved = restaurantRepository.save(restaurant);

        return restaurantMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void delete(Long id) {

        Restaurant restaurant = findRestaurant(id);
        if (menuItemRepository.existsByRestaurantId(id)
                || orderRepository.existsByRestaurantId(id)
                || voucherRepository.existsByRestaurantId(id)) {
            throw new AppException(ErrorCode.RESTAURANT_HAS_RELATED_DATA);
        }

        try {
            restaurantRepository.delete(restaurant);
            restaurantRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            // Protect against a relation inserted between the pre-check and delete.
            throw new AppException(ErrorCode.RESTAURANT_HAS_RELATED_DATA);
        }
    }

    @Override
    @Transactional
    public RestaurantResponse changeConfirmationMode(Long id, OrderConfirmationMode mode) {
        if (mode == null) {
            throw new AppException(ErrorCode.INVALID_REQUEST);
        }
        Restaurant restaurant = findRestaurant(id);
        restaurant.setOrderConfirmationMode(mode);
        return restaurantMapper.toResponse(restaurantRepository.save(restaurant));
    }

    @Override
    @Transactional(readOnly = true)
    public RestaurantPageResponse search(String keyword, Boolean active,
                                         OrderConfirmationMode confirmationMode, int page, int size,
                                         String sortBy, String sortDirection) {
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE || !ALLOWED_SORT_FIELDS.contains(sortBy)) {
            throw new AppException(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST);
        }

        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(sortDirection);
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST);
        }

        String normalizedKeyword = keyword == null ? null : keyword.trim().toLowerCase(Locale.ROOT);
        Specification<Restaurant> specification = (root, query, builder) -> builder.conjunction();
        if (normalizedKeyword != null && !normalizedKeyword.isEmpty()) {
            String pattern = "%" + normalizedKeyword + "%";
            specification = specification.and((root, query, builder) -> builder.or(
                    builder.like(builder.lower(root.get("name")), pattern),
                    builder.like(builder.lower(root.get("address")), pattern)));
        }
        if (active != null) {
            specification = specification.and((root, query, builder) -> builder.equal(root.get("active"), active));
        }
        if (confirmationMode != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("orderConfirmationMode"), confirmationMode));
        }

        Page<RestaurantResponse> result = restaurantRepository
                .findAll(specification, PageRequest.of(page, size, Sort.by(direction, sortBy)))
                .map(restaurantMapper::toResponse);
        return RestaurantPageResponse.builder()
                .content(result.getContent())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .sortBy(sortBy)
                .sortDirection(direction.name().toLowerCase(Locale.ROOT))
                .build();
    }

    private Restaurant findRestaurant(Long id) {

        return restaurantRepository.findById(id)
                .orElseThrow(() -> new AppException(
                        ErrorCode.RESTAURANT_NOT_FOUND
                ));
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private void validateBusinessHours(java.time.LocalTime openingTime, java.time.LocalTime closingTime) {
        // closing before opening explicitly represents an overnight schedule.
        // Equal values would make the restaurant permanently closed in checkout logic.
        if (openingTime.equals(closingTime)) {
            throw new AppException(ErrorCode.RESTAURANT_INVALID_CLOSING_TIME);
        }
    }
}
