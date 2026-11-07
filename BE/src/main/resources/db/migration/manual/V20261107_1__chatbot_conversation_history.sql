CREATE TABLE chat_conversations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    account_id BIGINT NOT NULL,
    pending_action VARCHAR(40) NULL,
    pending_order_id BIGINT NULL,
    pending_reason_code VARCHAR(30) NULL,
    pending_reason VARCHAR(500) NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_chat_conversation_account UNIQUE (account_id),
    CONSTRAINT fk_chat_conversation_account FOREIGN KEY (account_id) REFERENCES Account(id)
);

CREATE TABLE chat_messages (
    id BIGINT NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME(6) NULL,
    updated_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    INDEX idx_chat_message_conversation_id (conversation_id, id),
    CONSTRAINT fk_chat_message_conversation FOREIGN KEY (conversation_id)
        REFERENCES chat_conversations(id) ON DELETE CASCADE
);
