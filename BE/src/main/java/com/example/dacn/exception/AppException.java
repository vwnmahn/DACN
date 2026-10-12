package com.example.dacn.exception;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AppException extends RuntimeException {
   private final ErrorCode errorCode;
    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
