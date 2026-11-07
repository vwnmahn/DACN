package com.example.dacn.service;

import com.example.dacn.dto.response.ChatbotResponse;
import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.entity.ChatConversation;
import com.example.dacn.entity.OrderStatus;
import com.example.dacn.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ChatbotActionService {
    static final String AWAITING_ORDER = "CANCEL_AWAITING_ORDER";
    static final String AWAITING_REASON = "CANCEL_AWAITING_REASON";
    static final String AWAITING_CONFIRMATION = "CANCEL_AWAITING_CONFIRMATION";
    private static final Pattern ORDER_ID = Pattern.compile(
            "(?:don\\s*hang|ma\\s*don)?\\s*#?\\s*(\\d+)");

    private final ChatConversationService conversationService;
    private final OrderService orderService;
    private final OrderManagementService orderManagementService;

    public Optional<ChatbotResponse> handle(String message) {
        ChatConversation conversation = conversationService.currentConversation().orElse(null);
        if (conversation != null && conversation.getPendingAction() != null) {
            return Optional.of(continueAction(conversation, message));
        }
        if (!isCancellationRequest(message)) {
            return Optional.empty();
        }
        conversation = conversationService.conversationForUpdate();
        Long orderId = extractOrderId(message);
        if (orderId == null) {
            conversation.setPendingAction(AWAITING_ORDER);
            conversationService.save(conversation);
            return response(new ChatbotResponse("Bạn vui lòng cho mình biết mã đơn hàng cần hủy."));
        }
        return response(acceptOrder(conversation, orderId));
    }

    private ChatbotResponse continueAction(ChatConversation conversation, String message) {
        return switch (conversation.getPendingAction()) {
            case AWAITING_ORDER -> {
                Long orderId = extractOrderId(message);
                yield orderId == null
                        ? new ChatbotResponse("Mình chưa nhận được mã đơn hợp lệ. Bạn vui lòng nhập mã đơn hàng cần hủy.")
                        : acceptOrder(conversation, orderId);
            }
            case AWAITING_REASON -> acceptReason(conversation, message);
            case AWAITING_CONFIRMATION -> confirmCancellation(conversation, message);
            default -> {
                clear(conversation);
                yield new ChatbotResponse("Yêu cầu trước đó không còn hợp lệ. Bạn vui lòng bắt đầu lại.");
            }
        };
    }

    private ChatbotResponse acceptOrder(ChatConversation conversation, Long orderId) {
        try {
            OrderResponse order = orderService.getMyOrder(orderId);
            if (order.getStatus() != OrderStatus.PENDING || order.getCancellationDeadline() == null
                    || !LocalDateTime.now().isBefore(order.getCancellationDeadline())) {
                clear(conversation);
                return new ChatbotResponse("Đơn hàng #" + orderId
                        + " hiện không còn đủ điều kiện hủy theo quy định.");
            }
            conversation.setPendingOrderId(orderId);
            conversation.setPendingAction(AWAITING_REASON);
            conversationService.save(conversation);
            return new ChatbotResponse("Bạn muốn hủy đơn hàng #" + orderId
                    + " vì lý do gì?");
        } catch (AppException exception) {
            clear(conversation);
            return new ChatbotResponse(exception.getErrorCode().getMessage());
        }
    }

    private ChatbotResponse acceptReason(ChatConversation conversation, String message) {
        String reason = message == null ? "" : message.trim();
        if (reason.isBlank()) {
            return new ChatbotResponse("Lý do hủy không được để trống. Bạn vui lòng nhập lý do.");
        }
        if (reason.length() > 500) {
            return new ChatbotResponse("Lý do hủy tối đa 500 ký tự. Bạn vui lòng nhập ngắn gọn hơn.");
        }
        conversation.setPendingReasonCode("OTHER");
        conversation.setPendingReason(reason);
        conversation.setPendingAction(AWAITING_CONFIRMATION);
        conversationService.save(conversation);
        return new ChatbotResponse("Xác nhận hủy đơn hàng #" + conversation.getPendingOrderId()
                + " với lý do: “" + reason + "”? Vui lòng trả lời “Xác nhận hủy” hoặc “Không”.");
    }

    private ChatbotResponse confirmCancellation(ChatConversation conversation, String message) {
        String normalized = normalize(message);
        if (isRejection(normalized)) {
            clear(conversation);
            return new ChatbotResponse("Mình đã dừng yêu cầu hủy đơn hàng.");
        }
        if (!isConfirmation(normalized)) {
            return new ChatbotResponse("Bạn chưa xác nhận. Vui lòng trả lời “Xác nhận hủy” hoặc “Không”.");
        }
        Long orderId = conversation.getPendingOrderId();
        String reasonCode = conversation.getPendingReasonCode();
        String reason = conversation.getPendingReason();
        try {
            orderService.getMyOrder(orderId);
            orderManagementService.cancelMyOrder(orderId, reasonCode, reason);
            clear(conversation);
            return new ChatbotResponse("Đơn hàng #" + orderId + " đã được hủy thành công.");
        } catch (AppException exception) {
            clear(conversation);
            return new ChatbotResponse(exception.getErrorCode().getMessage());
        }
    }

    private void clear(ChatConversation conversation) {
        conversation.setPendingAction(null);
        conversation.setPendingOrderId(null);
        conversation.setPendingReasonCode(null);
        conversation.setPendingReason(null);
        conversationService.save(conversation);
    }

    private Optional<ChatbotResponse> response(ChatbotResponse response) {
        return Optional.of(response);
    }

    private Long extractOrderId(String message) {
        Matcher matcher = ORDER_ID.matcher(normalize(message));
        while (matcher.find()) {
            try {
                return Long.valueOf(matcher.group(1));
            } catch (NumberFormatException ignored) {
                // Continue looking for a valid numeric order id.
            }
        }
        return null;
    }

    private boolean isCancellationRequest(String message) {
        String normalized = normalize(message);
        if (!normalized.contains("huy don")) {
            return false;
        }
        if (containsAny(normalized, "co the huy", "huy don duoc khong", "huy don nhu the nao",
                "lam sao huy", "cach huy", "dieu kien huy", "khi nao huy")) {
            return false;
        }
        return normalized.equals("huy don") || normalized.equals("huy don hang")
                || containsAny(normalized, "toi muon huy", "muon huy don", "can huy don",
                "yeu cau huy", "xac nhan huy") || extractOrderId(message) != null;
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) return true;
        }
        return false;
    }

    private boolean isConfirmation(String message) {
        return message.equals("xac nhan") || message.equals("xac nhan huy")
                || message.equals("dong y") || message.equals("dong y huy");
    }

    private boolean isRejection(String message) {
        return message.equals("khong") || message.equals("khong huy")
                || message.equals("dung lai") || message.equals("quay lai");
    }

    private String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ").trim();
    }
}
