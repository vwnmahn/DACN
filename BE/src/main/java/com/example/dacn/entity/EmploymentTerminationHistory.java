package com.example.dacn.entity;
import jakarta.persistence.*; import lombok.*; import lombok.experimental.SuperBuilder; import java.time.LocalDateTime;
@Entity @Table(name="employment_termination_history") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class EmploymentTerminationHistory extends BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="employee_id",nullable=false) private RestaurantEmployee employee;
 @Column(nullable=false,length=30) private String action;
 @Column(nullable=false,length=1000) private String reason;
 @Column(name="effective_at") private LocalDateTime effectiveAt;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="performed_by",nullable=false) private Account performedBy;
}
