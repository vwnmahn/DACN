package com.example.dacn.controller;

import com.example.dacn.dto.request.RestaurantRequest;
import com.example.dacn.dto.request.RestaurantUpdateRequest;
import com.example.dacn.dto.response.ApiResponse;
import com.example.dacn.dto.response.RestaurantResponse;
import com.example.dacn.dto.response.RestaurantPageResponse;
import com.example.dacn.dto.response.TableAvailabilityResponse;
import com.example.dacn.service.RestaurantService;
import com.example.dacn.service.TableReservationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/restaurants")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;
    private final TableReservationService reservationService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantResponse>> create(
            @Valid @RequestBody RestaurantRequest request
    ) {

        RestaurantResponse data = restaurantService.create(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Tạo nhà hàng thành công")
                        .data(data)
                        .build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<RestaurantPageResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection) {

        RestaurantPageResponse data = restaurantService.getActivePage(page, size, sortBy, sortDirection);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantPageResponse>builder()
                        .code(1000)
                        .message("Lấy danh sách nhà hàng thành công")
                        .data(data)
                        .build()
        );
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<RestaurantResponse>>> getActive() {

        List<RestaurantResponse> data = restaurantService.getActive();

        return ResponseEntity.ok(
                ApiResponse.<List<RestaurantResponse>>builder()
                        .code(1000)
                        .message("Lấy danh sách nhà hàng đang hoạt động thành công")
                        .data(data)
                        .build()
        );
    }

    @GetMapping("/phone/{phoneNumber}")
    public ResponseEntity<ApiResponse<RestaurantResponse>> getByPhoneNumber(
            @PathVariable String phoneNumber
    ) {

        RestaurantResponse data =
                restaurantService.getByPhoneNumber(phoneNumber);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Tìm nhà hàng theo số điện thoại thành công")
                        .data(data)
                        .build()
        );
    }

    @GetMapping("/address")
    public ResponseEntity<ApiResponse<RestaurantResponse>> getByAddress(
            @RequestParam String address
    ) {

        RestaurantResponse data = restaurantService.getByAddress(address);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Tìm nhà hàng theo địa chỉ thành công")
                        .data(data)
                        .build()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RestaurantResponse>> getById(
            @PathVariable Long id
    ) {

        RestaurantResponse data = restaurantService.getById(id);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Lấy thông tin nhà hàng thành công")
                        .data(data)
                        .build()
        );
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody RestaurantUpdateRequest request
    ) {

        RestaurantResponse data = restaurantService.update(id, request);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Cập nhật nhà hàng thành công")
                        .data(data)
                        .build()
        );
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RestaurantResponse>> changeStatus(
            @PathVariable Long id,
            @RequestParam boolean active
    ) {

        RestaurantResponse data =
                restaurantService.changeStatus(id, active);

        return ResponseEntity.ok(
                ApiResponse.<RestaurantResponse>builder()
                        .code(1000)
                        .message("Cập nhật trạng thái nhà hàng thành công")
                        .data(data)
                        .build()
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id
    ) {

        restaurantService.delete(id);

        return ResponseEntity.ok(
                ApiResponse.<Void>builder()
                        .code(1000)
                        .message("Xóa nhà hàng thành công")
                        .data(null)
                        .build()
        );
    }
    /**
     * Kiểm tra các bàn còn trống theo ngày, giờ và số lượng khách.
     */
    @GetMapping("/{restaurantId}/tables/availability")
    public ApiResponse<TableAvailabilityResponse> getAvailability(
            @PathVariable @NotNull @Min(1) Long restaurantId,

            @RequestParam
            @NotNull
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate date,

            @RequestParam
            @NotNull
            @DateTimeFormat(iso = DateTimeFormat.ISO.TIME)
            LocalTime time,

            @RequestParam
            @NotNull
            @Min(1)
            Integer guests) {

        TableAvailabilityResponse result =
                reservationService.getAvailability(
                        restaurantId, date, time, guests);

        return ApiResponse.<TableAvailabilityResponse>builder()
                .code(1000)
                .message("Lấy thông tin bàn trống thành công")
                .data(result)
                .build();
    }

}
