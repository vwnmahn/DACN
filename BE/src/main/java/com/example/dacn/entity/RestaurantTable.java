package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "restaurant_tables",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_restaurant_table_number",
                        columnNames = {"restaurant_id", "table_number"}
                )
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
public class RestaurantTable extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nhà hàng sở hữu bàn
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    // Số bàn: 1, 2, 3...
    @Column(name = "table_number", nullable = false)
    private Integer tableNumber;

    // Sức chứa tối đa
    @Column(name = "capacity", nullable = false)
    private Integer capacity;

    // Trạng thái quản lý: bàn có đang hoạt động không
    @Column(name = "active", nullable = false)
    private Boolean active = true;



}
