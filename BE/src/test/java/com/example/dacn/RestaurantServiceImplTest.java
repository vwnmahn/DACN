package com.example.dacn;

import com.example.dacn.dto.request.RestaurantRequest;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.entity.OrderConfirmationMode;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.mapper.RestaurantMapper;
import com.example.dacn.repository.MenuItemRepository;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.RestaurantRepository;
import com.example.dacn.repository.VoucherRepository;
import com.example.dacn.service.Impl.RestaurantServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;

@ExtendWith(MockitoExtension.class)
class RestaurantServiceImplTest {
    @Mock RestaurantRepository restaurantRepository;
    @Mock RestaurantMapper restaurantMapper;
    @Mock MenuItemRepository menuItemRepository;
    @Mock OrderRepository orderRepository;
    @Mock VoucherRepository voucherRepository;
    @InjectMocks RestaurantServiceImpl service;

    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test void publicPageOnlyQueriesActiveRestaurants() {
        Restaurant entity = Restaurant.builder().id(1L).active(true).build();
        when(restaurantRepository.findByActiveTrue(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        when(restaurantMapper.toResponse(entity)).thenReturn(RestaurantResponse.builder().id(1L).build());
        var result = service.getActivePage(0, 10, "name", "asc");
        assertEquals(1, result.getTotalElements());
        verify(restaurantRepository).findByActiveTrue(any(Pageable.class));
        verify(restaurantRepository, never()).findAll(any(Pageable.class));
    }

    @Test void userCannotViewInactiveRestaurantButAdminCan() {
        Restaurant inactive = Restaurant.builder().id(9L).active(false).build();
        authenticate(Role.USER);
        when(restaurantRepository.findByIdAndActiveTrue(9L)).thenReturn(Optional.empty());
        AppException hidden = assertThrows(AppException.class, () -> service.getById(9L));
        assertEquals(ErrorCode.RESTAURANT_NOT_FOUND, hidden.getErrorCode());

        authenticate(Role.ADMIN);
        when(restaurantRepository.findById(9L)).thenReturn(Optional.of(inactive));
        when(restaurantMapper.toResponse(inactive)).thenReturn(RestaurantResponse.builder().id(9L).active(false).build());
        assertFalse(service.getById(9L).getActive());
    }

    @Test
    void searchSupportsCombinedCriteriaAndReturnsPageMetadata() {
        Restaurant entity = Restaurant.builder().id(7L).name("FCA Food").build();
        RestaurantResponse response = RestaurantResponse.builder().id(7L).name("FCA Food").build();
        when(restaurantRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));
        when(restaurantMapper.toResponse(entity)).thenReturn(response);

        var result = service.search("  fCa  ", true, OrderConfirmationMode.MANUAL,
                0, 20, "name", "DESC");

        assertEquals(1, result.getTotalElements());
        assertEquals(1, result.getTotalPages());
        assertEquals("name", result.getSortBy());
        assertEquals("desc", result.getSortDirection());
        assertEquals(7L, result.getContent().getFirst().getId());
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(restaurantRepository).findAll(any(Specification.class), pageable.capture());
        assertEquals(20, pageable.getValue().getPageSize());
        assertTrue(pageable.getValue().getSort().getOrderFor("name").isDescending());
    }

    @Test
    void searchRejectsOversizedPageAndUnknownSort() {
        AppException oversized = assertThrows(AppException.class,
                () -> service.search(null, null, null, 0, 101, "id", "asc"));
        assertEquals(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST, oversized.getErrorCode());

        AppException unknownSort = assertThrows(AppException.class,
                () -> service.search(null, null, null, 0, 20, "phoneNumber", "asc"));
        assertEquals(ErrorCode.RESTAURANT_INVALID_PAGE_REQUEST, unknownSort.getErrorCode());
    }

    @Test
    void createAcceptsOvernightHoursButRejectsEqualHours() {
        RestaurantRequest overnight = validRequest(LocalTime.of(20, 0), LocalTime.of(2, 0));
        Restaurant mapped = Restaurant.builder().build();
        when(restaurantMapper.toEntity(overnight)).thenReturn(mapped);
        when(restaurantRepository.save(mapped)).thenReturn(mapped);
        when(restaurantMapper.toResponse(mapped)).thenReturn(RestaurantResponse.builder().build());
        assertDoesNotThrow(() -> service.create(overnight));

        RestaurantRequest equal = validRequest(LocalTime.of(8, 0), LocalTime.of(8, 0));
        AppException exception = assertThrows(AppException.class, () -> service.create(equal));
        assertEquals(ErrorCode.RESTAURANT_INVALID_CLOSING_TIME, exception.getErrorCode());
    }

    @Test
    void deleteRejectsRestaurantWithRelatedMenuItemsWithoutDeleting() {
        Restaurant restaurant = Restaurant.builder().id(5L).build();
        when(restaurantRepository.findById(5L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.existsByRestaurantId(5L)).thenReturn(true);

        AppException exception = assertThrows(AppException.class, () -> service.delete(5L));

        assertEquals(ErrorCode.RESTAURANT_HAS_RELATED_DATA, exception.getErrorCode());
        verify(restaurantRepository, never()).delete(any(Restaurant.class));
    }

    @Test
    void deleteChecksOrdersAndVouchersBeforePhysicalDelete() {
        Restaurant restaurant = Restaurant.builder().id(5L).build();
        when(restaurantRepository.findById(5L)).thenReturn(Optional.of(restaurant));
        when(orderRepository.existsByRestaurantId(5L)).thenReturn(true);
        assertThrows(AppException.class, () -> service.delete(5L));
        verify(voucherRepository, never()).existsByRestaurantId(anyLong());
        verify(restaurantRepository, never()).delete(any(Restaurant.class));
    }

    private RestaurantRequest validRequest(LocalTime opening, LocalTime closing) {
        RestaurantRequest request = new RestaurantRequest();
        request.setName("FCA");
        request.setAddress("District 1");
        request.setPhoneNumber("0900000000");
        request.setOpeningTime(opening);
        request.setClosingTime(closing);
        return request;
    }
    private void authenticate(Role role) {
        Account account = Account.builder().id(1L).role(role).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                account, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }
}
