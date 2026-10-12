package com.example.dacn.gateway;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VnPayTransactionResult {
    private boolean signatureValid;
    private String command;
    private String tmnCode;
    private String transactionReference;
    private String amount;
    private String responseCode;
    private String transactionStatus;
    private String transactionNo;
    private String transactionType;
    private String message;
}
