package com.example.dacn.dto.request;
import jakarta.validation.constraints.NotBlank; import lombok.Data;
@Data public class EmployeeTerminationRequest { @NotBlank private String reason; }
