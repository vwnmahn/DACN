package com.example.dacn.security;

import com.example.dacn.entity.Account;
import com.example.dacn.entity.Role;
import com.example.dacn.repository.AccountRepository;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

@Component
public class WebSocketSecurityInterceptor implements ChannelInterceptor {
    private final JwtUtil jwtUtil;
    private final AccountRepository accountRepository;

    public WebSocketSecurityInterceptor(JwtUtil jwtUtil, AccountRepository accountRepository) {
        this.jwtUtil = jwtUtil;
        this.accountRepository = accountRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message;
        }
        if (command == StompCommand.CONNECT) {
            accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
            return message;
        }
        if (command == StompCommand.SUBSCRIBE) {
            authorizeSubscription(accessor.getUser(), accessor.getDestination());
        } else if (command == StompCommand.SEND) {
            requireAuthenticated(accessor.getUser());
            // Hiện không có @MessageMapping; mọi destination hiện tại đều chỉ dành cho server phát.
            throw new AccessDeniedException("Client SEND is not allowed");
        }
        return message;
    }

    private Authentication authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new BadCredentialsException("Missing access token");
        }
        String token = authorization.substring(7).trim();
        if (token.isBlank() || !jwtUtil.validate(token) || !jwtUtil.isAccessToken(token)) {
            throw new BadCredentialsException("Invalid access token");
        }
        Long accountId;
        try {
            accountId = jwtUtil.getAccountId(token);
        } catch (RuntimeException exception) {
            throw new BadCredentialsException("Invalid access token");
        }
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new BadCredentialsException("Invalid access token"));
        if (Boolean.TRUE.equals(account.getLocked()) || account.getRole() == null) {
            throw new BadCredentialsException("Account is not available");
        }
        return new UsernamePasswordAuthenticationToken(account, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + account.getRole().name())));
    }

    private void authorizeSubscription(Principal principal, String destination) {
        Authentication authentication = requireAuthenticated(principal);
        if (destination == null) {
            throw new AccessDeniedException("Missing destination");
        }
        Account account = (Account) authentication.getPrincipal();
        boolean admin = account.getRole() == Role.ADMIN;
        if (destination.startsWith("/topic/admin/")) {
            if (!admin) {
                throw new AccessDeniedException("Admin subscription required");
            }
            return;
        }
        if (destination.startsWith("/user/queue/")) {
            return;
        }
        String ownAccountPrefix = "/topic/accounts/" + account.getId() + "/";
        if (destination.startsWith(ownAccountPrefix) || admin && destination.startsWith("/topic/accounts/")) {
            return;
        }
        throw new AccessDeniedException("Subscription is not allowed");
    }

    private Authentication requireAuthenticated(Principal principal) {
        if (!(principal instanceof Authentication authentication) || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Account)) {
            throw new BadCredentialsException("WebSocket authentication required");
        }
        return authentication;
    }
}
