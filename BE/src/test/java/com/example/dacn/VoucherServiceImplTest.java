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
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VoucherServiceImplTest {
    @Mock VoucherRepository vouchers;
    @Mock VoucherUsageRepository usages;
    @Mock VoucherRedemptionRepository redemptions;
    @Mock AccountRepository accounts;
    @Mock RestaurantRepository restaurants;
    @Mock MenuItemRepository menuItems;
    @Mock DeliveryDistanceService deliveryDistanceService;
    @Mock OrderRepository orders;
    VoucherServiceImpl service;
    final LocalDateTime now = LocalDateTime.of(2026, 10, 12, 12, 0);

    @BeforeEach void setup() {
        service = new VoucherServiceImpl(vouchers, usages, redemptions, accounts, restaurants, menuItems, deliveryDistanceService,
                Clock.fixed(now.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant(), ZoneId.of("Asia/Ho_Chi_Minh")));
        ReflectionTestUtils.setField(service, "orderRepository", orders);
        lenient().when(redemptions.countByVoucherIdAndAccountId(anyLong(), anyLong())).thenReturn(1L);
    }

    @Test void grantsWelcomeVoucherWithSeparateFiveDayExpiryAndStableGrantKey() {
        Account account = Account.builder().id(2L).role(Role.USER).build();
        Voucher saigon = welcomeVoucher(11L, "SAIGON20", CategoryVoucher.DISH);
        Voucher hanoi = welcomeVoucher(12L, "HANOISHIP0", CategoryVoucher.FREE_SHIP);
        when(vouchers.findByCodeForUpdate("SAIGON20")).thenReturn(Optional.of(saigon));
        when(vouchers.findByCodeForUpdate("HANOISHIP0")).thenReturn(Optional.of(hanoi));
        when(redemptions.findByAccountIdAndIdempotencyKey(eq(2L), anyString())).thenReturn(Optional.empty());

        service.grantWelcomeVouchers(account);

        ArgumentCaptor<VoucherRedemption> captor = ArgumentCaptor.forClass(VoucherRedemption.class);
        verify(redemptions, times(2)).save(captor.capture());
        assertTrue(captor.getAllValues().stream().allMatch(redemption ->
                redemption.getExpiresAt().equals(redemption.getRedeemedAt().plusDays(5))));
        assertEquals(Set.of("WELCOME:11", "WELCOME:12"), captor.getAllValues().stream()
                .map(VoucherRedemption::getIdempotencyKey).collect(java.util.stream.Collectors.toSet()));
    }

    @Test void hanoiWelcomeVoucherDiscountIsCappedByDeliveryFee() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true).address("Hoàn Kiếm, Hà Nội")
                .deliveryFee(new BigDecimal("18000")).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        Voucher voucher = welcomeVoucher(12L, "HANOISHIP0", CategoryVoucher.FREE_SHIP);
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(vouchers.findByCodeIgnoreCase("HANOISHIP0")).thenReturn(Optional.of(voucher));
        when(redemptions.findFirstByVoucherIdAndAccountIdOrderByRedeemedAtDesc(12L, 2L))
                .thenReturn(Optional.of(welcomeGrant(12L)));
        when(orders.countByAccountIdAndStatusNot(2L, OrderStatus.CANCELLED)).thenReturn(0L);
        VoucherValidateRequest request = validateRequest();
        request.setVoucherCode("HANOISHIP0");
        request.setDeliveryLatitude(null);
        request.setDeliveryLongitude(null);

        var result = service.validate(request);

        assertTrue(result.isValid());
        assertEquals(new BigDecimal("18000"), result.getDiscountAmount());
        assertEquals(new BigDecimal("75000"), result.getEstimatedTotal());
    }

    @Test void expiredWelcomeGrantIsRejectedByBackend() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true).address("Quận 1, TP. Hồ Chí Minh")
                .deliveryFee(BigDecimal.ZERO).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        Voucher voucher = welcomeVoucher(11L, "SAIGON20", CategoryVoucher.DISH);
        VoucherRedemption expired = welcomeGrant(11L);
        expired.setExpiresAt(now.minusSeconds(1));
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(vouchers.findByCodeIgnoreCase("SAIGON20")).thenReturn(Optional.of(voucher));
        when(redemptions.findFirstByVoucherIdAndAccountIdOrderByRedeemedAtDesc(11L, 2L))
                .thenReturn(Optional.of(expired));

        VoucherValidateRequest request = validateRequest();
        request.setVoucherCode("SAIGON20");
        request.setDeliveryLatitude(null);
        request.setDeliveryLongitude(null);
        var result = service.validate(request);

        assertFalse(result.isValid());
        assertEquals(ErrorCode.VOUCHER_EXPIRED.getCode(), result.getReasonCode());
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

    @Test void validateWithoutGpsUsesConfiguredBaseDeliveryFee() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true)
                .deliveryFee(new BigDecimal("15000")).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(voucher(DiscountType.PERCENTAGE, "10")));
        VoucherValidateRequest request = validateRequest();
        request.setDeliveryLatitude(null);
        request.setDeliveryLongitude(null);

        var result = service.validate(request);

        assertTrue(result.isValid());
        assertEquals(new BigDecimal("7500.00"), result.getDiscountAmount());
        assertEquals(new BigDecimal("15000"), result.getDeliveryFee());
        assertEquals(new BigDecimal("82500.00"), result.getEstimatedTotal());
        verifyNoInteractions(deliveryDistanceService);
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

    @Test void validateRejectsVoucherAfterCustomerReachedPerUserLimit() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true)
                .deliveryFee(new BigDecimal("15000")).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(deliveryDistanceService.calculateDelivery(any(), any(), any())).thenReturn(new DeliveryCalculation(
                new BigDecimal("2.000"), new BigDecimal("10.000"), new BigDecimal("15000")));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(voucher(DiscountType.PERCENTAGE, "10")));
        when(usages.countByVoucherIdAndAccountIdAndStatusIn(eq(1L), eq(2L), anyCollection())).thenReturn(1L);

        var result = service.validate(validateRequest());

        assertFalse(result.isValid());
        assertEquals(ErrorCode.VOUCHER_USER_LIMIT_REACHED.getCode(), result.getReasonCode());
        assertEquals(BigDecimal.ZERO, result.getDiscountAmount());
    }

    @Test void validateRejectsVoucherThatCustomerHasNotRedeemed() {
        authenticateUser();
        Restaurant restaurant = Restaurant.builder().id(7L).active(true)
                .deliveryFee(new BigDecimal("15000")).build();
        MenuItem item = MenuItem.builder().id(11L).restaurant(restaurant).active(true).available(true)
                .price(new BigDecimal("75000")).build();
        when(restaurants.findById(7L)).thenReturn(Optional.of(restaurant));
        when(menuItems.findById(11L)).thenReturn(Optional.of(item));
        when(deliveryDistanceService.calculateDelivery(any(), any(), any())).thenReturn(new DeliveryCalculation(
                new BigDecimal("2.000"), new BigDecimal("10.000"), new BigDecimal("15000")));
        when(vouchers.findByCodeIgnoreCase("SAVE10")).thenReturn(Optional.of(voucher(DiscountType.PERCENTAGE, "10")));
        when(redemptions.countByVoucherIdAndAccountId(1L, 2L)).thenReturn(0L);

        var result = service.validate(validateRequest());

        assertFalse(result.isValid());
        assertEquals(ErrorCode.VOUCHER_NOT_OWNED.getCode(), result.getReasonCode());
    }

    @Test void myVouchersReturnsRedemptionHistorySoFrontendCanDisplayStatuses() {
        authenticateUser();
        Voucher voucher = voucher(DiscountType.PERCENTAGE, "10");
        voucher.setPerUserLimit(2);
        List<VoucherRedemption> claims = List.of(
                VoucherRedemption.builder().id(10L).accountId(2L).voucherId(1L).redeemedAt(now).build(),
                VoucherRedemption.builder().id(11L).accountId(2L).voucherId(1L).redeemedAt(now.minusMinutes(1)).build());
        when(redemptions.findByAccountIdOrderByRedeemedAtDesc(2L)).thenReturn(claims);
        when(redemptions.countByVoucherIdAndAccountId(1L, 2L)).thenReturn(2L);
        when(usages.countByVoucherIdAndAccountIdAndStatusIn(eq(1L), eq(2L), anyCollection())).thenReturn(1L);
        when(vouchers.findById(1L)).thenReturn(Optional.of(voucher));

        var result = service.getMyRedemptions();

        assertEquals(2, result.size());
        assertEquals("SAVE10", result.getFirst().getVoucher().getCode());
        assertEquals("AVAILABLE", result.getFirst().getVoucher().getCustomerStatus());
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

    @Test void voucherListMarksVoucherUsedWhenCustomerReachedPerUserLimit() {
        authenticateUser();
        Voucher used = voucher(DiscountType.PERCENTAGE, "10");
        when(vouchers.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(used)));
        when(usages.countByVoucherIdAndAccountIdAndStatusIn(
                eq(1L), eq(2L), eq(EnumSet.of(VoucherUsageStatus.RESERVED, VoucherUsageStatus.APPLIED)))).thenReturn(1L);

        var result = service.getAll(null, null, PageRequest.of(0, 20));

        assertEquals("USED", result.getContent().getFirst().getCustomerStatus());
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

        VoucherUsage applied = VoucherUsage.builder().voucherId(1L).orderId(5L).status(VoucherUsageStatus.APPLIED).build();
        when(usages.findByOrderIdForUpdate(5L)).thenReturn(Optional.of(applied));
        service.releaseForOrder(5L); service.releaseForOrder(5L);
        assertEquals(VoucherUsageStatus.RELEASED, applied.getStatus());
        assertEquals(0, v.getUsedCount());
    }

    @Test void redeemRetryWithSameKeyReturnsStoredResultWithoutChargingAgain() {
        authenticateUser();
        Account account = Account.builder().id(2L).role(Role.USER).availablePoints(600).build();
        Voucher voucher = voucher(DiscountType.PERCENTAGE, "10");
        voucher.setPerUserLimit(2);
        AtomicReference<VoucherRedemption> stored = new AtomicReference<>();
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(account));
        when(redemptions.findByAccountIdAndIdempotencyKey(2L, "retry-1"))
                .thenAnswer(invocation -> Optional.ofNullable(stored.get()));
        when(redemptions.countByVoucherId(1L)).thenAnswer(invocation -> stored.get() == null ? 0L : 1L);
        when(redemptions.countByVoucherIdAndAccountId(1L, 2L))
                .thenAnswer(invocation -> stored.get() == null ? 0L : 1L);
        when(vouchers.findByIdForUpdate(1L)).thenReturn(Optional.of(voucher));
        when(vouchers.findById(1L)).thenReturn(Optional.of(voucher));
        when(redemptions.save(any())).thenAnswer(invocation -> {
            VoucherRedemption redemption = invocation.getArgument(0);
            redemption.setId(99L);
            stored.set(redemption);
            return redemption;
        });

        var first = service.redeem(1L, "retry-1");
        var retry = service.redeem(1L, "retry-1");

        assertEquals(first.getId(), retry.getId());
        assertEquals(300, account.getAvailablePoints());
        verify(redemptions, times(1)).save(any());
        verify(accounts, times(1)).save(account);
    }

    @Test void differentIdempotencyKeysRemainIndependentRedemptions() {
        authenticateUser();
        Account account = Account.builder().id(2L).role(Role.USER).availablePoints(600).build();
        Voucher voucher = voucher(DiscountType.PERCENTAGE, "10");
        voucher.setPerUserLimit(2);
        Map<String, VoucherRedemption> stored = new HashMap<>();
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(account));
        when(redemptions.findByAccountIdAndIdempotencyKey(eq(2L), anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(stored.get(invocation.getArgument(1))));
        when(redemptions.countByVoucherId(1L)).thenAnswer(invocation -> (long) stored.size());
        when(redemptions.countByVoucherIdAndAccountId(1L, 2L)).thenAnswer(invocation -> (long) stored.size());
        when(vouchers.findByIdForUpdate(1L)).thenReturn(Optional.of(voucher));
        when(redemptions.save(any())).thenAnswer(invocation -> {
            VoucherRedemption redemption = invocation.getArgument(0);
            redemption.setId((long) stored.size() + 1);
            stored.put(redemption.getIdempotencyKey(), redemption);
            return redemption;
        });

        service.redeem(1L, "request-a");
        service.redeem(1L, "request-b");

        assertEquals(0, account.getAvailablePoints());
        assertEquals(2, stored.size());
        verify(redemptions, times(2)).save(any());
    }

    @Test void sameIdempotencyKeyCannotBeReusedForAnotherVoucher() {
        authenticateUser();
        Account account = Account.builder().id(2L).role(Role.USER).availablePoints(600).build();
        VoucherRedemption prior = VoucherRedemption.builder().id(9L).accountId(2L).voucherId(1L)
                .idempotencyKey("same-key").redeemedAt(now).build();
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(account));
        when(redemptions.findByAccountIdAndIdempotencyKey(2L, "same-key")).thenReturn(Optional.of(prior));

        assertCode(ErrorCode.VOUCHER_IDEMPOTENCY_KEY_REUSED,
                () -> service.redeem(2L, "same-key"));
        verify(redemptions, never()).save(any());
        verify(accounts, never()).save(any());
    }

    @Test void failedRedemptionDoesNotBlockRetryWithSameKey() {
        authenticateUser();
        Account account = Account.builder().id(2L).role(Role.USER).availablePoints(200).build();
        Voucher voucher = voucher(DiscountType.PERCENTAGE, "10");
        when(accounts.findByIdForUpdate(2L)).thenReturn(Optional.of(account));
        when(redemptions.findByAccountIdAndIdempotencyKey(2L, "retry-after-failure"))
                .thenReturn(Optional.empty());

        assertCode(ErrorCode.LOYALTY_POINTS_INSUFFICIENT,
                () -> service.redeem(1L, "retry-after-failure"));

        account.setAvailablePoints(300);
        when(redemptions.countByVoucherId(1L)).thenReturn(0L);
        when(redemptions.countByVoucherIdAndAccountId(1L, 2L)).thenReturn(0L);
        when(vouchers.findByIdForUpdate(1L)).thenReturn(Optional.of(voucher));
        when(redemptions.save(any())).thenAnswer(invocation -> {
            VoucherRedemption redemption = invocation.getArgument(0);
            redemption.setId(10L);
            return redemption;
        });

        var result = service.redeem(1L, "retry-after-failure");

        assertEquals(10L, result.getId());
        assertEquals(0, account.getAvailablePoints());
        verify(redemptions, times(1)).save(any());
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
    private Voucher welcomeVoucher(Long id, String code, CategoryVoucher category) {
        return Voucher.builder().id(id).code(code).categoryVoucher(category).discountType(DiscountType.FIXED_AMOUNT)
                .discountValue(new BigDecimal("30000")).minOrderAmount(BigDecimal.ZERO)
                .maxDiscountAmount(new BigDecimal("30000")).usageLimit(Integer.MAX_VALUE).usedCount(0)
                .perUserLimit(1).startDate(now.minusYears(1)).endDate(now.plusYears(1)).active(true).build();
    }
    private VoucherRedemption welcomeGrant(Long voucherId) {
        return VoucherRedemption.builder().id(20L).voucherId(voucherId).accountId(2L)
                .redeemedAt(now.minusDays(1)).expiresAt(now.plusDays(4))
                .idempotencyKey("WELCOME:" + voucherId).build();
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
