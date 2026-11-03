package com.example.dacn.dto.response;

import com.example.dacn.entity.PaymentMethod;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class AdminRevenueReportResponse {
    private Summary summary;
    private List<DailyRevenue> dailyRevenue;
    private List<BranchRevenue> branchRevenue;
    private List<Transaction> recentTransactions;

    @Getter
    @Builder
    public static class Summary {
        private BigDecimal totalRevenue;
        private long totalOrders;
        private BigDecimal averageOrderValue;
    }

    @Getter
    @Builder
    public static class DailyRevenue {
        private LocalDate date;
        private BigDecimal revenue;
        private long orderCount;
    }

    @Getter
    @Builder
    public static class BranchRevenue {
        private Long restaurantId;
        private String restaurantName;
        private BigDecimal revenue;
        private long orderCount;
    }

    @Getter
    @Builder
    public static class Transaction {
        private Long paymentId;
        private Long orderId;
        private String transactionReference;
        private PaymentMethod paymentMethod;
        private BigDecimal amount;
        private LocalDateTime paidAt;
        private Long restaurantId;
        private String restaurantName;
    }
}
