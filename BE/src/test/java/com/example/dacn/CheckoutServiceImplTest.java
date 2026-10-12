package com.example.dacn;

import com.example.dacn.dto.request.CheckoutRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.*;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.service.*;
import com.example.dacn.service.Impl.CheckoutServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckoutServiceImplTest {
    @Mock OrderService orderService;
    @Mock PaymentService paymentService;
    @Mock VnPayService vnPayService;
    @InjectMocks CheckoutServiceImpl service;

    @Test
    void createsCodCheckoutFromPersistedOrder() {
        CheckoutRequest request = request(PaymentMethod.COD);
        OrderResponse order = OrderResponse.builder().id(11L).totalAmount(new BigDecimal("65000")).build();
        Payment payment = Payment.builder().id(12L).orderId(11L).paymentMethod(PaymentMethod.COD)
                .paymentStatus(PaymentStatus.PENDING).amount(new BigDecimal("65000"))
                .transactionReference("FCA-COD").build();
        when(orderService.createOrder(any())).thenReturn(order);
        when(paymentService.createPendingPayment(11L, PaymentMethod.COD)).thenReturn(payment);

        CheckoutResponse response = service.checkout(request, "127.0.0.1");

        assertSame(order, response.getOrder());
        assertEquals(PaymentMethod.COD, response.getPayment().getMethod());
        assertNull(response.getPayment().getPaymentUrl());
        verifyNoInteractions(vnPayService);
    }

    @Test
    void createsOrderBeforeRequestingVnPayUrl() {
        CheckoutRequest request = request(PaymentMethod.VNPAY);
        OrderResponse order = OrderResponse.builder().id(21L).status(OrderStatus.AWAITING_PAYMENT).build();
        PaymentUrlResponse url = PaymentUrlResponse.builder().paymentId(22L).orderId(21L)
                .status(PaymentStatus.PENDING).amount(new BigDecimal("65000"))
                .transactionReference("FCA-VNPAY").paymentUrl("https://sandbox/payment").build();
        when(orderService.createOrder(any())).thenReturn(order);
        when(vnPayService.createPaymentUrl(21L, "vn", "10.0.0.1")).thenReturn(url);

        CheckoutResponse response = service.checkout(request, "10.0.0.1");

        InOrder calls = inOrder(orderService, vnPayService);
        calls.verify(orderService).createOrder(any());
        calls.verify(vnPayService).createPaymentUrl(21L, "vn", "10.0.0.1");
        assertEquals("https://sandbox/payment", response.getPayment().getPaymentUrl());
    }

    @Test
    void manualVnPayCheckoutDoesNotExposePaymentUrlBeforeAdminAcceptance() {
        CheckoutRequest request = request(PaymentMethod.VNPAY);
        OrderResponse order = OrderResponse.builder().id(31L).status(OrderStatus.PENDING).build();
        Payment payment = Payment.builder().id(32L).orderId(31L).paymentMethod(PaymentMethod.VNPAY)
                .paymentStatus(PaymentStatus.PENDING).amount(new BigDecimal("65000"))
                .transactionReference("FCA-MANUAL").build();
        when(orderService.createOrder(any())).thenReturn(order);
        when(paymentService.createPendingPayment(31L, PaymentMethod.VNPAY)).thenReturn(payment);

        CheckoutResponse response = service.checkout(request, "10.0.0.1");

        assertNull(response.getPayment().getPaymentUrl());
        assertEquals(PaymentStatus.PENDING, response.getPayment().getStatus());
        verifyNoInteractions(vnPayService);
    }

    @Test
    void propagatesIdempotencyConflictWithoutCreatingPayment() {
        CheckoutRequest request = request(PaymentMethod.COD);
        when(orderService.createOrder(any()))
                .thenThrow(new AppException(ErrorCode.ORDER_IDEMPOTENCY_CONFLICT));

        AppException exception = assertThrows(AppException.class,
                () -> service.checkout(request, "127.0.0.1"));

        assertEquals(ErrorCode.ORDER_IDEMPOTENCY_CONFLICT, exception.getErrorCode());
        verifyNoInteractions(paymentService, vnPayService);
    }

    @Test
    void rejectsUnsupportedPaymentMethod() {
        CheckoutRequest request = request(PaymentMethod.MOMO);
        AppException exception = assertThrows(AppException.class,
                () -> service.checkout(request, "127.0.0.1"));
        assertEquals(ErrorCode.CHECKOUT_PAYMENT_METHOD_UNSUPPORTED, exception.getErrorCode());
        verifyNoInteractions(orderService, paymentService, vnPayService);
    }

    private CheckoutRequest request(PaymentMethod method) {
        CheckoutRequest request = new CheckoutRequest();
        request.setRestaurantId(1L);
        request.setIdempotencyKey("checkout-key");
        request.setRecipientName("Nguyễn Văn A");
        request.setRecipientPhone("0901234567");
        request.setDeliveryAddress("1 Đường FCA");
        request.setPaymentMethod(method);
        request.setLocale("vn");
        request.setDeliveryLatitude(new BigDecimal("10.78"));
        request.setDeliveryLongitude(new BigDecimal("106.70"));
        CheckoutRequest.Item item = new CheckoutRequest.Item();
        item.setMenuItemId(2L);
        item.setQuantity(1);
        request.setItems(List.of(item));
        return request;
    }
}
