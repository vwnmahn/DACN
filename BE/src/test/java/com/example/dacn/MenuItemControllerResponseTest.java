package com.example.dacn;

import com.example.dacn.controller.MenuItemController;
import com.example.dacn.dto.response.MenuItemResponse;
import com.example.dacn.service.MenuItemService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MenuItemControllerResponseTest {
    @Test
    void wrapsSuccessfulResponseInApiResponse() {
        MenuItemService service = mock(MenuItemService.class);
        when(service.getAll()).thenReturn(List.of(MenuItemResponse.builder().id(1L).build()));

        var response = new MenuItemController(service).getAll();

        assertNotNull(response.getBody());
        assertEquals(1000, response.getBody().getCode());
        assertNotNull(response.getBody().getMessage());
        assertEquals(1, response.getBody().getData().size());
    }
}
