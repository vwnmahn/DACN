package com.example.dacn.gateway;

import com.example.dacn.config.VnPayConfig;
import com.example.dacn.entity.Payment;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Component
@RequiredArgsConstructor
public class VnPayTransactionGatewayImpl implements VnPayTransactionGateway {
    private static final String VERSION = "2.1.0";
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final VnPayConfig config;
    private final ObjectMapper objectMapper;

    @Override
    public VnPayTransactionResult query(Payment payment, String requestId, String clientIp) {
        String createDate = ZonedDateTime.now(ZONE).format(DATE);
        String transactionDate = transactionDate(payment);
        String orderInfo = "Doi soat giao dich " + payment.getTransactionReference();
        Map<String, String> body = base(requestId, "querydr", payment);
        body.put("vnp_OrderInfo", orderInfo);
        body.put("vnp_TransactionNo", blank(payment.getGatewayTransactionId()));
        body.put("vnp_TransactionDate", transactionDate);
        body.put("vnp_CreateDate", createDate);
        body.put("vnp_IpAddr", normalizeIp(clientIp));
        body.put("vnp_SecureHash", sign(String.join("|", requestId, VERSION, "querydr",
                config.getTmnCode().trim(), payment.getTransactionReference(), transactionDate,
                createDate, normalizeIp(clientIp), orderInfo)));
        return post(body, true);
    }

    @Override
    public VnPayTransactionResult refund(Payment payment, BigDecimal amount, String requestId,
                                         String createdBy, String clientIp, String reason) {
        String createDate = ZonedDateTime.now(ZONE).format(DATE);
        String transactionDate = transactionDate(payment);
        String rawAmount = vnPayAmount(amount);
        String orderInfo = "Hoan tien " + payment.getTransactionReference() + ": " + reason;
        if (orderInfo.length() > 255) orderInfo = orderInfo.substring(0, 255);
        Map<String, String> body = base(requestId, "refund", payment);
        body.put("vnp_TransactionType", "02");
        body.put("vnp_Amount", rawAmount);
        body.put("vnp_OrderInfo", orderInfo);
        body.put("vnp_TransactionNo", blank(payment.getGatewayTransactionId()));
        body.put("vnp_TransactionDate", transactionDate);
        body.put("vnp_CreateBy", createdBy);
        body.put("vnp_CreateDate", createDate);
        body.put("vnp_IpAddr", normalizeIp(clientIp));
        body.put("vnp_SecureHash", sign(String.join("|", requestId, VERSION, "refund",
                config.getTmnCode().trim(), "02", payment.getTransactionReference(), rawAmount,
                blank(payment.getGatewayTransactionId()), transactionDate, createdBy, createDate,
                normalizeIp(clientIp), orderInfo)));
        return post(body, false);
    }

    private Map<String, String> base(String requestId, String command, Payment payment) {
        requireConfiguration();
        Map<String, String> body = new LinkedHashMap<>();
        body.put("vnp_RequestId", requestId);
        body.put("vnp_Version", VERSION);
        body.put("vnp_Command", command);
        body.put("vnp_TmnCode", config.getTmnCode().trim());
        body.put("vnp_TxnRef", payment.getTransactionReference());
        return body;
    }

    private VnPayTransactionResult post(Map<String, String> body, boolean query) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(config.getConnectTimeoutSeconds())).build();
            HttpRequest request = HttpRequest.newBuilder(URI.create(config.getTransactionUrl()))
                    .timeout(Duration.ofSeconds(config.getReadTimeoutSeconds()))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AppException(ErrorCode.PAYMENT_GATEWAY_UNAVAILABLE);
            }
            Map<String, String> values = objectMapper.readValue(response.body(), new TypeReference<>() {});
            return mapAndVerify(values, query);
        } catch (AppException exception) {
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_UNAVAILABLE);
        } catch (Exception exception) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_UNAVAILABLE);
        }
    }

    private VnPayTransactionResult mapAndVerify(Map<String, String> v, boolean query) {
        String data = query
                ? join(v, "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message",
                "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate",
                "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus",
                "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount")
                : join(v, "vnp_ResponseId", "vnp_Command", "vnp_ResponseCode", "vnp_Message",
                "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate",
                "vnp_TransactionNo", "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo");
        String supplied = v.get("vnp_SecureHash");
        boolean valid = supplied != null && MessageDigest.isEqual(
                sign(data).toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII),
                supplied.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
        return VnPayTransactionResult.builder().signatureValid(valid).command(v.get("vnp_Command"))
                .tmnCode(v.get("vnp_TmnCode")).transactionReference(v.get("vnp_TxnRef"))
                .amount(v.get("vnp_Amount")).responseCode(v.get("vnp_ResponseCode"))
                .transactionStatus(v.get("vnp_TransactionStatus"))
                .transactionNo(v.get("vnp_TransactionNo")).transactionType(v.get("vnp_TransactionType"))
                .message(v.get("vnp_Message")).build();
    }

    private String join(Map<String, String> values, String... keys) {
        return Arrays.stream(keys).map(key -> blank(values.get(key))).reduce((a, b) -> a + "|" + b).orElse("");
    }
    private String blank(String value) { return value == null ? "" : value; }
    private String vnPayAmount(BigDecimal amount) { return amount.movePointRight(2).longValueExact() + ""; }
    private String normalizeIp(String ip) {
        if (ip == null || ip.isBlank()) return "127.0.0.1";
        String result = ip.split(",")[0].trim();
        return result.length() <= 45 ? result : "127.0.0.1";
    }
    private String transactionDate(Payment payment) {
        if (payment.getPaymentUrl() != null) {
            int queryIndex = payment.getPaymentUrl().indexOf('?');
            if (queryIndex >= 0) {
                for (String pair : payment.getPaymentUrl().substring(queryIndex + 1).split("&")) {
                    String[] parts = pair.split("=", 2);
                    if (parts.length == 2 && "vnp_CreateDate".equals(parts[0])) {
                        String value = URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
                        if (value.matches("\\d{14}")) return value;
                    }
                }
            }
        }
        if (payment.getCreatedAt() == null) throw new AppException(ErrorCode.PAYMENT_GATEWAY_RESPONSE_INVALID);
        return payment.getCreatedAt().format(DATE);
    }
    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(config.getHashSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) { throw new IllegalStateException("Cannot create VNPay signature", exception); }
    }
    private void requireConfiguration() {
        if (!config.isConfigured() || config.getTransactionUrl() == null || config.getTransactionUrl().isBlank())
            throw new AppException(ErrorCode.VNPAY_CONFIGURATION_MISSING);
    }
}
