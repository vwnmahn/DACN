package com.example.dacn.service.impl;

import com.example.dacn.dto.response.AdminRevenueReportResponse;
import com.example.dacn.entity.Payment;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.service.AdminRevenueReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminRevenueReportServiceImpl implements AdminRevenueReportService {
    private static final int RECENT_TRANSACTION_LIMIT = 20;
    private final PaymentRepository paymentRepository;

    @Override
    @Transactional(readOnly = true)
    public AdminRevenueReportResponse getReport(LocalDate from, LocalDate to, Long restaurantId) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("Khoảng thời gian báo cáo không hợp lệ");
        }

        List<Payment> payments = paymentRepository.findRevenuePayments(
                from.atStartOfDay(), to.plusDays(1).atStartOfDay(), restaurantId);
        BigDecimal total = payments.stream().map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = payments.isEmpty() ? BigDecimal.ZERO
                : total.divide(BigDecimal.valueOf(payments.size()), 2, RoundingMode.HALF_UP);

        Map<LocalDate, RevenueAccumulator> byDate = new LinkedHashMap<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            byDate.put(date, new RevenueAccumulator());
        }
        Map<Long, BranchAccumulator> byBranch = new LinkedHashMap<>();
        for (Payment payment : payments) {
            byDate.get(payment.getPaidAt().toLocalDate()).add(payment.getAmount());
            Restaurant restaurant = payment.getOrder().getRestaurant();
            byBranch.computeIfAbsent(restaurant.getId(), ignored -> new BranchAccumulator(restaurant))
                    .add(payment.getAmount());
        }

        List<AdminRevenueReportResponse.DailyRevenue> daily = byDate.entrySet().stream()
                .map(entry -> AdminRevenueReportResponse.DailyRevenue.builder()
                        .date(entry.getKey()).revenue(entry.getValue().revenue)
                        .orderCount(entry.getValue().count).build())
                .toList();
        List<AdminRevenueReportResponse.BranchRevenue> branches = byBranch.values().stream()
                .map(BranchAccumulator::toResponse).toList();
        List<AdminRevenueReportResponse.Transaction> transactions = payments.stream()
                .limit(RECENT_TRANSACTION_LIMIT).map(this::toTransaction).toList();

        return AdminRevenueReportResponse.builder()
                .summary(AdminRevenueReportResponse.Summary.builder()
                        .totalRevenue(total).totalOrders(payments.size()).averageOrderValue(average).build())
                .dailyRevenue(daily).branchRevenue(branches).recentTransactions(transactions).build();
    }

    private AdminRevenueReportResponse.Transaction toTransaction(Payment payment) {
        Restaurant restaurant = payment.getOrder().getRestaurant();
        return AdminRevenueReportResponse.Transaction.builder()
                .paymentId(payment.getId()).orderId(payment.getOrderId())
                .transactionReference(payment.getTransactionReference())
                .paymentMethod(payment.getPaymentMethod()).amount(payment.getAmount())
                .paidAt(payment.getPaidAt()).restaurantId(restaurant.getId())
                .restaurantName(restaurant.getName()).build();
    }

    private static class RevenueAccumulator {
        protected BigDecimal revenue = BigDecimal.ZERO;
        protected long count;
        protected void add(BigDecimal amount) { revenue = revenue.add(amount); count++; }
    }

    private static class BranchAccumulator extends RevenueAccumulator {
        private final Restaurant restaurant;
        private BranchAccumulator(Restaurant restaurant) { this.restaurant = restaurant; }
        private AdminRevenueReportResponse.BranchRevenue toResponse() {
            return AdminRevenueReportResponse.BranchRevenue.builder()
                    .restaurantId(restaurant.getId()).restaurantName(restaurant.getName())
                    .revenue(revenue).orderCount(count).build();
        }
    }
}
