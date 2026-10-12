package com.example.dacn.mapper;

import com.example.dacn.dto.request.AccountRequest.Update;
import com.example.dacn.dto.request.RegisterRequest;
import com.example.dacn.dto.response.AccountResponse;
import com.example.dacn.entity.Account;

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
    Account toAccount(RegisterRequest request);

    // Account -> AccountResponse
    AccountResponse toAccountResponse(Account account);

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
    void updateAccount(
            Update request,
            @MappingTarget Account account
    );
}
