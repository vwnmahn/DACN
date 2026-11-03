package com.example.dacn.dto.response;
import lombok.*; import java.time.*;
@Data @Builder public class EmploymentTerminationHistoryResponse { private String action; private String reason; private LocalDateTime effectiveAt; private LocalDateTime recordedAt; private Long performedByAccountId; }
