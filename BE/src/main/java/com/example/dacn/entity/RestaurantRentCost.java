package com.example.dacn.entity;
import jakarta.persistence.*; import lombok.*; import lombok.experimental.SuperBuilder; import java.math.BigDecimal;
@Entity @Table(name="restaurant_rent_costs",uniqueConstraints=@UniqueConstraint(name="uk_restaurant_rent_period",columnNames={"restaurant_id","year","month"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class RestaurantRentCost extends BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="restaurant_id",nullable=false) private Restaurant restaurant;
 @Column(nullable=false) private Integer year; @Column(nullable=false) private Integer month;
 @Column(nullable=false,precision=15,scale=2) private BigDecimal amount;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="updated_by",nullable=false) private Account updatedBy;
}
