package com.example.dacn.entity;

public enum MembershipRank {
    BRONZE(0),
    SILVER(100),
    GOLD(300),
    PLATINUM(600),
    DIAMOND(1000);

    private final int minimumPoints;

    MembershipRank(int minimumPoints) {
        this.minimumPoints = minimumPoints;
    }

    public int getMinimumPoints() {
        return minimumPoints;
    }

    public MembershipRank next() {
        int nextOrdinal = ordinal() + 1;
        return nextOrdinal < values().length ? values()[nextOrdinal] : null;
    }

    public static MembershipRank fromPoints(int points) {
        if (points >= DIAMOND.minimumPoints) return DIAMOND;
        if (points >= PLATINUM.minimumPoints) return PLATINUM;
        if (points >= GOLD.minimumPoints) return GOLD;
        if (points >= SILVER.minimumPoints) return SILVER;
        return BRONZE;
    }
}
