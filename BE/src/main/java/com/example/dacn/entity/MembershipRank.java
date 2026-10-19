package com.example.dacn.entity;

public enum MembershipRank {
    BRONZE,
    SILVER,
    GOLD,
    PLATINUM,
    DIAMOND;

    public static MembershipRank fromPoints(int points) {
        if (points >= 1000) return DIAMOND;
        if (points >= 600) return PLATINUM;
        if (points >= 300) return GOLD;
        if (points >= 100) return SILVER;
        return BRONZE;
    }
}
