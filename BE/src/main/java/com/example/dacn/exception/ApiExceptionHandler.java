package com.example.dacn.exception;



import com.example.dacn.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.access.AccessDeniedException;

@RestControllerAdvice
public class ApiExceptionHandler {

    // Lỗi nghiệp vụ
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException e) {
        ErrorCode error = e.getErrorCode();
        return buildResponse(error.getStatusCode(), error.getCode(), error.getMessage());
    }



    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(
            MethodArgumentNotValidException e) {

        // Thứ tự ưu tiên theo giao diện đăng ký
        java.util.List<String> fieldOrder = java.util.List.of(
                "username",
                "email",
                "phoneNumber",
                "dateOfBirth",
                "password",
                "confirmPassword"
        );

        var errors = e.getBindingResult().getFieldErrors();

        String message = errors.stream()
                .sorted(
                        java.util.Comparator
                                .comparingInt(
                                        (org.springframework.validation.FieldError error) -> {
                                            int index = fieldOrder.indexOf(error.getField());
                                            return index == -1
                                                    ? Integer.MAX_VALUE
                                                    : index;
                                        }
                                )
                                // Ưu tiên NotBlank hơn Size, Email, Pattern
                                // nếu cùng một trường có nhiều lỗi.
                                .thenComparingInt(error ->
                                        "NotBlank".equals(error.getCode()) ? 0 : 1
                                )
                )
                .map(error -> error.getDefaultMessage())
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse("Dữ liệu không hợp lệ");

        ErrorCode error = ErrorCode.INVALID_REQUEST;

        return buildResponse(
                error.getStatusCode(),
                error.getCode(),
                message
        );
    }



    @ExceptionHandler({
            HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiResponse<Object>> handleInvalidRequest(Exception e) {
        ErrorCode error = ErrorCode.INVALID_REQUEST;
        return buildResponse(error.getStatusCode(), error.getCode(), error.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException e) {
        ErrorCode error = ErrorCode.UNAUTHORIZED;
        return buildResponse(error.getStatusCode(), error.getCode(), error.getMessage());
    }

    // Lỗi hệ thống
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleException(Exception e) {
        ErrorCode error = ErrorCode.UNCATEGORIZED_EXCEPTION;
        return buildResponse(error.getStatusCode(), error.getCode(), error.getMessage());
    }

    // Hàm chung tạo response
    private ResponseEntity<ApiResponse<Object>> buildResponse(
            HttpStatus status, int code, String message) {

        ApiResponse<Object> response = ApiResponse.builder()
                .code(code)
                .message(message)
                .data(null)
                .build();

        return ResponseEntity.status(status).body(response);
    }
}
