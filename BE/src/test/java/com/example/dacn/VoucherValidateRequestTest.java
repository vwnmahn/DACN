package com.example.dacn;

import com.example.dacn.dto.request.VoucherValidateRequest;
import jakarta.validation.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class VoucherValidateRequestTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test void missingGpsIsRejected() {
        VoucherValidateRequest request = new VoucherValidateRequest();
        request.setVoucherCode("FCA10"); request.setRestaurantId(1L);
        VoucherValidateRequest.Item item = new VoucherValidateRequest.Item();
        item.setMenuItemId(1L); item.setQuantity(1); request.setItems(List.of(item));
        var violations = validator.validate(request);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("deliveryLatitude")));
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("deliveryLongitude")));
    }
}
