package com.example.dacn.mapper;

import com.example.dacn.dto.request.AccountRequest.Update;
import com.example.dacn.dto.request.RegisterRequest;
import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.entity.Account;
import com.example.dacn.entity.MembershipRank;

import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface AccountMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "avatarUrl", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "locked", ignore = true)
    @Mapping(target = "googleId", ignore = true)
    @Mapping(target = "facebookId", ignore = true)
    @Mapping(target = "loyaltyPoints", ignore = true)
    @Mapping(target = "availablePoints", ignore = true)
    @Mapping(target = "membershipRank", ignore = true)
    Account toAccount(RegisterRequest request);

    // Account -> AccountResponse
    @Mapping(target = "nextMembershipRank", ignore = true)
    @Mapping(target = "nextRankPoints", ignore = true)
    @Mapping(target = "pointsToNextRank", ignore = true)
    @Mapping(target = "rankProgressPercentage", ignore = true)
    AccountResponse toAccountResponse(Account account);

    @AfterMapping
    default void enrichRankProgress(Account account, @MappingTarget AccountResponse response) {
        int points = Math.max(0, account.getLoyaltyPoints() == null ? 0 : account.getLoyaltyPoints());
        MembershipRank current = account.getMembershipRank() == null
                ? MembershipRank.fromPoints(points)
                : account.getMembershipRank();
        MembershipRank next = current.next();

        response.setMembershipRank(current);
        response.setNextMembershipRank(next);
        if (next == null) {
            response.setNextRankPoints(null);
            response.setPointsToNextRank(0);
            response.setRankProgressPercentage(100);
            return;
        }

        int currentThreshold = current.getMinimumPoints();
        int nextThreshold = next.getMinimumPoints();
        int pointsInRank = Math.max(0, points - currentThreshold);
        int rankSpan = nextThreshold - currentThreshold;
        int progress = Math.min(100, (int) ((long) pointsInRank * 100 / rankSpan));

        response.setNextRankPoints(nextThreshold);
        response.setPointsToNextRank(Math.max(0, nextThreshold - points));
        response.setRankProgressPercentage(progress);
    }

    @BeanMapping(
            nullValuePropertyMappingStrategy =
                    NullValuePropertyMappingStrategy.IGNORE
    )
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "username", ignore = true)
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "avatarUrl", ignore = true)
    @Mapping(target = "email", ignore = true)
    @Mapping(target = "role", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "loyaltyPoints", ignore = true)
    @Mapping(target = "availablePoints", ignore = true)
    @Mapping(target = "membershipRank", ignore = true)
    void updateAccount(
            Update request,
            @MappingTarget Account account
    );
}
