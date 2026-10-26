package com.example.dacn.entity;


import jakarta.persistence.*;

import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@SuperBuilder
@Table(name="Account")
public class Account extends BaseEntity{
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name="id")
    private Long id;

    @Column(name="user_name")
    private String username;

    @Column(name="password")
    private String password;
    @Column(name="email")
    private String email;

    @Column(name="address")
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name="gender", nullable = false)
    private GenderStatus gender;

    @Column(name="phone_number")
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name="locked")
    private Boolean locked;

    @Column(name = "google_id", unique = true)
    private String googleId;

    @Column(name = "facebook_id", unique = true)
    private String facebookId;

    @Column(name="date_of_birth")
    private LocalDate dateOfBirth;

    @Builder.Default
    @Column(name = "loyalty_points", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private Integer loyaltyPoints = 0;

    @Builder.Default
    @Column(name = "available_points", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private Integer availablePoints = 0;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "membership_rank", nullable = false, length = 20,
            columnDefinition = "VARCHAR(20) NOT NULL DEFAULT 'BRONZE'")
    private MembershipRank membershipRank = MembershipRank.BRONZE;
}
