package com.example.dacn.entity;
import jakarta.persistence.*; import lombok.*; import lombok.experimental.SuperBuilder; import java.math.BigDecimal;
@Entity @Table(name="restaurant_rent_cost_history") @Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class RestaurantRentCostHistory extends BaseEntity {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="rent_cost_id",nullable=false) private RestaurantRentCost rentCost;
 @Column(name="old_amount",precision=15,scale=2) private BigDecimal oldAmount;
 @Column(name="new_amount",nullable=false,precision=15,scale=2) private BigDecimal newAmount;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="performed_by",nullable=false) private Account performedBy;
}
