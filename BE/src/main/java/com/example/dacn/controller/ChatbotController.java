package com.example.dacn.controller;

import com.example.dacn.dto.request.ChatbotRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.ChatbotResponse;
import com.example.dacn.dto.response.ChatMessageResponse;
import com.example.dacn.service.ChatConversationService;
import com.example.dacn.service.ChatbotActionService;
import com.example.dacn.service.OllamaChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chatbot")
@RequiredArgsConstructor
public class ChatbotController {
    private final OllamaChatService chatService;
    private final ChatConversationService conversationService;
    private final ChatbotActionService actionService;

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<java.util.List<ChatMessageResponse>>> history() {
        return ResponseEntity.ok(ApiResponse.<java.util.List<ChatMessageResponse>>builder()
                .code(1000).message("Lấy lịch sử chatbot thành công")
                .data(conversationService.history()).build());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ChatbotResponse>> testChat(
            @Valid @RequestBody ChatbotRequest request) {
        try {
            var actionResponse = actionService.handle(request.message());
            if (actionResponse.isPresent()) {
                ChatbotResponse response = actionResponse.get();
                conversationService.recordExchange(request.message(), response.answer());
                return ResponseEntity.ok(ApiResponse.<ChatbotResponse>builder()
                        .code(1000).message("Chatbot xử lý yêu cầu thành công")
                        .data(response).build());
            }
            ChatbotResponse response = chatService.chat(request.message(), request.latitude(), request.longitude(),
                    conversationService.recentForPrompt());
            conversationService.recordExchange(request.message(), response.answer());
            return ResponseEntity.ok(ApiResponse.<ChatbotResponse>builder()
                    .code(1000)
                    .message("Chatbot trả lời thành công")
                    .data(response)
                    .build());
        } catch (OllamaChatService.ChatbotUnavailableException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.<ChatbotResponse>builder()
                            .code(5030)
                            .message(exception.getMessage())
                            .data(null)
                            .build());
        }
    }
}
