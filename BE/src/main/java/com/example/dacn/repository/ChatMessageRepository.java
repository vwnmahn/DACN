package com.example.dacn.repository;

import com.example.dacn.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findTop100ByConversationIdOrderByIdDesc(Long conversationId);
    List<ChatMessage> findTop12ByConversationIdOrderByIdDesc(Long conversationId);
}
