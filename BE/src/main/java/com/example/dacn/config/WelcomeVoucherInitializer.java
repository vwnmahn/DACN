package com.example.dacn.config;

import com.example.dacn.entity.CategoryVoucher;
import com.example.dacn.entity.DiscountType;
import com.example.dacn.entity.Voucher;
import com.example.dacn.repository.VoucherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class WelcomeVoucherInitializer implements ApplicationRunner {
    private static final BigDecimal DISCOUNT = new BigDecimal("30000.00");
    private final VoucherRepository voucherRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        createIfMissing("SAIGON20", "Giảm 30.000đ tiền món cho đơn hàng đầu tiên tại TP. Hồ Chí Minh.", CategoryVoucher.DISH);
        createIfMissing("HANOISHIP0", "Giảm tối đa 30.000đ phí giao hàng cho đơn hàng đầu tiên tại Hà Nội.", CategoryVoucher.FREE_SHIP);
    }

    private void createIfMissing(String code, String description, CategoryVoucher category) {
        if (voucherRepository.existsByCodeIgnoreCase(code)) return;
        voucherRepository.save(Voucher.builder()
                .code(code)
                .description(description)
                .categoryVoucher(category)
                .discountType(DiscountType.FIXED_AMOUNT)
                .discountValue(DISCOUNT)
                .minOrderAmount(BigDecimal.ZERO)
                .maxDiscountAmount(DISCOUNT)
                .usageLimit(Integer.MAX_VALUE)
                .usedCount(0)
                .perUserLimit(1)
                .restaurantId(null)
                .startDate(LocalDateTime.of(2000, 1, 1, 0, 0))
                .endDate(LocalDateTime.of(9999, 12, 31, 23, 59, 59))
                .active(true)
                .build());
    }
}
