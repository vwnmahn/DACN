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
    private Duration confirmationTimeout = Duration.ofMinutes(10);
    private int schedulerBatchSize = 100;
    private Duration paymentPendingTimeout = Duration.ofMinutes(15);
}
