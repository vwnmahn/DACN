package com.example.dacn.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "carts", uniqueConstraints =
        @UniqueConstraint(name = "uk_cart_account", columnNames = "account_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
public class Cart extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_cart_account"))
    private Account account;

    @Builder.Default
    @OneToMany(mappedBy = "cart", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CartItem> items = new ArrayList<>();
}
