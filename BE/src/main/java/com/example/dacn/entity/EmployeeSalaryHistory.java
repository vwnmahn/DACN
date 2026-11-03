package com.example.dacn.entity;
import jakarta.persistence.*; import lombok.*; import lombok.experimental.SuperBuilder; import java.math.BigDecimal; import java.time.LocalDate;
@Entity @Table(name="employee_salary_history") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class EmployeeSalaryHistory extends BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="employee_id",nullable=false) private RestaurantEmployee employee;
 @Column(name="old_salary",nullable=false,precision=15,scale=2) private BigDecimal oldSalary;
 @Column(name="new_salary",nullable=false,precision=15,scale=2) private BigDecimal newSalary;
 @Column(name="effective_from",nullable=false) private LocalDate effectiveFrom;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="performed_by",nullable=false) private Account performedBy;
}
