package com.example.dacn.service.Impl;

import com.example.dacn.dto.request.CheckoutRequest;
import com.example.dacn.dto.request.CreateOrderRequest;
import com.example.dacn.dto.response.*;
import com.example.dacn.entity.Payment;
import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.OrderStatus;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CheckoutServiceImpl implements CheckoutService {
    private final OrderService orderService;
    private final PaymentService paymentService;
    private final VnPayService vnPayService;

    @Override
    @Transactional
    public CheckoutResponse checkout(CheckoutRequest request, String clientIp) {
        if (request == null || (request.getPaymentMethod() != PaymentMethod.COD
                && request.getPaymentMethod() != PaymentMethod.VNPAY)) {
            throw new AppException(ErrorCode.CHECKOUT_PAYMENT_METHOD_UNSUPPORTED);
        }

        OrderResponse order = orderService.createOrder(toOrderRequest(request));
        CheckoutPaymentResponse payment = request.getPaymentMethod() == PaymentMethod.VNPAY
                ? createVnPay(order, request.getLocale(), clientIp)
                : createCod(order.getId());
        return CheckoutResponse.builder().order(order).payment(payment).build();
    }

    private CheckoutPaymentResponse createCod(Long orderId) {
        Payment payment = paymentService.createPendingPayment(orderId, PaymentMethod.COD);
        return CheckoutPaymentResponse.builder()
                .paymentId(payment.getId()).method(PaymentMethod.COD)
                .status(payment.getPaymentStatus())
                .transactionReference(payment.getTransactionReference())
                .amount(payment.getAmount()).build();
    }

    private CheckoutPaymentResponse createVnPay(OrderResponse order, String locale, String clientIp) {
        if (order.getStatus() == OrderStatus.PENDING) {
            Payment pending = paymentService.createPendingPayment(order.getId(), PaymentMethod.VNPAY);
            return CheckoutPaymentResponse.builder()
                    .paymentId(pending.getId()).method(PaymentMethod.VNPAY)
                    .status(pending.getPaymentStatus()).transactionReference(pending.getTransactionReference())
                    .amount(pending.getAmount()).paymentUrl(null).build();
        }
        PaymentUrlResponse payment = vnPayService.createPaymentUrl(order.getId(), locale, clientIp);
        return CheckoutPaymentResponse.builder()
                .paymentId(payment.getPaymentId()).method(PaymentMethod.VNPAY)
                .status(payment.getStatus()).transactionReference(payment.getTransactionReference())
                .amount(payment.getAmount()).paymentUrl(payment.getPaymentUrl()).build();
    }

    private CreateOrderRequest toOrderRequest(CheckoutRequest request) {
        CreateOrderRequest target = new CreateOrderRequest();
        target.setRestaurantId(request.getRestaurantId());
        target.setIdempotencyKey(request.getIdempotencyKey());
        target.setRecipientName(request.getRecipientName());
        target.setRecipientPhone(request.getRecipientPhone());
        target.setDeliveryAddress(request.getDeliveryAddress());
        target.setDeliveryNote(request.getDeliveryNote());
        target.setPaymentMethod(request.getPaymentMethod());
        target.setVoucherCode(request.getVoucherCode());
        target.setDeliveryLatitude(request.getDeliveryLatitude());
        target.setDeliveryLongitude(request.getDeliveryLongitude());
        target.setItems(request.getItems().stream().map(item -> {
            CreateOrderRequest.Item targetItem = new CreateOrderRequest.Item();
            targetItem.setMenuItemId(item.getMenuItemId());
            targetItem.setQuantity(item.getQuantity());
            return targetItem;
        }).toList());
        return target;
    }
}
