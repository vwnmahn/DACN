package com.example.dacn.dto.response;
import lombok.*; import java.math.BigDecimal; import java.time.*;
@Data @Builder public class EmployeeSalaryHistoryResponse { private BigDecimal oldSalary; private BigDecimal newSalary; private LocalDate effectiveFrom; private LocalDateTime recordedAt; private Long performedByAccountId; }
