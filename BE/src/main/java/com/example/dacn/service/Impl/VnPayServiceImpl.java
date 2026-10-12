package com.example.dacn.service.Impl;

import com.example.dacn.config.VnPayConfig;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.repository.OrderStatusHistoryRepository;
import com.example.dacn.service.PaymentService;
import com.example.dacn.service.VnPayService;
import com.example.dacn.service.VoucherService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class VnPayServiceImpl implements VnPayService {
    private static final String VERSION = "2.1.0";
    private static final ZoneId VNPAY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VNPAY_DATE = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final VnPayConfig config;
    private final PaymentService paymentService;
    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository historyRepository;
    private final VoucherService voucherService;

    @Override
    @Transactional
    public PaymentUrlResponse createPaymentUrl(Long orderId, String locale, String clientIp) {
        requireConfiguration();
        Payment payment = paymentService.createPendingPayment(orderId, PaymentMethod.VNPAY);
        Order payableOrder = orderRepository.findById(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (payableOrder.getStatus() != OrderStatus.AWAITING_PAYMENT) {
            throw new AppException(ErrorCode.VNPAY_ORDER_NOT_ACCEPTED);
        }
        if (payment.getPaymentUrl() != null && !payment.getPaymentUrl().isBlank()) {
            return toUrlResponse(payment);
        }

        ZonedDateTime now = ZonedDateTime.now(VNPAY_ZONE);
        Map<String, String> parameters = new TreeMap<>();
        parameters.put("vnp_Version", VERSION);
        parameters.put("vnp_Command", "pay");
        parameters.put("vnp_TmnCode", config.getTmnCode().trim());
        parameters.put("vnp_Amount", toVnPayAmount(payment.getAmount()));
        parameters.put("vnp_CurrCode", "VND");
        parameters.put("vnp_TxnRef", payment.getTransactionReference());
        parameters.put("vnp_OrderInfo", "Thanh toan don hang " + payment.getOrderId());
        parameters.put("vnp_OrderType", "other");
        parameters.put("vnp_Locale", "en".equalsIgnoreCase(locale) ? "en" : "vn");
        parameters.put("vnp_ReturnUrl", config.getReturnUrl().trim());
        parameters.put("vnp_IpAddr", normalizeIp(clientIp));
        parameters.put("vnp_CreateDate", now.format(VNPAY_DATE));
        parameters.put("vnp_ExpireDate", now.plusMinutes(config.getPaymentTimeoutMinutes()).format(VNPAY_DATE));

        String signedData = buildSignedData(parameters);
        String paymentUrl = config.getPayUrl().trim() + "?" + signedData
                + "&vnp_SecureHash=" + hmacSha512(config.getHashSecret(), signedData);
        payment = paymentService.updatePaymentUrl(payment.getTransactionReference(), paymentUrl);
        return toUrlResponse(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public VnPayReturnResponse processReturn(Map<String, String> parameters) {
        requireConfiguration();
        boolean valid = isValidSignature(parameters) && hasExpectedMerchant(parameters);
        String reference = parameters.get("vnp_TxnRef");
        Payment payment = reference == null ? null
                : paymentRepository.findByTransactionReference(reference).orElse(null);
        String responseCode = parameters.get("vnp_ResponseCode");
        String transactionStatus = parameters.get("vnp_TransactionStatus");
        String message;
        if (!valid) {
            message = "Chữ ký hoặc mã merchant VNPay không hợp lệ";
        } else if ("00".equals(responseCode) && "00".equals(transactionStatus)) {
            message = "VNPay báo giao dịch thành công; hệ thống đang chờ hoặc đã xử lý IPN";
        } else {
            message = "Giao dịch VNPay không thành công";
        }
        return VnPayReturnResponse.builder()
                .signatureValid(valid)
                .transactionReference(reference)
                .responseCode(responseCode)
                .transactionStatus(transactionStatus)
                .paymentStatus(payment == null ? null : payment.getPaymentStatus())
                .message(message)
                .build();
    }

    @Override
    @Transactional
    public VnPayIpnResponse processIpn(Map<String, String> parameters) {
        if (!config.isConfigured() || !isValidSignature(parameters) || !hasExpectedMerchant(parameters)) {
            return ipn("97", "Invalid signature");
        }

        String reference = parameters.get("vnp_TxnRef");
        Payment initial = reference == null ? null
                : paymentRepository.findByTransactionReference(reference).orElse(null);
        if (initial == null) {
            return ipn("01", "Order not found");
        }

        Order order = orderRepository.findByIdForUpdate(initial.getOrderId()).orElse(null);
        if (order == null) {
            return ipn("01", "Order not found");
        }
        Payment payment = paymentRepository.findByOrderIdForUpdate(order.getId()).stream()
                .filter(item -> item.getId().equals(initial.getId()))
                .findFirst().orElse(null);
        if (payment == null) {
            return ipn("01", "Order not found");
        }

        if (!amountMatches(payment.getAmount(), parameters.get("vnp_Amount"))) {
            return ipn("04", "Invalid amount");
        }
        if (payment.getPaymentStatus() == PaymentStatus.SUCCESS) {
            return ipn("02", "Order already confirmed");
        }
        if (payment.getPaymentStatus() != PaymentStatus.PENDING
                && payment.getPaymentStatus() != PaymentStatus.NEEDS_RECONCILIATION
                && payment.getPaymentStatus() != PaymentStatus.CANCELLED) {
            return ipn("02", "Order already confirmed");
        }
        boolean anotherSuccess = paymentRepository.findByOrderIdForUpdate(order.getId()).stream()
                .anyMatch(item -> !item.getId().equals(payment.getId())
                        && item.getPaymentStatus() == PaymentStatus.SUCCESS);
        if (anotherSuccess) {
            return ipn("02", "Order already confirmed");
        }

        String responseCode = parameters.get("vnp_ResponseCode");
        String transactionStatus = parameters.get("vnp_TransactionStatus");
        if ("00".equals(responseCode) && "00".equals(transactionStatus)) {
            String gatewayTransactionId = parameters.get("vnp_TransactionNo");
            if (gatewayTransactionId == null || gatewayTransactionId.isBlank()) {
                return ipn("99", "Missing transaction number");
            }
            Optional<Payment> sameGatewayTransaction = paymentRepository
                    .findByGatewayTransactionId(gatewayTransactionId);
            if (sameGatewayTransaction.isPresent()
                    && !sameGatewayTransaction.get().getId().equals(payment.getId())) {
                return ipn("99", "Transaction conflict");
            }

            payment.setPaymentStatus(PaymentStatus.SUCCESS);
            payment.setGatewayTransactionId(gatewayTransactionId);
            payment.setPaidAt(LocalDateTime.now(VNPAY_ZONE));
            payment.setPaymentMessage("Thanh toán VNPay thành công");
            paymentRepository.findByOrderIdForUpdate(order.getId()).stream()
                    .filter(other -> !other.getId().equals(payment.getId()))
                    .filter(other -> other.getPaymentStatus() == PaymentStatus.PENDING
                            || other.getPaymentStatus() == PaymentStatus.NEEDS_RECONCILIATION)
                    .forEach(other -> {
                        other.setPaymentStatus(PaymentStatus.CANCELLED);
                        other.setPaymentMessage("Đã có giao dịch khác của đơn hàng thanh toán thành công");
                        paymentRepository.save(other);
                    });
            if (order.getStatus() == OrderStatus.AWAITING_PAYMENT) {
                OrderStatus oldStatus = order.getStatus();
                order.setStatus(OrderStatus.CONFIRMED);
                order.setConfirmedAt(LocalDateTime.now(VNPAY_ZONE));
                recordSystemHistory(order, oldStatus, OrderStatus.CONFIRMED,
                        "VNPay IPN xác nhận thanh toán thành công");
                orderRepository.save(order);
            } else if (order.getStatus() == OrderStatus.CANCELLED) {
                order.setRefundRequired(true);
                orderRepository.save(order);
            }
            voucherService.applyForOrder(order.getId());
        } else {
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setPaymentMessage(truncate("VNPay response code: " + responseCode));
            if (order.getStatus() == OrderStatus.AWAITING_PAYMENT
                    || order.getStatus() == OrderStatus.PENDING) {
                OrderStatus oldStatus = order.getStatus();
                order.setStatus(OrderStatus.CANCELLED);
                order.setCancellationReason(OrderCancellationReason.PAYMENT_FAILED);
                order.setCancelledAt(LocalDateTime.now(VNPAY_ZONE));
                order.setConfirmationDeadline(null);
                recordSystemHistory(order, oldStatus, OrderStatus.CANCELLED,
                        "VNPay IPN báo thanh toán không thành công");
                orderRepository.save(order);
            }
            voucherService.releaseForOrder(order.getId());
        }
        paymentRepository.save(payment);
        return ipn("00", "Confirm Success");
    }

    @Override
    public boolean isValidSignature(Map<String, String> parameters) {
        if (parameters == null || !hasText(config.getHashSecret())) {
            return false;
        }
        String supplied = parameters.get("vnp_SecureHash");
        if (!hasText(supplied)) {
            return false;
        }
        Map<String, String> signedFields = new TreeMap<>();
        parameters.forEach((key, value) -> {
            if (key != null && key.startsWith("vnp_")
                    && !"vnp_SecureHash".equals(key)
                    && !"vnp_SecureHashType".equals(key)
                    && value != null && !value.isEmpty()) {
                signedFields.put(key, value);
            }
        });
        String expected = hmacSha512(config.getHashSecret(), buildSignedData(signedFields));
        return MessageDigest.isEqual(expected.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII),
                supplied.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }

    private String buildSignedData(Map<String, String> parameters) {
        return parameters.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isEmpty())
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right).orElse("");
    }

    private String hmacSha512(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot create VNPay signature", e);
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String toVnPayAmount(BigDecimal amount) {
        try {
            return amount.movePointRight(2).longValueExact() + "";
        } catch (ArithmeticException e) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }
    }

    private boolean amountMatches(BigDecimal amount, String rawAmount) {
        if (!hasText(rawAmount)) {
            return false;
        }
        try {
            return amount.movePointRight(2).longValueExact() == Long.parseLong(rawAmount);
        } catch (ArithmeticException | NumberFormatException e) {
            return false;
        }
    }

    private boolean hasExpectedMerchant(Map<String, String> parameters) {
        return parameters != null && config.getTmnCode() != null
                && config.getTmnCode().trim().equals(parameters.get("vnp_TmnCode"));
    }

    private void requireConfiguration() {
        if (!config.isConfigured()) {
            throw new AppException(ErrorCode.VNPAY_CONFIGURATION_MISSING);
        }
    }

    private String normalizeIp(String ip) {
        if (!hasText(ip)) {
            return "127.0.0.1";
        }
        String value = ip.split(",")[0].trim();
        return value.length() <= 45 ? value : "127.0.0.1";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String truncate(String value) {
        return value.substring(0, Math.min(value.length(), 500));
    }

    private VnPayIpnResponse ipn(String code, String message) {
        return VnPayIpnResponse.builder().rspCode(code).message(message).build();
    }

    private PaymentUrlResponse toUrlResponse(Payment payment) {
        return PaymentUrlResponse.builder()
                .paymentId(payment.getId())
                .orderId(payment.getOrderId())
                .transactionReference(payment.getTransactionReference())
                .amount(payment.getAmount())
                .status(payment.getPaymentStatus())
                .paymentUrl(payment.getPaymentUrl())
                .build();
    }

    private void recordSystemHistory(Order order, OrderStatus oldStatus, OrderStatus newStatus,
                                     String reason) {
        historyRepository.save(OrderStatusHistory.builder().order(order).oldStatus(oldStatus)
                .newStatus(newStatus).actorType(OrderStatusActorType.SYSTEM)
                .changedAt(LocalDateTime.now(VNPAY_ZONE)).reason(reason).build());
    }
}
