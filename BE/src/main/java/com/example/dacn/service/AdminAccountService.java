package com.example.dacn.service;

import com.example.dacn.dto.response.AdminAccountPageResponse;
import com.example.dacn.dto.response.AdminAccountResponse;
import com.example.dacn.dto.response.AccountStatisticsResponse;
import com.example.dacn.entity.Role;

public interface AdminAccountService {
    AdminAccountPageResponse search(String keyword, Role role, Boolean locked, int page, int size,
                                    String sortBy, String sortDirection);
    AdminAccountResponse getById(Long id);
    AdminAccountResponse changeLock(Long id, boolean locked);
    AdminAccountResponse changeRole(Long id, Role role);
    AccountStatisticsResponse statistics();
}
