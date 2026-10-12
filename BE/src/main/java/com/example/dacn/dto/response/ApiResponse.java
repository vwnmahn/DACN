package com.example.dacn.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse <T>{
    @Builder.Default
    private int code =1000;
    private String message;
    private T data;
}
