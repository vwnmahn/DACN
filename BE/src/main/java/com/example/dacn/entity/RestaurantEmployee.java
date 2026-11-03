package com.example.dacn.entity;
import jakarta.persistence.*; import lombok.*; import lombok.experimental.SuperBuilder; import java.math.BigDecimal; import java.time.*;
@Entity @Table(name="restaurant_employees", uniqueConstraints=@UniqueConstraint(name="uk_employee_code",columnNames="employee_code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class RestaurantEmployee extends BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="employee_code",nullable=false,length=24) private String employeeCode;
 @Column(name="full_name",nullable=false,length=150) private String fullName;
 @Column(name="phone_number",nullable=false,length=20) private String phoneNumber;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=30) private EmployeePosition position;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="restaurant_id",nullable=false) private Restaurant restaurant;
 @Column(name="start_date",nullable=false) private LocalDate startDate;
 @Column(name="monthly_salary",nullable=false,precision=15,scale=2) private BigDecimal monthlySalary;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=30) @Builder.Default private EmploymentStatus status=EmploymentStatus.ACTIVE;
 @Column(length=1000) private String note;
 @Column(name="termination_requested_at") private LocalDateTime terminationRequestedAt;
 @Column(name="termination_effective_at") private LocalDateTime terminationEffectiveAt;
 @Column(name="termination_reason",length=1000) private String terminationReason;
}
