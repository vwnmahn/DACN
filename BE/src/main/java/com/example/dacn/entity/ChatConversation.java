package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "chat_conversations",
        uniqueConstraints = @UniqueConstraint(name = "uk_chat_conversation_account", columnNames = "account_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ChatConversation extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_chat_conversation_account"))
    private Account account;

    @Column(name = "pending_action", length = 40)
    private String pendingAction;

    @Column(name = "pending_order_id")
    private Long pendingOrderId;

    @Column(name = "pending_reason_code", length = 30)
    private String pendingReasonCode;

    @Column(name = "pending_reason", length = 500)
    private String pendingReason;
}
