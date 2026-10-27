package com.example.dacn;

import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.MembershipRank;
import com.example.dacn.mapper.AccountMapper;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

import static org.junit.jupiter.api.Assertions.*;

class AccountRankResponseTest {
    private final AccountMapper mapper = Mappers.getMapper(AccountMapper.class);

    @Test
    void mapsProgressToNextRankUsingMembershipRankThresholds() {
        Account account = Account.builder()
                .loyaltyPoints(50)
                .availablePoints(20)
                .membershipRank(MembershipRank.BRONZE)
                .build();

        AccountResponse response = mapper.toAccountResponse(account);

        assertEquals(MembershipRank.BRONZE, response.getMembershipRank());
        assertEquals(MembershipRank.SILVER, response.getNextMembershipRank());
        assertEquals(100, response.getNextRankPoints());
        assertEquals(50, response.getPointsToNextRank());
        assertEquals(50, response.getRankProgressPercentage());
        assertEquals(20, response.getAvailablePoints());
    }

    @Test
    void diamondHasNoNextRankAndReportsCompleteProgress() {
        Account account = Account.builder()
                .loyaltyPoints(1200)
                .availablePoints(300)
                .membershipRank(MembershipRank.DIAMOND)
                .build();

        AccountResponse response = mapper.toAccountResponse(account);

        assertEquals(MembershipRank.DIAMOND, response.getMembershipRank());
        assertNull(response.getNextMembershipRank());
        assertNull(response.getNextRankPoints());
        assertEquals(0, response.getPointsToNextRank());
        assertEquals(100, response.getRankProgressPercentage());
    }

    @Test
    void existingRankBoundariesRemainUnchanged() {
        assertEquals(MembershipRank.BRONZE, MembershipRank.fromPoints(99));
        assertEquals(MembershipRank.SILVER, MembershipRank.fromPoints(100));
        assertEquals(MembershipRank.GOLD, MembershipRank.fromPoints(300));
        assertEquals(MembershipRank.PLATINUM, MembershipRank.fromPoints(600));
        assertEquals(MembershipRank.DIAMOND, MembershipRank.fromPoints(1000));
    }
}
