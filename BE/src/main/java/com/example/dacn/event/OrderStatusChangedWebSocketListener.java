package com.example.dacn.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderStatusChangedWebSocketListener {
    private final SimpMessagingTemplate messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterCommit(OrderStatusChangedEvent event) {
        try {
            log.info("[Order realtime] AFTER_COMMIT type={} orderId={}",
                    event.type(), event.orderId());
            messagingTemplate.convertAndSend("/topic/admin/orders", event);
            log.info("[Order realtime] Published type={} orderId={} destination={}",
                    event.type(), event.orderId(), "/topic/admin/orders");
            messagingTemplate.convertAndSend(
                    "/topic/accounts/" + event.accountId() + "/orders",
                    event
            );
        } catch (RuntimeException exception) {
            log.error("Không thể phát realtime cho đơn hàng {} sau khi transaction đã commit",
                    event.orderId(), exception);
        }
    }
}
