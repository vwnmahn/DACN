package com.example.dacn;

import com.example.dacn.config.VnPayConfig;
import com.example.dacn.entity.*;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.repository.OrderStatusHistoryRepository;
import com.example.dacn.service.PaymentService;
import com.example.dacn.service.VoucherService;
import com.example.dacn.service.Impl.VnPayServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VnPayServiceImplTest {
    private static final String SECRET = "test-secret";
    @Mock PaymentService paymentService;
    @Mock VoucherService voucherService;
    @Mock PaymentRepository paymentRepository;
    @Mock OrderRepository orderRepository;
    @Mock OrderStatusHistoryRepository historyRepository;
    private VnPayServiceImpl service;
    private Payment payment;
    private Order order;

    @BeforeEach
    void setUp() {
        VnPayConfig config = new VnPayConfig();
        config.setTmnCode("TESTCODE");
        config.setHashSecret(SECRET);
        config.setPayUrl("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
        config.setReturnUrl("https://merchant.example/api/v1/payments/vnpay/return");
        config.setPaymentTimeoutMinutes(15);
        service = new VnPayServiceImpl(config, paymentService, paymentRepository, orderRepository,
                historyRepository, voucherService);

        Account account = Account.builder().id(1L).role(Role.USER).build();
        order = Order.builder().id(10L).account(account).status(OrderStatus.AWAITING_PAYMENT)
                .totalAmount(new BigDecimal("100000.00")).build();
        payment = Payment.builder().id(20L).orderId(10L).paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.PENDING).amount(new BigDecimal("100000.00"))
                .transactionReference("FCA-REF-1").build();
    }

    @Test
    void createsSignedPaymentUrlUsingBackendAmount() throws Exception {
        when(paymentService.createPendingPayment(10L, PaymentMethod.VNPAY)).thenReturn(payment);
        when(orderRepository.findById(10L)).thenReturn(Optional.of(order));
        when(paymentService.updatePaymentUrl(eq("FCA-REF-1"), anyString())).thenAnswer(invocation -> {
            payment.setPaymentUrl(invocation.getArgument(1));
            return payment;
        });

        var response = service.createPaymentUrl(10L, "vn", "127.0.0.1");
        Map<String, String> query = parseQuery(response.getPaymentUrl());

        assertEquals("10000000", query.get("vnp_Amount"));
        assertEquals("TESTCODE", query.get("vnp_TmnCode"));
        assertEquals("FCA-REF-1", query.get("vnp_TxnRef"));
        assertTrue(service.isValidSignature(query));
    }

    @Test
    void rejectsTamperedSignature() {
        Map<String, String> parameters = signedCallback("00", "00", "10000000", "TXN-1");
        assertTrue(service.isValidSignature(parameters));
        parameters.put("vnp_Amount", "999");
        assertFalse(service.isValidSignature(parameters));
    }

    @Test
    void successfulIpnUpdatesPaymentAndConfirmsOrder() {
        mockLockedEntities();
        when(paymentRepository.findByGatewayTransactionId("TXN-1")).thenReturn(Optional.empty());

        var response = service.processIpn(signedCallback("00", "00", "10000000", "TXN-1"));

        assertEquals("00", response.getRspCode());
        assertEquals(PaymentStatus.SUCCESS, payment.getPaymentStatus());
        assertEquals("TXN-1", payment.getGatewayTransactionId());
        assertEquals(OrderStatus.CONFIRMED, order.getStatus());
        verify(voucherService).applyForOrder(order.getId());
        verify(paymentRepository).save(payment);
        verify(orderRepository).save(order);
    }

    @Test
    void failedIpnMarksPaymentFailedWithoutCompletingOrder() {
        mockLockedEntities();

        var response = service.processIpn(signedCallback("24", "02", "10000000", "TXN-2"));

        assertEquals("00", response.getRspCode());
        assertEquals(PaymentStatus.FAILED, payment.getPaymentStatus());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(voucherService).releaseForOrder(order.getId());
        verify(orderRepository).save(order);
    }

    @Test
    void duplicateCallbackIsIdempotent() {
        payment.setPaymentStatus(PaymentStatus.SUCCESS);
        mockLockedEntities();

        var response = service.processIpn(signedCallback("00", "00", "10000000", "TXN-1"));

        assertEquals("02", response.getRspCode());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void delayedSuccessfulIpnOnCancelledOrderRequiresRefund() {
        order.setStatus(OrderStatus.CANCELLED);
        payment.setPaymentStatus(PaymentStatus.NEEDS_RECONCILIATION);
        mockLockedEntities();
        when(paymentRepository.findByGatewayTransactionId("TXN-1")).thenReturn(Optional.empty());

        var response = service.processIpn(signedCallback("00", "00", "10000000", "TXN-1"));

        assertEquals("00", response.getRspCode());
        assertEquals(PaymentStatus.SUCCESS, payment.getPaymentStatus());
        assertTrue(order.getRefundRequired());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
    }

    @Test
    void rejectsAmountMismatch() {
        mockLockedEntities();

        var response = service.processIpn(signedCallback("00", "00", "5000000", "TXN-1"));

        assertEquals("04", response.getRspCode());
        assertEquals(PaymentStatus.PENDING, payment.getPaymentStatus());
    }

    @Test
    void rejectsSecondSuccessfulPaymentForSameOrder() {
        Payment successful = Payment.builder().id(21L).orderId(10L)
                .paymentMethod(PaymentMethod.VNPAY).paymentStatus(PaymentStatus.SUCCESS)
                .amount(payment.getAmount()).transactionReference("OTHER").build();
        when(paymentRepository.findByTransactionReference("FCA-REF-1")).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(paymentRepository.findByOrderIdForUpdate(10L)).thenReturn(List.of(payment, successful));

        var response = service.processIpn(signedCallback("00", "00", "10000000", "TXN-1"));

        assertEquals("02", response.getRspCode());
        assertEquals(PaymentStatus.PENDING, payment.getPaymentStatus());
    }

    @Test
    void returnUrlNeverMutatesPayment() {
        when(paymentRepository.findByTransactionReference("FCA-REF-1")).thenReturn(Optional.of(payment));

        var response = service.processReturn(signedCallback("00", "00", "10000000", "TXN-1"));

        assertTrue(response.isSignatureValid());
        assertEquals(PaymentStatus.PENDING, payment.getPaymentStatus());
        verify(paymentRepository, never()).save(any());
    }

    private void mockLockedEntities() {
        when(paymentRepository.findByTransactionReference("FCA-REF-1")).thenReturn(Optional.of(payment));
        when(orderRepository.findByIdForUpdate(10L)).thenReturn(Optional.of(order));
        when(paymentRepository.findByOrderIdForUpdate(10L)).thenReturn(List.of(payment));
    }

    private Map<String, String> signedCallback(String responseCode, String status,
                                                String amount, String transactionNo) {
        Map<String, String> parameters = new TreeMap<>();
        parameters.put("vnp_TmnCode", "TESTCODE");
        parameters.put("vnp_TxnRef", "FCA-REF-1");
        parameters.put("vnp_Amount", amount);
        parameters.put("vnp_ResponseCode", responseCode);
        parameters.put("vnp_TransactionStatus", status);
        parameters.put("vnp_TransactionNo", transactionNo);
        parameters.put("vnp_SecureHash", sign(parameters));
        return parameters;
    }

    private String sign(Map<String, String> parameters) {
        try {
            String data = parameters.entrySet().stream()
                    .filter(entry -> !entry.getKey().equals("vnp_SecureHash"))
                    .sorted(Map.Entry.comparingByKey())
                    .map(entry -> URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                            + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                    .reduce((left, right) -> left + "&" + right).orElse("");
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    private Map<String, String> parseQuery(String url) throws Exception {
        Map<String, String> result = new HashMap<>();
        for (String pair : new URI(url).getRawQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            result.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
        }
        return result;
    }
}
