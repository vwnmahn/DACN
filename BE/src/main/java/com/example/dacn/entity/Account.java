package com.example.dacn.entity;


import jakarta.persistence.*;

import lombok.*;
import lombok.experimental.SuperBuilder;

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

    @Column(name="gender")
    private Boolean gender;

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
}
