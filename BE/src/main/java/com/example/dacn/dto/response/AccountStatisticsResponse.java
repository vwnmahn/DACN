package com.example.dacn.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AccountStatisticsResponse {
    private long totalAccounts;
    private long lockedAccounts;
    private long unlockedAccounts;
    private long adminAccounts;
    private long userAccounts;
}
