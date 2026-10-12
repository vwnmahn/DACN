package com.example.dacn.service;

import com.example.dacn.entity.Account;

public interface ATService {

    String generateToken(Account account);

    boolean validateToken(String token);

    Long getAccountId(String token);
}
