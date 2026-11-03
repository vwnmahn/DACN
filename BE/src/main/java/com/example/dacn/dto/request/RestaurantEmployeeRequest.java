package com.example.dacn.dto.request;
import com.example.dacn.entity.EmployeePosition; import jakarta.validation.constraints.*; import lombok.Data; import java.math.BigDecimal; import java.time.LocalDate;
@Data public class RestaurantEmployeeRequest {
 @NotBlank private String fullName; @NotBlank private String phoneNumber; @NotNull private EmployeePosition position;
 @NotNull private LocalDate startDate; @NotNull @DecimalMin("0.00") private BigDecimal monthlySalary; private String note;
}
