package com.example.dacn.service;

import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.entity.ChatConversation;
import com.example.dacn.entity.OrderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ChatbotActionServiceTest {
    private ChatConversationService conversationService;
    private OrderService orderService;
    private OrderManagementService orderManagementService;
    private ChatbotActionService service;
    private ChatConversation conversation;

    @BeforeEach
    void setUp() {
        conversationService = mock(ChatConversationService.class);
        orderService = mock(OrderService.class);
        orderManagementService = mock(OrderManagementService.class);
        service = new ChatbotActionService(conversationService, orderService, orderManagementService);
        conversation = ChatConversation.builder().build();
        when(conversationService.currentConversation()).thenReturn(Optional.of(conversation));
        when(conversationService.conversationForUpdate()).thenReturn(conversation);
    }

    @Test
    void cancellationRequiresReasonAndExplicitConfirmation() {
        when(orderService.getMyOrder(42L)).thenReturn(OrderResponse.builder()
                .id(42L).status(OrderStatus.PENDING)
                .cancellationDeadline(LocalDateTime.now().plusMinutes(10)).build());

        assertThat(service.handle("Hủy đơn hàng 42").orElseThrow().answer())
                .contains("lý do");
        verifyNoInteractions(orderManagementService);

        assertThat(service.handle("Tôi nhập sai địa chỉ").orElseThrow().answer())
                .contains("Xác nhận hủy");
        verifyNoInteractions(orderManagementService);

        assertThat(service.handle("Xác nhận hủy").orElseThrow().answer())
                .contains("đã được hủy thành công");
        verify(orderManagementService).cancelMyOrder(42L, "OTHER", "Tôi nhập sai địa chỉ");
        assertThat(conversation.getPendingAction()).isNull();
    }

    @Test
    void rejectionNeverCallsCancellationService() {
        conversation.setPendingAction(ChatbotActionService.AWAITING_CONFIRMATION);
        conversation.setPendingOrderId(42L);
        conversation.setPendingReasonCode("OTHER");
        conversation.setPendingReason("Đổi ý");

        assertThat(service.handle("Không").orElseThrow().answer()).contains("đã dừng");
        verifyNoInteractions(orderManagementService);
    }
}
