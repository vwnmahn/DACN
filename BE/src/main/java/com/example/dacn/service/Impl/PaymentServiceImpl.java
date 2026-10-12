
package com.example.dacn.service.Impl;

import com.example.dacn.entity.Payment;
import com.example.dacn.entity.PaymentMethod;
import com.example.dacn.entity.PaymentStatus;
import com.example.dacn.entity.Order;
import com.example.dacn.entity.OrderStatus;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.OrderCancellationReason;
import com.example.dacn.entity.OrderStatusActorType;
import com.example.dacn.entity.OrderStatusHistory;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.PaymentRepository;
import com.example.dacn.repository.OrderRepository;
import com.example.dacn.repository.OrderStatusHistoryRepository;
import com.example.dacn.service.PaymentService;
import com.example.dacn.service.VoucherService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import com.example.dacn.dto.response.AdminPaymentPageResponse;
import com.example.dacn.dto.response.AdminPaymentResponse;
import com.example.dacn.dto.response.PaymentStatusResponse;
import com.example.dacn.entity.Role;
import java.time.Clock;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {

    private static final int MAX_ADMIN_PAGE_SIZE = 100;
    private static final Set<String> ADMIN_SORT_FIELDS = Set.of(
            "id", "orderId", "paymentMethod", "paymentStatus", "amount",
            "transactionReference", "gatewayTransactionId", "paidAt", "createdAt", "updatedAt");

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository historyRepository;
    private final VoucherService voucherService;
    private final Clock clock;

    @Override
    @Transactional
    public Payment createPendingPayment(
            Long orderId,
            PaymentMethod paymentMethod
    ) {
        if (orderId == null || orderId <= 0) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_ORDER_ID);
        }

        if (paymentMethod == null) {
            throw new AppException(ErrorCode.PAYMENT_METHOD_INVALID);
        }

        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        Account account = currentAccount();
        if (!order.getAccount().getId().equals(account.getId())) {
            throw new AppException(ErrorCode.ORDER_NOT_FOUND);
        }
        if (order.getStatus() == OrderStatus.CANCELLED
                || order.getStatus() == OrderStatus.COMPLETED) {
            throw new AppException(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE);
        }
        if (order.getTotalAmount() == null || order.getTotalAmount().signum() <= 0) {
            throw new AppException(ErrorCode.PAYMENT_AMOUNT_INVALID);
        }

        List<Payment> existingPayments = paymentRepository.findByOrderIdForUpdate(orderId);
        if (existingPayments.stream().anyMatch(p -> p.getPaymentStatus() == PaymentStatus.SUCCESS)) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_COMPLETED);
        }
        Payment reusable = existingPayments.stream()
                .filter(p -> p.getPaymentMethod() == paymentMethod
                        && p.getPaymentStatus() == PaymentStatus.PENDING)
                .findFirst().orElse(null);
        if (reusable != null) {
            return reusable;
        }

        String reference = "FCA-" +
                UUID.randomUUID()
                        .toString()
                        .replace("-", "");

        Payment payment = Payment.builder()
                .orderId(orderId)
                .paymentMethod(paymentMethod)
                .paymentStatus(PaymentStatus.PENDING)
                .amount(order.getTotalAmount())
                .transactionReference(reference)
                .build();

        return paymentRepository.save(payment);
    }

    @Override
    @Transactional(readOnly = true)
    public Payment getPaymentById(Long paymentId) {
        return paymentRepository.findById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }

    @Override
    @Transactional(readOnly = true)
    public Payment getPaymentByReference(String reference) {
        return paymentRepository
                .findByTransactionReference(reference)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }

    @Override
    @Transactional(readOnly = true)
    public List<Payment> getPaymentsByOrderId(Long orderId) {
        return paymentRepository
                .findByOrderIdOrderByIdDesc(orderId);
    }

    @Override
    @Transactional
    public Payment updatePaymentUrl(
            String reference,
            String paymentUrl
    ) {
        Payment payment = getPaymentForUpdate(reference);

        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }

        if (paymentUrl == null || paymentUrl.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_URL_INVALID);
        }

        payment.setPaymentUrl(paymentUrl);
        return paymentRepository.save(payment);
    }

    @Override
    @Transactional
    public Payment confirmPaymentSuccess(
            String reference,
            String gatewayTransactionId
    ) {
        Payment payment = getPaymentForUpdate(reference);

        // Callback gửi lại: không xử lý thành công lần hai
        if (payment.getPaymentStatus() == PaymentStatus.SUCCESS) {
            if (gatewayTransactionId != null &&
                    gatewayTransactionId.equals(
                            payment.getGatewayTransactionId())) {
                return payment;
            }

            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }

        if (payment.getPaymentStatus() != PaymentStatus.PENDING
                && payment.getPaymentStatus() != PaymentStatus.NEEDS_RECONCILIATION
                && payment.getPaymentStatus() != PaymentStatus.CANCELLED) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }

        if (gatewayTransactionId == null ||
                gatewayTransactionId.isBlank()) {
            throw new AppException(ErrorCode.PAYMENT_GATEWAY_TRANSACTION_ID_REQUIRED);
        }

        boolean anotherSuccessfulPayment = paymentRepository
                .findByOrderIdForUpdate(payment.getOrderId())
                .stream()
                .anyMatch(existing -> !existing.getId().equals(payment.getId())
                        && existing.getPaymentStatus() == PaymentStatus.SUCCESS);
        if (anotherSuccessfulPayment) {
            throw new AppException(ErrorCode.PAYMENT_ALREADY_COMPLETED);
        }

        payment.setPaymentStatus(PaymentStatus.SUCCESS);
        payment.setGatewayTransactionId(gatewayTransactionId);
        payment.setPaidAt(LocalDateTime.now(clock));
        payment.setPaymentMessage("Thanh toán thành công");
        paymentRepository.findByOrderIdForUpdate(payment.getOrderId()).stream()
                .filter(other -> !other.getId().equals(payment.getId()))
                .filter(other -> other.getPaymentStatus() == PaymentStatus.PENDING
                        || other.getPaymentStatus() == PaymentStatus.NEEDS_RECONCILIATION)
                .forEach(other -> {
                    other.setPaymentStatus(PaymentStatus.CANCELLED);
                    other.setPaymentMessage("Đã có giao dịch khác của đơn hàng thanh toán thành công");
                    paymentRepository.save(other);
                });

        Order order = orderRepository.findByIdForUpdate(payment.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getStatus() == OrderStatus.AWAITING_PAYMENT) {
            OrderStatus oldStatus = order.getStatus();
            order.setStatus(OrderStatus.CONFIRMED);
            order.setConfirmedAt(LocalDateTime.now(clock));
            recordSystemHistory(order, oldStatus, OrderStatus.CONFIRMED,
                    "Payment được xác nhận thành công");
            orderRepository.save(order);
        } else if (order.getStatus() == OrderStatus.CANCELLED) {
            order.setRefundRequired(true);
            orderRepository.save(order);
        }
        voucherService.applyForOrder(order.getId());

        return paymentRepository.save(payment);
    }

    @Override
    @Transactional
    public Payment confirmPaymentFailed(
            String reference,
            String message
    ) {
        Payment payment = getPaymentForUpdate(reference);

        if (payment.getPaymentStatus() == PaymentStatus.SUCCESS) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_STATE);
        }

        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            return payment;
        }

        payment.setPaymentStatus(PaymentStatus.FAILED);
        payment.setPaymentMessage(
                message == null || message.isBlank()
                        ? "Thanh toán thất bại"
                        : message.substring(
                        0,
                        Math.min(message.length(), 500)
                )
        );

        Order order = orderRepository.findByIdForUpdate(payment.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (order.getStatus() == OrderStatus.PENDING
                || order.getStatus() == OrderStatus.AWAITING_PAYMENT) {
            OrderStatus oldStatus = order.getStatus();
            order.setStatus(OrderStatus.CANCELLED);
            order.setCancellationReason(OrderCancellationReason.PAYMENT_FAILED);
            order.setCancelledAt(LocalDateTime.now(clock));
            order.setConfirmationDeadline(null);
            recordSystemHistory(order, oldStatus, OrderStatus.CANCELLED,
                    "Payment thất bại: " + payment.getPaymentMessage());
            orderRepository.save(order);
        }
        voucherService.releaseForOrder(order.getId());

        return paymentRepository.save(payment);
    }

    private Payment getPaymentForUpdate(String reference) {
        Payment payment = paymentRepository.findByTransactionReference(reference)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));

        orderRepository.findByIdForUpdate(payment.getOrderId())
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));

        return paymentRepository.findByOrderIdForUpdate(payment.getOrderId())
                .stream()
                .filter(existing -> existing.getId().equals(payment.getId()))
                .findFirst()
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
    }

    private Account currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account account)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return account;
    }

    private void recordSystemHistory(Order order, OrderStatus oldStatus, OrderStatus newStatus,
                                     String reason) {
        historyRepository.save(OrderStatusHistory.builder().order(order).oldStatus(oldStatus)
                .newStatus(newStatus).actorType(OrderStatusActorType.SYSTEM)
                .changedAt(LocalDateTime.now(clock)).reason(reason).build());
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentStatusResponse getStatusForCurrentUser(Long orderId) {
        if (orderId == null || orderId <= 0) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_ORDER_ID);
        }
        Account account = currentAccount();
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.ORDER_NOT_FOUND));
        if (account.getRole() != Role.ADMIN && !order.getAccount().getId().equals(account.getId())) {
            throw new AppException(ErrorCode.ORDER_NOT_FOUND);
        }
        Payment payment = paymentRepository.findFirstByOrderIdOrderByIdDesc(orderId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND));
        return PaymentStatusResponse.builder()
                .paymentId(payment.getId()).orderId(orderId)
                .paymentMethod(payment.getPaymentMethod()).paymentStatus(payment.getPaymentStatus())
                .amount(payment.getAmount()).transactionReference(payment.getTransactionReference())
                .paidAt(payment.getPaidAt()).message(payment.getPaymentMessage()).build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminPaymentPageResponse searchAdminPayments(PaymentStatus paymentStatus,
                                                         PaymentMethod paymentMethod,
                                                         Long orderId,
                                                         Long accountId,
                                                         LocalDateTime createdFrom,
                                                         LocalDateTime createdTo,
                                                         String transactionReference,
                                                         int page,
                                                         int size,
                                                         String sortBy,
                                                         String sortDirection) {
        validateAdminSearch(orderId, accountId, createdFrom, createdTo, page, size, sortBy);
        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(sortDirection);
        } catch (IllegalArgumentException exception) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_PAGE_REQUEST);
        }

        Specification<Payment> specification = (root, query, builder) -> builder.conjunction();
        if (paymentStatus != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("paymentStatus"), paymentStatus));
        }
        if (paymentMethod != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("paymentMethod"), paymentMethod));
        }
        if (orderId != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.get("orderId"), orderId));
        }
        if (accountId != null) {
            specification = specification.and((root, query, builder) ->
                    builder.equal(root.join("order").join("account").get("id"), accountId));
        }
        if (createdFrom != null) {
            specification = specification.and((root, query, builder) ->
                    builder.greaterThanOrEqualTo(root.get("createdAt"), createdFrom));
        }
        if (createdTo != null) {
            specification = specification.and((root, query, builder) ->
                    builder.lessThanOrEqualTo(root.get("createdAt"), createdTo));
        }
        if (transactionReference != null && !transactionReference.isBlank()) {
            String pattern = "%" + transactionReference.trim().toLowerCase(Locale.ROOT) + "%";
            specification = specification.and((root, query, builder) -> builder.or(
                    builder.like(builder.lower(root.get("transactionReference")), pattern),
                    builder.like(builder.lower(root.get("gatewayTransactionId")), pattern)));
        }

        Sort sort = Sort.by(direction, sortBy);
        if (!"id".equals(sortBy)) {
            sort = sort.and(Sort.by(direction, "id"));
        }
        Page<Payment> result = paymentRepository.findAll(specification, PageRequest.of(page, size, sort));
        return AdminPaymentPageResponse.builder()
                .content(result.getContent().stream().map(this::toAdminResponse).toList())
                .page(result.getNumber()).size(result.getSize())
                .totalElements(result.getTotalElements()).totalPages(result.getTotalPages())
                .sortBy(sortBy).sortDirection(direction.name().toLowerCase(Locale.ROOT)).build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminPaymentResponse getAdminPayment(Long paymentId) {
        if (paymentId == null || paymentId <= 0) {
            throw new AppException(ErrorCode.PAYMENT_NOT_FOUND);
        }
        return toAdminResponse(paymentRepository.findAdminDetailById(paymentId)
                .orElseThrow(() -> new AppException(ErrorCode.PAYMENT_NOT_FOUND)));
    }

    private void validateAdminSearch(Long orderId, Long accountId,
                                     LocalDateTime createdFrom, LocalDateTime createdTo,
                                     int page, int size, String sortBy) {
        if (page < 0 || size < 1 || size > MAX_ADMIN_PAGE_SIZE
                || sortBy == null || !ADMIN_SORT_FIELDS.contains(sortBy)
                || (orderId != null && orderId <= 0)
                || (accountId != null && accountId <= 0)
                || (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo))) {
            throw new AppException(ErrorCode.PAYMENT_INVALID_PAGE_REQUEST);
        }
    }

    private AdminPaymentResponse toAdminResponse(Payment payment) {
        Order order = payment.getOrder();
        return AdminPaymentResponse.builder()
                .id(payment.getId()).orderId(payment.getOrderId())
                .accountId(order == null || order.getAccount() == null ? null : order.getAccount().getId())
                .paymentMethod(payment.getPaymentMethod()).paymentStatus(payment.getPaymentStatus())
                .amount(payment.getAmount()).transactionReference(payment.getTransactionReference())
                .gatewayTransactionId(payment.getGatewayTransactionId()).paidAt(payment.getPaidAt())
                .paymentMessage(payment.getPaymentMessage()).createdAt(payment.getCreatedAt())
                .updatedAt(payment.getUpdatedAt()).orderStatus(order == null ? null : order.getStatus())
                .needsReconciliation(payment.getPaymentStatus() == PaymentStatus.NEEDS_RECONCILIATION)
                .refundRequired(order != null && Boolean.TRUE.equals(order.getRefundRequired()))
                .build();
    }
}
