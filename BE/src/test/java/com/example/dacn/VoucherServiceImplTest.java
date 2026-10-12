package com.example.dacn;

import com.example.dacn.dto.request.VoucherRequest;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.Impl.VoucherServiceImpl;
import com.example.dacn.service.DeliveryDistanceService;
import com.example.dacn.service.DeliveryCalculation;
import com.example.dacn.dto.request.VoucherValidateRequest;
import org.springframework.data.domain.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VoucherServiceImplTest {
    @Mock VoucherRepository vouchers;
    @Mock VoucherUsageRepository usages;
    @Mock RestaurantRepository restaurants;
    @Mock MenuItemRepository menuItems;
    @Mock DeliveryDistanceService deliveryDistanceService;
    VoucherServiceImpl service;
    final LocalDateTime now = LocalDateTime.of(2026, 10, 12, 12, 0);

    @BeforeEach void setup() {
        service = new VoucherServiceImpl(vouchers, usages, restaurants, menuItems, deliveryDistanceService,
                Clock.fixed(now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(), ZoneId.of("Asia/Ho_Chi_Minh")));
    }

    @AfterEach void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test void validateUsesSameGpsDeliveryCalculationAsCheckout() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(deliveryDistanceService.calculateDelivery(restaurant, new BigDecimal("10.7700000"),
                new BigDecimal("106.6700000"))).thenReturn(new DeliveryCalculation(
                new BigDecimal("2.000"), new BigDecimal("10.000"), new BigDecimal("15000")));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(voucher(DiscountType.PERCENTAGE, "10")));

        var result = service.validate(validateRequest());

        assertTrue(result.isValid());
        assertEquals(new BigDecimal("15000"), result.getDeliveryFee());
        assertEquals(new BigDecimal("82500.00"), result.getEstimatedTotal());
    }

    @Test void validatePropagatesOutsideDeliveryRadiusInsteadOfUsingBaseFee() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(deliveryDistanceService.calculateDelivery(any(), any(), any()))
                .thenThrow(new AppException(ErrorCode.DELIVERY_DISTANCE_EXCEEDED));
        assertCode(ErrorCode.DELIVERY_DISTANCE_EXCEEDED, () -> service.validate(validateRequest()));
    }

    @Test void availableVoucherDelegatesFilteringPaginationAndSortingToDatabase() {
        authenticateUser();
        Page<Voucher> page = new PageImpl<>(List.of(voucher(DiscountType.PERCENTAGE, "10")),
                PageRequest.of(0, 5, Sort.by("endDate").ascending()), 11);
        when(vouchers.findAvailable(eq(7L), eq(2L), eq(now), anyCollection(), any(Pageable.class)))
                .thenReturn(page);
        Page<com.example.dacn.dto.response.VoucherResponse> result = service.getAvailable(7L,
                PageRequest.of(0, 5, Sort.by("endDate")));
        assertEquals(11, result.getTotalElements());
        assertEquals(3, result.getTotalPages());
        verify(vouchers, never()).findAll();
    }

    @Test void availableVoucherRejectsOversizedPageAndUnsafeSort() {
        authenticateUser();
        assertCode(ErrorCode.VOUCHER_INVALID_PAGE_REQUEST,
                () -> service.getAvailable(7L, PageRequest.of(0, 101)));
        assertCode(ErrorCode.VOUCHER_INVALID_PAGE_REQUEST,
                () -> service.getAvailable(7L, PageRequest.of(0, 20, Sort.by("restaurant.name"))));
    }

    @Test void createsValidVoucherAndNormalizesCode() {
        VoucherRequest r = request(DiscountType.PERCENTAGE, "10");
        when(vouchers.existsByCodeIgnoreCase("SAVE10")).thenReturn(false);
        when(vouchers.save(any())).thenAnswer(i -> i.getArgument(0));
        assertEquals("SAVE10", service.create(r).getCode());
    }

    @Test void rejectsDuplicateCodeIgnoringCase() {
        when(vouchers.existsByCodeIgnoreCase("SAVE10")).thenReturn(true);
        AppException e = assertThrows(AppException.class, () -> service.create(request(DiscountType.PERCENTAGE, "10")));
        assertEquals(ErrorCode.VOUCHER_CODE_EXISTS, e.getErrorCode());
    }

    @Test void calculatesPercentageWithCap() {
        Voucher v = voucher(DiscountType.PERCENTAGE, "50"); v.setMaxDiscountAmount(new BigDecimal("30000"));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(v));
        assertEquals(new BigDecimal("30000"), service.calculateDiscount("save10", new BigDecimal("100000")));
    }

    @Test void calculatesFixedAndNeverExceedsSubtotal() {
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(voucher(DiscountType.FIXED_AMOUNT, "50000")));
        assertEquals(new BigDecimal("20000"), service.calculateDiscount("SAVE10", new BigDecimal("20000")));
    }

    @Test void rejectsExpiredNotStartedAndMinimumAmount() {
        Voucher expired = voucher(DiscountType.PERCENTAGE, "10"); expired.setEndDate(now.minusSeconds(1));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(expired));
        assertCode(ErrorCode.VOUCHER_EXPIRED, () -> service.calculateDiscount("SAVE10", new BigDecimal("100000")));
        Voucher future = voucher(DiscountType.PERCENTAGE, "10"); future.setStartDate(now.plusSeconds(1));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(future));
        assertCode(ErrorCode.VOUCHER_NOT_STARTED, () -> service.calculateDiscount("SAVE10", new BigDecimal("100000")));
        Voucher minimum = voucher(DiscountType.PERCENTAGE, "10"); minimum.setMinOrderAmount(new BigDecimal("200000"));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(minimum));
        assertCode(ErrorCode.VOUCHER_MIN_ORDER_NOT_MET, () -> service.calculateDiscount("SAVE10", new BigDecimal("100000")));
    }

    @Test void reserveChecksRestaurantTotalAndPerUserLimits() {
        Voucher v = voucher(DiscountType.PERCENTAGE, "10"); v.setRestaurantId(7L); v.setUsageLimit(1); v.setPerUserLimit(1);
        when(usages.findByOrderIdForUpdate(anyLong())).thenReturn(Optional.empty());
        when(vouchers.findByCodeForUpdate("SAVE10")).thenReturn(Optional.of(v));
        assertCode(ErrorCode.VOUCHER_NOT_APPLICABLE_TO_RESTAURANT,
                () -> service.reserveForOrder("SAVE10", 2L, 3L, 8L, new BigDecimal("100000")));
        when(usages.countByVoucherIdAndStatusIn(eq(1L), any())).thenReturn(1L);
        assertCode(ErrorCode.VOUCHER_USAGE_LIMIT_REACHED,
                () -> service.reserveForOrder("SAVE10", 2L, 4L, 7L, new BigDecimal("100000")));
        when(usages.countByVoucherIdAndStatusIn(eq(1L), any())).thenReturn(0L);
        when(usages.countByVoucherIdAndAccountIdAndStatusIn(eq(1L), eq(2L), any())).thenReturn(1L);
        assertCode(ErrorCode.VOUCHER_USER_LIMIT_REACHED,
                () -> service.reserveForOrder("SAVE10", 2L, 5L, 7L, new BigDecimal("100000")));
    }

    @Test void repeatedReservationForSameOrderIsIdempotent() {
        Voucher v = voucher(DiscountType.PERCENTAGE, "10");
        VoucherUsage u = VoucherUsage.builder().voucherId(1L).orderId(3L).status(VoucherUsageStatus.RESERVED).build();
        when(usages.findByOrderIdForUpdate(3L)).thenReturn(Optional.of(u));
        when(vouchers.findById(1L)).thenReturn(Optional.of(v));
        assertEquals(new BigDecimal("10000.00"), service.reserveForOrder("save10", 2L, 3L, 7L, new BigDecimal("100000")).discountAmount());
        verify(usages, never()).save(any());
    }

    @Test void applyAndReleaseAreIdempotent() {
        Voucher v = voucher(DiscountType.PERCENTAGE, "10");
        VoucherUsage reserved = VoucherUsage.builder().voucherId(1L).orderId(3L).status(VoucherUsageStatus.RESERVED).build();
        when(usages.findByOrderIdForUpdate(3L)).thenReturn(Optional.of(reserved));
        when(vouchers.findByIdForUpdate(1L)).thenReturn(Optional.of(v));
        service.applyForOrder(3L); service.applyForOrder(3L);
        assertEquals(VoucherUsageStatus.APPLIED, reserved.getStatus()); assertEquals(1, v.getUsedCount());

        VoucherUsage release = VoucherUsage.builder().voucherId(1L).orderId(4L).status(VoucherUsageStatus.RESERVED).build();
        when(usages.findByOrderIdForUpdate(4L)).thenReturn(Optional.of(release));
        service.releaseForOrder(4L); service.releaseForOrder(4L);
        assertEquals(VoucherUsageStatus.RELEASED, release.getStatus());
    }

    private VoucherRequest request(DiscountType type, String value) {
        VoucherRequest r = new VoucherRequest(); r.setCode(" save10 "); r.setDiscountType(type);
        r.setDiscountValue(new BigDecimal(value)); r.setMinOrderAmount(BigDecimal.ZERO);
        r.setUsageLimit(10); r.setPerUserLimit(1); r.setStartDate(now.minusDays(1)); r.setEndDate(now.plusDays(1)); r.setActive(true); return r;
    }
    private Voucher voucher(DiscountType type, String value) {
        return Voucher.builder().id(1L).code("SAVE10").discountType(type).discountValue(new BigDecimal(value))
                .minOrderAmount(BigDecimal.ZERO).usageLimit(10).usedCount(0).perUserLimit(1)
                .startDate(now.minusDays(1)).endDate(now.plusDays(1)).active(true).build();
    }
    private VoucherValidateRequest validateRequest() {
        VoucherValidateRequest request = new VoucherValidateRequest();
        request.setVoucherCode("SAVE10"); request.setRestaurantId(7L);
        request.setDeliveryLatitude(new BigDecimal("10.7700000"));
        request.setDeliveryLongitude(new BigDecimal("106.6700000"));
        VoucherValidateRequest.Item item = new VoucherValidateRequest.Item();
        item.setMenuItemId(11L); item.setQuantity(1); request.setItems(List.of(item));
        return request;
    }
    private void authenticateUser() {
        Account account = Account.builder().id(2L).role(Role.USER).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                account, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private void assertCode(ErrorCode code, Executable executable) {
        AppException e = assertThrows(AppException.class, executable::run); assertEquals(code, e.getErrorCode());
    }
    @FunctionalInterface interface Executable { void run(); }
}
