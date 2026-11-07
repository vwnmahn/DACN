package com.example.dacn.service;

import com.example.dacn.dto.response.ChatMessageResponse;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.ChatConversation;
import com.example.dacn.entity.ChatMessage;
import com.example.dacn.exception.AppException;
import com.example.dacn.exception.ErrorCode;
import com.example.dacn.repository.ChatConversationRepository;
import com.example.dacn.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatConversationService {
    private final ChatConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> history() {
        return conversationRepository.findByAccountId(currentAccount().getId())
                .map(conversation -> ascending(messageRepository
                        .findTop100ByConversationIdOrderByIdDesc(conversation.getId())))
                .orElseGet(List::of);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> recentForPrompt() {
        return conversationRepository.findByAccountId(currentAccount().getId())
                .map(conversation -> ascending(messageRepository
                        .findTop12ByConversationIdOrderByIdDesc(conversation.getId())))
                .orElseGet(List::of);
    }

    @Transactional
    public void recordExchange(String userMessage, String assistantMessage) {
        Account account = currentAccount();
        ChatConversation conversation = conversationRepository.findByAccountId(account.getId())
                .orElseGet(() -> conversationRepository.save(
                        ChatConversation.builder().account(account).build()));
        messageRepository.save(ChatMessage.builder().conversation(conversation)
                .role("user").content(userMessage.trim()).build());
        messageRepository.save(ChatMessage.builder().conversation(conversation)
                .role("assistant").content(assistantMessage.trim()).build());
    }

    @Transactional
    public ChatConversation conversationForUpdate() {
        Account account = currentAccount();
        return conversationRepository.findByAccountId(account.getId())
                .orElseGet(() -> conversationRepository.save(
                        ChatConversation.builder().account(account).build()));
    }

    @Transactional(readOnly = true)
    public Optional<ChatConversation> currentConversation() {
        return conversationRepository.findByAccountId(currentAccount().getId());
    }

    @Transactional
    public ChatConversation save(ChatConversation conversation) {
        return conversationRepository.save(conversation);
    }

    private List<ChatMessageResponse> ascending(List<ChatMessage> descending) {
        List<ChatMessage> messages = new ArrayList<>(descending);
        Collections.reverse(messages);
        return messages.stream().map(message -> new ChatMessageResponse(
                message.getId(), message.getRole(), message.getContent(), message.getCreatedAt())).toList();
    }

    private Account currentAccount() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account account)) {
            throw new AppException(ErrorCode.UNAUTHENTICATED);
        }
        return account;
    }
}
