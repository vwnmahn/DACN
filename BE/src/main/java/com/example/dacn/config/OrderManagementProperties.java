package com.example.dacn.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.order-management")
public class OrderManagementProperties {
    private Duration confirmationTimeout = Duration.ofSeconds(60);
    private Duration autoConfirmationDelay = Duration.ofSeconds(15);
    private Duration customerCancellationWindow = Duration.ofSeconds(15);
    private int schedulerBatchSize = 100;
    private Duration paymentPendingTimeout = Duration.ofMinutes(15);
}
