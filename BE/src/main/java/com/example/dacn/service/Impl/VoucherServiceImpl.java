package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.*;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.*;
import com.example.dacn.exception.*;
import com.example.dacn.repository.*;
import com.example.dacn.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;

@Service
public class VoucherServiceImpl implements VoucherService {
    private static final Set<VoucherUsageStatus> OCCUPIED = EnumSet.of(VoucherUsageStatus.RESERVED, VoucherUsageStatus.APPLIED);
    private final VoucherRepository voucherRepository;
    private final VoucherUsageRepository usageRepository;
    private final VoucherRedemptionRepository redemptionRepository;
    private final AccountRepository accountRepository;
    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final DeliveryDistanceService deliveryDistanceService;
    private final Clock clock;
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> AVAILABLE_SORT_FIELDS = Set.of(
            "id", "code", "discountValue", "minOrderAmount", "startDate", "endDate", "createdAt");

    @Autowired
    public VoucherServiceImpl(VoucherRepository voucherRepository, VoucherUsageRepository usageRepository,
                              VoucherRedemptionRepository redemptionRepository, AccountRepository accountRepository,
                              RestaurantRepository restaurantRepository, MenuItemRepository menuItemRepository,
                              DeliveryDistanceService deliveryDistanceService, Clock clock) {
        this.voucherRepository = voucherRepository;
        this.usageRepository = usageRepository;
        this.redemptionRepository = redemptionRepository;
        this.accountRepository = accountRepository;
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
        this.deliveryDistanceService = deliveryDistanceService;
        this.clock = clock;
    }

    public VoucherServiceImpl(VoucherRepository voucherRepository, VoucherUsageRepository usageRepository,
                              RestaurantRepository restaurantRepository, MenuItemRepository menuItemRepository,
                              DeliveryDistanceService deliveryDistanceService, Clock clock) {
        this(voucherRepository, usageRepository, null, null, restaurantRepository, menuItemRepository,
                deliveryDistanceService, clock);
    }

    @Override @Transactional
    public VoucherResponse create(VoucherRequest r) {
        validateDefinition(r); String code = code(r.getCode());
        if (voucherRepository.existsByCodeIgnoreCase(code)) throw error(ErrorCode.VOUCHER_CODE_EXISTS);
        validateRestaurant(r.getRestaurantId());
        Voucher v = Voucher.builder().code(code).usedCount(0).build(); copy(r, v);
        return response(voucherRepository.save(v));
    }

    @Override @Transactional
    public VoucherResponse update(Long id, VoucherRequest r) {
        validateDefinition(r);
        Voucher v = voucherRepository.findByIdForUpdate(id).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        String code = code(r.getCode());
        if (voucherRepository.existsByCodeIgnoreCaseAndIdNot(code, id)) throw error(ErrorCode.VOUCHER_CODE_EXISTS);
        validateRestaurant(r.getRestaurantId());
        if (usageRepository.existsByVoucherId(id) && materialChanged(v, r, code)) throw error(ErrorCode.VOUCHER_HISTORY_IMMUTABLE);
        copy(r, v); return response(voucherRepository.save(v));
    }

    @Override @Transactional
    public VoucherResponse updateStatus(Long id, boolean active) {
        Voucher v = voucherRepository.findByIdForUpdate(id).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        v.setActive(active); return response(voucherRepository.save(v));
    }

