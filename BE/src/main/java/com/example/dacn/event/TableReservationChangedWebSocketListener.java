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
public class TableReservationChangedWebSocketListener {
    private final SimpMessagingTemplate messagingTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterCommit(TableReservationChangedEvent event) {
        try {
            messagingTemplate.convertAndSend("/topic/admin/reservations", event);
            messagingTemplate.convertAndSend(
                    "/topic/accounts/" + event.accountId() + "/reservations",
                    event
            );
        } catch (RuntimeException exception) {
            log.error("Không thể phát realtime cho đặt bàn {} sau khi transaction đã commit",
                    event.reservationId(), exception);
        }
    }
}
