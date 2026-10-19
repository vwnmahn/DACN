package com.example.dacn.dto.response;

import com.example.dacn.entity.Role;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import com.example.dacn.entity.MembershipRank;

@Data
public class AccountResponse {
    private Long id;

    private String username;

    private String email;

    private String address;

    private Boolean gender;

    private String phoneNumber;

    private LocalDate dateOfBirth;

    private String avatarUrl;

    private Integer loyaltyPoints;
    private Integer availablePoints;
    private MembershipRank membershipRank;

}
