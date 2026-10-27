package com.example.dacn;

import com.example.dacn.dto.response.VoucherRedemptionResponse;
import com.example.dacn.entity.*;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.VoucherRedemptionRepository;
import com.example.dacn.repository.VoucherRepository;
import com.example.dacn.service.VoucherService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {
        "app.geocoding.url=https://example.invalid/search",
        "app.geocoding.user-agent=fca-idempotency-test"
})
class VoucherRedemptionIdempotencyIntegrationTest {
    @Autowired VoucherService voucherService;
    @Autowired AccountRepository accountRepository;
    @Autowired VoucherRepository voucherRepository;
    @Autowired VoucherRedemptionRepository redemptionRepository;

    @Test
    void concurrentRetriesWithSameKeyCreateAndChargeExactlyOnce() throws Exception {
        String suffix = UUID.randomUUID().toString();
        Account account = accountRepository.saveAndFlush(Account.builder()
                .username("idem-" + suffix)
                .email("idem-" + suffix + "@test.local")
                .gender(GenderStatus.OTHER)
                .role(Role.USER)
                .locked(false)
                .loyaltyPoints(600)
                .availablePoints(600)
                .membershipRank(MembershipRank.GOLD)
                .build());
        Voucher voucher = voucherRepository.saveAndFlush(Voucher.builder()
                .code("IDEM-" + suffix)
                .description("Idempotency integration test")
                .discountType(DiscountType.FIXED_AMOUNT)
                .discountValue(new BigDecimal("10000"))
                .minOrderAmount(BigDecimal.ZERO)
                .usageLimit(10)
                .usedCount(0)
                .perUserLimit(2)
                .startDate(LocalDateTime.now().minusDays(1))
                .endDate(LocalDateTime.now().plusDays(1))
                .active(true)
                .build());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CyclicBarrier start = new CyclicBarrier(2);
        String requestKey = "retry-" + suffix;
        Callable<VoucherRedemptionResponse> request = () -> {
            Account principal = Account.builder().id(account.getId()).role(Role.USER).build();
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    principal, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
            try {
                start.await(5, TimeUnit.SECONDS);
                return voucherService.redeem(voucher.getId(), requestKey);
            } finally {
                SecurityContextHolder.clearContext();
            }
        };

        try {
            Future<VoucherRedemptionResponse> first = executor.submit(request);
            Future<VoucherRedemptionResponse> retry = executor.submit(request);
            VoucherRedemptionResponse firstResult = first.get(10, TimeUnit.SECONDS);
            VoucherRedemptionResponse retryResult = retry.get(10, TimeUnit.SECONDS);

            assertEquals(firstResult.getId(), retryResult.getId());
            assertEquals(300, accountRepository.findById(account.getId()).orElseThrow().getAvailablePoints());
            assertEquals(1, redemptionRepository.countByVoucherIdAndAccountId(voucher.getId(), account.getId()));
        } finally {
            executor.shutdownNow();
            redemptionRepository.deleteAll(redemptionRepository.findByAccountIdOrderByRedeemedAtDesc(account.getId()));
            voucherRepository.deleteById(voucher.getId());
            accountRepository.deleteById(account.getId());
        }
    }
}