    @Override @Transactional(readOnly = true)
    public VoucherResponse getById(Long id) {
        return response(voucherRepository.findById(id).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND)));
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getAll(Boolean active, Long restaurantId, Pageable p) {
        Page<Voucher> page = active != null && restaurantId != null ? voucherRepository.findByActiveAndRestaurantId(active, restaurantId, p)
                : active != null ? voucherRepository.findByActive(active, p)
                : restaurantId != null ? voucherRepository.findByRestaurantId(restaurantId, p) : voucherRepository.findAll(p);
        return page.map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getAll(Boolean active, Long restaurantId, CategoryVoucher category, Pageable p) {
        if (category == null) return getAll(active, restaurantId, p);
        return voucherRepository.findFiltered(active, restaurantId, category, p).map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getAvailable(Long restaurantId, Pageable p) {
        Long accountId = accountId(); LocalDateTime now = LocalDateTime.now(clock);
        Pageable safePageable = safeAvailablePageable(p);
        return voucherRepository.findAvailable(restaurantId, accountId, now, OCCUPIED, safePageable)
                .map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getAvailable(Long restaurantId, CategoryVoucher category, Pageable p) {
        if (category == null) return getAvailable(restaurantId, p);
        Long accountId = accountId(); LocalDateTime now = LocalDateTime.now(clock);
        Pageable safePageable = safeAvailablePageable(p);
        return voucherRepository.findAvailableByCategory(restaurantId, accountId, now, category, OCCUPIED, safePageable)
                .map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getRedeemable(Pageable p) {
        Long accountId = accountId();
        return voucherRepository.findRedeemable(accountId, LocalDateTime.now(clock), OCCUPIED,
                safeAvailablePageable(p)).map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public Page<VoucherResponse> getRedeemable(CategoryVoucher category, Pageable p) {
        if (category == null) return getRedeemable(p);
        Long accountId = accountId();
        return voucherRepository.findRedeemableByCategory(accountId, LocalDateTime.now(clock), category, OCCUPIED,
                safeAvailablePageable(p)).map(this::response);
    }

    @Override @Transactional(readOnly = true)
    public List<VoucherRedemptionResponse> getMyRedemptions() {
        Long accountId = accountId();
        List<VoucherRedemption> redemptions = redemptionRepository.findByAccountIdOrderByRedeemedAtDesc(accountId);
        Map<Long, Long> availableByVoucher = new HashMap<>();
        redemptions.forEach(redemption -> availableByVoucher.computeIfAbsent(redemption.getVoucherId(), voucherId ->
                Math.max(0L, redemptionRepository.countByVoucherIdAndAccountId(voucherId, accountId)
                        - occupiedByUser(voucherId, accountId))));
        return redemptions.stream()
                .filter(redemption -> {
                    long remaining = availableByVoucher.getOrDefault(redemption.getVoucherId(), 0L);
                    if (remaining <= 0) return false;
                    availableByVoucher.put(redemption.getVoucherId(), remaining - 1);
                    return true;
                })
                .map(redemption -> VoucherRedemptionResponse.builder()
                        .id(redemption.getId())
                        .voucher(response(voucherRepository.findById(redemption.getVoucherId())
                                .orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND))))
                        .redeemedAt(redemption.getRedeemedAt())
                        .build())
                .toList();
    }

    @Override @Transactional
    public VoucherRedemptionResponse redeem(Long voucherId) {
        Account account = accountRepository.findByIdForUpdate(accountId())
                .orElseThrow(() -> error(ErrorCode.ACCOUNT_NOT_FOUND));
        if (Objects.requireNonNullElse(account.getAvailablePoints(), 0) < 300) {
            throw error(ErrorCode.LOYALTY_POINTS_INSUFFICIENT);
        }

        Voucher voucher = voucherRepository.findByIdForUpdate(voucherId)
                .orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        LocalDateTime now = LocalDateTime.now(clock);
        long claimed = redemptionRepository.countByVoucherId(voucherId);
        long claimedByAccount = redemptionRepository.countByVoucherIdAndAccountId(voucherId, account.getId());
        boolean valid = Boolean.TRUE.equals(voucher.getActive())
                && !now.isBefore(voucher.getStartDate()) && !now.isAfter(voucher.getEndDate())
                && occupied(voucherId) + claimed < voucher.getUsageLimit()
                && claimedByAccount < voucher.getPerUserLimit();
        if (!valid) throw error(ErrorCode.VOUCHER_NOT_REDEEMABLE);

        account.setAvailablePoints(account.getAvailablePoints() - 300);
        VoucherRedemption redemption = redemptionRepository.save(VoucherRedemption.builder()
                .accountId(account.getId()).voucherId(voucherId).redeemedAt(now).build());
        accountRepository.save(account);
        return VoucherRedemptionResponse.builder().id(redemption.getId()).voucher(response(voucher))
                .redeemedAt(now).availablePoints(account.getAvailablePoints()).build();
    }

    @Override @Transactional(readOnly = true)
    public VoucherValidationResponse validate(VoucherValidateRequest r) {
        CartQuote cart = cartQuote(r);
        BigDecimal subtotal = cart.subtotal();
        try {
            Voucher v = voucherRepository.findByCodeIgnoreCase(code(r.getVoucherCode())).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
            validateUsable(v, accountId(), r.getRestaurantId(), subtotal, true);
            BigDecimal discount = discount(v, subtotal);
            return VoucherValidationResponse.builder().valid(true).subtotal(subtotal).deliveryFee(cart.deliveryFee())
                    .discountAmount(discount).estimatedTotal(subtotal.subtract(discount).add(cart.deliveryFee())).build();
        } catch (AppException e) {
            return VoucherValidationResponse.builder().valid(false).reasonCode(e.getErrorCode().getCode())
                    .reason(e.getErrorCode().getMessage()).subtotal(subtotal).deliveryFee(cart.deliveryFee())
                    .discountAmount(BigDecimal.ZERO).estimatedTotal(subtotal.add(cart.deliveryFee())).build();
        }
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal calculateDiscount(String voucherCode, BigDecimal amount) {
        if (voucherCode == null || voucherCode.isBlank()) return BigDecimal.ZERO;
        if (amount == null || amount.signum() < 0) throw error(ErrorCode.VOUCHER_INVALID_DATA);
        Voucher v = voucherRepository.findByCodeIgnoreCase(code(voucherCode)).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        validateTimeValue(v, amount); return discount(v, amount);
    }

    @Override @Transactional
    public VoucherReservationResult reserveForOrder(String voucherCode, Long accountId, Long orderId, Long restaurantId, BigDecimal subtotal) {
        Optional<VoucherUsage> prior = usageRepository.findByOrderIdForUpdate(orderId);
        if (prior.isPresent()) {
            Voucher v = voucherRepository.findById(prior.get().getVoucherId()).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
            if (v.getCode().equalsIgnoreCase(code(voucherCode)) && prior.get().getStatus() != VoucherUsageStatus.RELEASED)
                return new VoucherReservationResult(v.getId(), v.getCode(), discount(v, subtotal));
            throw error(ErrorCode.VOUCHER_ALREADY_RESERVED_FOR_ORDER);
        }
        Voucher v = voucherRepository.findByCodeForUpdate(code(voucherCode)).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        validateUsable(v, accountId, restaurantId, subtotal, true);
        usageRepository.save(VoucherUsage.builder().voucherId(v.getId()).accountId(accountId).orderId(orderId)
                .status(VoucherUsageStatus.RESERVED).reservedAt(LocalDateTime.now(clock)).build());
        return new VoucherReservationResult(v.getId(), v.getCode(), discount(v, subtotal));
    }

    @Override @Transactional
    public void applyForOrder(Long orderId) {
        VoucherUsage u = usageRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (u == null || u.getStatus() != VoucherUsageStatus.RESERVED) return;
        Voucher v = voucherRepository.findByIdForUpdate(u.getVoucherId()).orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
        u.setStatus(VoucherUsageStatus.APPLIED); u.setAppliedAt(LocalDateTime.now(clock));
        v.setUsedCount(v.getUsedCount() + 1); voucherRepository.save(v); usageRepository.save(u);
    }

    @Override @Transactional
    public void releaseForOrder(Long orderId) {
        VoucherUsage u = usageRepository.findByOrderIdForUpdate(orderId).orElse(null);
        if (u == null || u.getStatus() == VoucherUsageStatus.RELEASED) return;
        if (u.getStatus() == VoucherUsageStatus.APPLIED) {
            Voucher v = voucherRepository.findByIdForUpdate(u.getVoucherId())
                    .orElseThrow(() -> error(ErrorCode.VOUCHER_NOT_FOUND));
            v.setUsedCount(Math.max(0, Objects.requireNonNullElse(v.getUsedCount(), 0) - 1));
            voucherRepository.save(v);
        }
        u.setStatus(VoucherUsageStatus.RELEASED); u.setReleasedAt(LocalDateTime.now(clock)); usageRepository.save(u);
    }

    private CartQuote cartQuote(VoucherValidateRequest r) {
        Restaurant restaurant = restaurantRepository.findById(r.getRestaurantId())
                .orElseThrow(() -> error(ErrorCode.RESTAURANT_NOT_FOUND));
        if (!Boolean.TRUE.equals(restaurant.getActive())) throw error(ErrorCode.RESTAURANT_INACTIVE);
        BigDecimal total = BigDecimal.ZERO; Set<Long> ids = new HashSet<>();
        for (VoucherValidateRequest.Item i : r.getItems()) {
            if (!ids.add(i.getMenuItemId())) throw error(ErrorCode.ORDER_DUPLICATE_MENU_ITEM);
            MenuItem m = menuItemRepository.findById(i.getMenuItemId()).orElseThrow(() -> error(ErrorCode.MENU_ITEM_NOT_FOUND));
            if (!Objects.equals(m.getRestaurant().getId(), r.getRestaurantId())) throw error(ErrorCode.MENU_ITEM_NOT_IN_RESTAURANT);
            if (!Boolean.TRUE.equals(m.getActive()) || !Boolean.TRUE.equals(m.getAvailable())) throw error(ErrorCode.MENU_ITEM_UNAVAILABLE);
            if (m.getPrice() == null || m.getPrice().signum() < 0) throw error(ErrorCode.MENU_ITEM_INVALID_PRICE);
            total = total.add(m.getPrice().multiply(BigDecimal.valueOf(i.getQuantity())));
        }
        BigDecimal deliveryFee = restaurant.getDeliveryFee();
        if (r.getDeliveryLatitude() != null && r.getDeliveryLongitude() != null) {
            deliveryFee = deliveryDistanceService.calculateDelivery(restaurant,
                    r.getDeliveryLatitude(), r.getDeliveryLongitude()).deliveryFee();
        }
        return new CartQuote(total, deliveryFee);
    }

    private Pageable safeAvailablePageable(Pageable pageable) {
        if (pageable == null || pageable.getPageNumber() < 0 || pageable.getPageSize() < 1
                || pageable.getPageSize() > MAX_PAGE_SIZE) throw error(ErrorCode.VOUCHER_INVALID_PAGE_REQUEST);
        Sort requested = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("id").ascending();
        for (Sort.Order order : requested) {
            if (!AVAILABLE_SORT_FIELDS.contains(order.getProperty()))
                throw error(ErrorCode.VOUCHER_INVALID_PAGE_REQUEST);
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), requested);
    }

    private void validateUsable(Voucher v, Long accountId, Long restaurantId, BigDecimal subtotal, boolean capacity) {
        validateTimeValue(v, subtotal);
        if (v.getRestaurantId() != null && !Objects.equals(v.getRestaurantId(), restaurantId)) throw error(ErrorCode.VOUCHER_NOT_APPLICABLE_TO_RESTAURANT);
        if (capacity && occupied(v.getId()) >= v.getUsageLimit()) throw error(ErrorCode.VOUCHER_USAGE_LIMIT_REACHED);
        if (capacity && occupiedByUser(v.getId(), accountId) >= v.getPerUserLimit()) throw error(ErrorCode.VOUCHER_USER_LIMIT_REACHED);
        if (capacity && redemptionRepository.countByVoucherIdAndAccountId(v.getId(), accountId)
                <= occupiedByUser(v.getId(), accountId)) throw error(ErrorCode.VOUCHER_NOT_OWNED);
    }

    private void validateTimeValue(Voucher v, BigDecimal subtotal) {
        LocalDateTime now = LocalDateTime.now(clock);
        if (!Boolean.TRUE.equals(v.getActive())) throw error(ErrorCode.VOUCHER_INACTIVE);
        if (now.isBefore(v.getStartDate())) throw error(ErrorCode.VOUCHER_NOT_STARTED);
        if (now.isAfter(v.getEndDate())) throw error(ErrorCode.VOUCHER_EXPIRED);
        if (subtotal.compareTo(v.getMinOrderAmount()) < 0) throw error(ErrorCode.VOUCHER_MIN_ORDER_NOT_MET);
    }

    private BigDecimal discount(Voucher v, BigDecimal subtotal) {
        BigDecimal d = v.getDiscountType() == DiscountType.PERCENTAGE
                ? subtotal.multiply(v.getDiscountValue()).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP) : v.getDiscountValue();
        if (v.getMaxDiscountAmount() != null) d = d.min(v.getMaxDiscountAmount());
        return d.min(subtotal);
    }

    private void validateDefinition(VoucherRequest r) {
        if (r == null || r.getDiscountType() == null || r.getDiscountValue() == null || r.getMinOrderAmount() == null
                || r.getUsageLimit() == null || r.getPerUserLimit() == null || r.getStartDate() == null || r.getEndDate() == null
                || !r.getStartDate().isBefore(r.getEndDate()) || r.getDiscountValue().signum() <= 0 || r.getMinOrderAmount().signum() < 0
                || r.getUsageLimit() <= 0 || r.getPerUserLimit() <= 0 || (r.getMaxDiscountAmount() != null && r.getMaxDiscountAmount().signum() <= 0)
                || (r.getDiscountType() == DiscountType.PERCENTAGE && r.getDiscountValue().compareTo(new BigDecimal("100")) > 0))
            throw error(ErrorCode.VOUCHER_INVALID_DATA);
    }

    private void validateRestaurant(Long id) { if (id != null && !restaurantRepository.existsById(id)) throw error(ErrorCode.RESTAURANT_NOT_FOUND); }
    private long occupied(Long id) { return usageRepository.countByVoucherIdAndStatusIn(id, OCCUPIED); }
    private long occupiedByUser(Long id, Long account) { return usageRepository.countByVoucherIdAndAccountIdAndStatusIn(id, account, OCCUPIED); }
    private Long accountId() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || !(a.getPrincipal() instanceof Account account)) throw error(ErrorCode.UNAUTHENTICATED);
        return account.getId();
    }
    private String code(String value) { if (value == null || value.isBlank()) throw error(ErrorCode.VOUCHER_INVALID_DATA); return value.trim().toUpperCase(Locale.ROOT); }
    private AppException error(ErrorCode e) { return new AppException(e); }

    private void copy(VoucherRequest r, Voucher v) {
        v.setCode(code(r.getCode())); v.setDescription(r.getDescription()); v.setCategoryVoucher(r.getCategoryVoucher()); v.setDiscountType(r.getDiscountType()); v.setDiscountValue(r.getDiscountValue());
        v.setMinOrderAmount(r.getMinOrderAmount()); v.setMaxDiscountAmount(r.getMaxDiscountAmount()); v.setUsageLimit(r.getUsageLimit());
        v.setPerUserLimit(r.getPerUserLimit()); v.setStartDate(r.getStartDate()); v.setEndDate(r.getEndDate()); v.setActive(r.getActive()); v.setRestaurantId(r.getRestaurantId());
    }
    private boolean materialChanged(Voucher v, VoucherRequest r, String c) {
        return !v.getCode().equals(c) || v.getCategoryVoucher() != r.getCategoryVoucher() || v.getDiscountType() != r.getDiscountType() || v.getDiscountValue().compareTo(r.getDiscountValue()) != 0
                || v.getMinOrderAmount().compareTo(r.getMinOrderAmount()) != 0 || !Objects.equals(v.getMaxDiscountAmount(), r.getMaxDiscountAmount())
                || !Objects.equals(v.getUsageLimit(), r.getUsageLimit()) || !Objects.equals(v.getPerUserLimit(), r.getPerUserLimit())
                || !Objects.equals(v.getRestaurantId(), r.getRestaurantId()) || !Objects.equals(v.getStartDate(), r.getStartDate()) || !Objects.equals(v.getEndDate(), r.getEndDate());
    }
    private VoucherResponse response(Voucher v) {
        return VoucherResponse.builder().id(v.getId()).code(v.getCode()).description(v.getDescription()).categoryVoucher(v.getCategoryVoucher()).discountType(v.getDiscountType())
                .discountValue(v.getDiscountValue()).minOrderAmount(v.getMinOrderAmount()).maxDiscountAmount(v.getMaxDiscountAmount())
                .usageLimit(v.getUsageLimit()).usedCount(v.getUsedCount()).perUserLimit(v.getPerUserLimit()).active(v.getActive())
                .customerStatus(customerStatus(v))
                .restaurantId(v.getRestaurantId()).startDate(v.getStartDate()).endDate(v.getEndDate()).createdAt(v.getCreatedAt()).updatedAt(v.getUpdatedAt()).build();
    }
    private String customerStatus(Voucher v) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Account account)
                || account.getRole() != Role.USER) return null;
        long occupiedByUser = occupiedByUser(v.getId(), account.getId());
        long redeemedByUser = redemptionRepository.countByVoucherIdAndAccountId(v.getId(), account.getId());
        if (occupiedByUser > 0 && redeemedByUser <= occupiedByUser) return "USED";
        LocalDateTime now = LocalDateTime.now(clock);
        boolean available = Boolean.TRUE.equals(v.getActive())
                && !now.isBefore(v.getStartDate()) && !now.isAfter(v.getEndDate())
                && occupied(v.getId()) < v.getUsageLimit()
                && occupiedByUser < v.getPerUserLimit();
        if (!available) return "UNAVAILABLE";
        return redeemedByUser > occupiedByUser ? "AVAILABLE" : "UNOWNED";
    }
    private record CartQuote(BigDecimal subtotal, BigDecimal deliveryFee) {}
}
