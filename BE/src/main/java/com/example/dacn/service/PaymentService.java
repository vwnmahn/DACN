
package com.example.dacn.service;

import com.example.dacn.entity.Payment;
import com.example.dacn.entity.PaymentMethod;

import java.util.List;
import com.example.dacn.dto.response.PaymentStatusResponse;
import com.example.dacn.dto.response.AdminPaymentPageResponse;
import com.example.dacn.dto.response.AdminPaymentResponse;
import com.example.dacn.entity.PaymentStatus;
import java.time.LocalDateTime;

public interface PaymentService {

    // Tạo giao dịch chờ thanh toán
    Payment createPendingPayment(
            Long orderId,
            PaymentMethod paymentMethod
    );

    // Lấy giao dịch theo ID
    Payment getPaymentById(Long paymentId);

    // Lấy giao dịch theo mã tham chiếu
    Payment getPaymentByReference(String reference);

    // Lấy lịch sử thanh toán của đơn hàng
    List<Payment> getPaymentsByOrderId(Long orderId);

    // Lưu URL thanh toán từ cổng
    Payment updatePaymentUrl(
            String reference,
            String paymentUrl
    );

    // Xác nhận thanh toán thành công
    Payment confirmPaymentSuccess(
            String reference,
            String gatewayTransactionId
    );

    // Xác nhận thanh toán thất bại
    Payment confirmPaymentFailed(
            String reference,
            String message
    );

    PaymentStatusResponse getStatusForCurrentUser(Long orderId);

    AdminPaymentPageResponse searchAdminPayments(PaymentStatus paymentStatus,
                                                   PaymentMethod paymentMethod,
                                                   Long orderId,
                                                   Long accountId,
                                                   LocalDateTime createdFrom,
                                                   LocalDateTime createdTo,
                                                   String transactionReference,
                                                   int page,
                                                   int size,
                                                   String sortBy,
                                                   String sortDirection);

    AdminPaymentResponse getAdminPayment(Long paymentId);
}
