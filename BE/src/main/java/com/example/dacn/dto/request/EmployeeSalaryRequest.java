package com.example.dacn.dto.request;
import jakarta.validation.constraints.*; import lombok.Data; import java.math.BigDecimal; import java.time.LocalDate;
@Data public class EmployeeSalaryRequest { @NotNull @DecimalMin("0.00") private BigDecimal salary; @NotNull private LocalDate effectiveFrom; }
