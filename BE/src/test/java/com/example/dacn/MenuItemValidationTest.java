package com.example.dacn;

import com.example.dacn.dto.request.MenuItemRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.*;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class MenuItemValidationTest {
    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void rejectsBlankNameAndNegativePrice() {
        MenuItemRequest request = new MenuItemRequest();
        request.setRestaurantId(1L);
        request.setName(" ");
        request.setPrice(new BigDecimal("-1"));

        var violations = validator.validate(request);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("name")));
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("price")));
    }

    @Test
    void acceptsZeroPrice() {
        MenuItemRequest request = new MenuItemRequest();
        request.setRestaurantId(1L);
        request.setName("Nước lọc");
        request.setPrice(BigDecimal.ZERO);

        assertTrue(validator.validate(request).isEmpty());
    }
}
