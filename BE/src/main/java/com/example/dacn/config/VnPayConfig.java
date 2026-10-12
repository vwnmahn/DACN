package com.example.dacn.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "vnpay")
public class VnPayConfig {
    private String tmnCode;
    private String hashSecret;
    private String payUrl;
    private String returnUrl;
    private String transactionUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    private int connectTimeoutSeconds = 5;
    private int readTimeoutSeconds = 10;
    private int paymentTimeoutMinutes = 15;

    public boolean isConfigured() {
        return hasText(tmnCode) && hasText(hashSecret) && hasText(payUrl) && hasText(returnUrl);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
