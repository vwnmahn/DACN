package com.example.dacn;

import com.example.dacn.entity.*;
import com.example.dacn.repository.AccountRepository;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.repository.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminPaymentIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired AccountRepository accountRepository;
    @Autowired RestaurantRepository restaurantRepository;
    @Autowired OrderRepository orderRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired EntityManager entityManager;

    private Account customer;
    private Order order;
    private Payment codPayment;
    private Payment vnPayPayment;

    @BeforeEach
    void setUp() {
        customer = accountRepository.save(Account.builder()
                .username("payment_customer").email("payment-customer@example.test")
                .phoneNumber("0901234599").role(Role.USER).locked(false).build());
        Restaurant restaurant = restaurantRepository.save(Restaurant.builder()
                .name("Payment Test Restaurant").address("Payment Test Address")
                .phoneNumber("0909999999").openingTime(LocalTime.of(6, 0))
                .closingTime(LocalTime.of(23, 0)).deliveryFee(new BigDecimal("15000"))
                .deliveryRadiusKm(10.0).baseDistanceKm(new BigDecimal("3"))
                .additionalFeePerKm(new BigDecimal("5000")).active(true)
                .orderConfirmationMode(OrderConfirmationMode.MANUAL).build());
        order = orderRepository.save(Order.builder().account(customer).restaurant(restaurant)
                .status(OrderStatus.AWAITING_PAYMENT).refundRequired(true)
                .subtotal(new BigDecimal("100000")).deliveryFee(new BigDecimal("15000"))
                .discountAmount(BigDecimal.ZERO).totalAmount(new BigDecimal("115000"))
                .recipientName("Payment Customer").recipientPhone("0901234599")
                .deliveryAddress("Payment Test Address").idempotencyKey("admin-payment-test")
                .requestFingerprint("0123456789012345678901234567890123456789012345678901234567890123")
                .build());
        codPayment = paymentRepository.save(Payment.builder().orderId(order.getId())
                .paymentMethod(PaymentMethod.COD).paymentStatus(PaymentStatus.PENDING)
                .amount(new BigDecimal("115000")).transactionReference("FCA-COD-ADMIN-TEST")
                .paymentMessage("Chờ thu tiền COD").build());
        vnPayPayment = paymentRepository.save(Payment.builder().orderId(order.getId())
                .paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.NEEDS_RECONCILIATION)
                .amount(new BigDecimal("115000")).transactionReference("FCA-VNPAY-ADMIN-TEST")
                .gatewayTransactionId("VNPAY-GATEWAY-TEST")
                .paymentUrl("https://sensitive-payment-url.example")
                .paymentMessage("Cần đối soát").paidAt(LocalDateTime.now()).build());
        paymentRepository.flush();
        // Payment owns the legacy scalar orderId while its JPA association is read-only.
        // Clear saved instances so API queries verify the association exactly as production reads do.
        entityManager.clear();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanFilterAndSortPaymentPageAtDatabaseLevel() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments")
                        .param("paymentStatus", "NEEDS_RECONCILIATION")
                        .param("paymentMethod", "VNPAY")
                        .param("orderId", order.getId().toString())
                        .param("accountId", customer.getId().toString())
                        .param("transactionReference", "vnpay-admin")
                        .param("page", "0").param("size", "10")
                        .param("sortBy", "amount").param("sortDirection", "desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(1000))
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id").value(vnPayPayment.getId()))
                .andExpect(jsonPath("$.data.content[0].accountId").value(customer.getId()))
                .andExpect(jsonPath("$.data.content[0].needsReconciliation").value(true))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.sortBy").value("amount"))
                .andExpect(jsonPath("$.data.sortDirection").value("desc"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanViewCodPaymentDetail() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments/{id}", codPayment.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentMethod").value("COD"))
                .andExpect(jsonPath("$.data.paymentStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.refundRequired").value(true));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void vnPayDetailContainsBusinessFieldsButNotPaymentUrl() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments/{id}", vnPayPayment.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentMethod").value("VNPAY"))
                .andExpect(jsonPath("$.data.gatewayTransactionId").value("VNPAY-GATEWAY-TEST"))
                .andExpect(jsonPath("$.data.needsReconciliation").value(true))
                .andExpect(jsonPath("$.data.paymentUrl").doesNotExist())
                .andExpect(content().string(not(containsString("sensitive-payment-url"))));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void missingPaymentReturnsBusinessNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(4001));
    }

    @Test
    @WithMockUser(roles = "USER")
    void userCannotAccessAdminPayments() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payments"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(1010));
    }
}
