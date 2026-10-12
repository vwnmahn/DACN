package com.example.dacn.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.order-management.scheduler-enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class OrderMaintenanceScheduler {
    private final OrderManagementService orderManagementService;

    @Scheduled(fixedDelayString = "${app.order-management.scheduler-delay-ms:30000}")
    public void processTimeouts() {
        try {
            int cancelled = orderManagementService.cancelExpiredManualOrders();
            int reconciliation = orderManagementService.markExpiredPaymentsForReconciliation();
            if (cancelled > 0 || reconciliation > 0) {
                log.info("Order maintenance processed: cancelledOrders={}, reconciliationPayments={}",
                        cancelled, reconciliation);
            }
        } catch (RuntimeException exception) {
            log.error("Order maintenance batch failed: {}", exception.getClass().getSimpleName());
        }
    }
}
