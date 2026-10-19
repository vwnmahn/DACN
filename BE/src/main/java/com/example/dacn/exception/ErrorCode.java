package com.example.dacn.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ErrorCode {

    // Lỗi hệ thống
    UNCATEGORIZED_EXCEPTION(9999, "Lỗi hệ thống", HttpStatus.INTERNAL_SERVER_ERROR),
    INVALID_KEY(1001, "Mã lỗi không hợp lệ", HttpStatus.BAD_REQUEST),

    // Lỗi validation
    INVALID_USERNAME(1002, "Tên đăng nhập không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_PASSWORD(1003, "Mật khẩu không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_EMAIL(1004, "Email không hợp lệ", HttpStatus.BAD_REQUEST),
    INVALID_PHONE(1005, "Số điện thoại không hợp lệ", HttpStatus.BAD_REQUEST),

    // Lỗi đăng ký
    USER_EXISTED(1006, "Tên đăng nhập đã tồn tại", HttpStatus.CONFLICT),
    EMAIL_EXISTED(1007, "Email đã được sử dụng", HttpStatus.CONFLICT),
    PHONE_EXISTED(1008, "Số điện thoại đã được sử dụng", HttpStatus.CONFLICT),

    // Lỗi đăng nhập / JWT
    UNAUTHENTICATED(1009, "Chưa xác thực", HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(1010, "Không có quyền truy cập", HttpStatus.FORBIDDEN),
    INVALID_TOKEN(1011, "Token không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED),
    ACCOUNT_LOCKED(1012, "Tài khoản đã bị khóa", HttpStatus.FORBIDDEN),
    USER_NOT_EXISTED(1013, "Tài khoản không tồn tại", HttpStatus.NOT_FOUND),

    // Lỗi upload
    INVALID_IMAGE(1014, "Ảnh không hợp lệ", HttpStatus.BAD_REQUEST),
    IMAGE_TOO_LARGE(1015, "Ảnh vượt quá dung lượng cho phép", HttpStatus.BAD_REQUEST),
    AVATAR_NOT_FOUND(1025, "Không tìm thấy ảnh đại diện", HttpStatus.NOT_FOUND),
    INVALID_SOCIAL_TOKEN(1016, "Token đăng nhập mạng xã hội không hợp lệ", HttpStatus.UNAUTHORIZED),
    SOCIAL_LOGIN_FAILED(1017, "Không thể xác minh tài khoản mạng xã hội", HttpStatus.BAD_GATEWAY),
    SOCIAL_ACCOUNT_CONFLICT(1018, "Email đã thuộc tài khoản khác", HttpStatus.CONFLICT),
    INVALID_REQUEST(1019, "Dữ liệu yêu cầu không hợp lệ", HttpStatus.BAD_REQUEST),
    TOKEN_REVOKED(1020, "Token đã bị thu hồi", HttpStatus.UNAUTHORIZED),

    INVALID_REFRESH_TOKEN(1021, "Refresh Token không hợp lệ", HttpStatus.UNAUTHORIZED),

    REFRESH_TOKEN_EXPIRED(1022, "Refresh Token đã hết hạn", HttpStatus.UNAUTHORIZED),

    REFRESH_TOKEN_REVOKED(1023, "Refresh Token đã bị thu hồi", HttpStatus.UNAUTHORIZED),

    REFRESH_TOKEN_REQUIRED(1024, "Refresh Token không được để trống", HttpStatus.BAD_REQUEST),
    PASSWORD_CONFIRM_NOT_MATCH(1025,"Mật khẩu xác thực không khớp",HttpStatus.CONFLICT),
    ACCOUNT_INVALID_PAGE_REQUEST(2001, "Tham số phân trang hoặc sắp xếp tài khoản không hợp lệ", HttpStatus.BAD_REQUEST),
    ACCOUNT_SELF_LOCK_FORBIDDEN(2002, "Quản trị viên không thể tự khóa tài khoản của mình", HttpStatus.CONFLICT),
    ACCOUNT_SELF_DEMOTION_FORBIDDEN(2003, "Quản trị viên không thể tự hạ quyền", HttpStatus.CONFLICT),
    LAST_ADMIN_PROTECTED(2004, "Không thể khóa hoặc hạ quyền quản trị viên cuối cùng", HttpStatus.CONFLICT),
    CURRENT_PASSWORD_INVALID(2005, "Mật khẩu hiện tại không chính xác", HttpStatus.BAD_REQUEST),
    PASSWORD_CHANGE_NOT_SUPPORTED(2006, "Tài khoản đăng nhập mạng xã hội chưa có mật khẩu nội bộ", HttpStatus.CONFLICT),
    // ================= RESTAURANT =================

    // Không tìm thấy
    RESTAURANT_NOT_FOUND(3001, "Không tìm thấy nhà hàng", HttpStatus.NOT_FOUND),

    RESTAURANT_PHONE_NOT_FOUND(3002, "Không tìm thấy nhà hàng với số điện thoại này", HttpStatus.NOT_FOUND),

    RESTAURANT_ADDRESS_NOT_FOUND(3003, "Không tìm thấy nhà hàng tại địa chỉ này", HttpStatus.NOT_FOUND),
    ACCOUNT_NOT_FOUND(3016,"Không tìm thấy tai khoản",HttpStatus.NOT_FOUND),

    // Dữ liệu đã tồn tại
    RESTAURANT_PHONE_ALREADY_EXISTS(3004, "Số điện thoại nhà hàng đã tồn tại", HttpStatus.CONFLICT),

    RESTAURANT_ADDRESS_ALREADY_EXISTS(3005, "Địa chỉ nhà hàng đã tồn tại", HttpStatus.CONFLICT),

    // Trạng thái
    RESTAURANT_INACTIVE(3006, "Nhà hàng đã ngừng hoạt động", HttpStatus.CONFLICT),

    RESTAURANT_ALREADY_ACTIVE(3007, "Nhà hàng đang ở trạng thái hoạt động", HttpStatus.CONFLICT),

    RESTAURANT_ALREADY_INACTIVE(3008, "Nhà hàng đã ở trạng thái ngừng hoạt động", HttpStatus.CONFLICT),

    // Dữ liệu không hợp lệ
    RESTAURANT_INVALID_OPENING_TIME(3009, "Giờ mở cửa không hợp lệ", HttpStatus.BAD_REQUEST),

    RESTAURANT_INVALID_CLOSING_TIME(3010, "Giờ đóng cửa không hợp lệ", HttpStatus.BAD_REQUEST),

    RESTAURANT_INVALID_DELIVERY_FEE(3011, "Phí giao hàng không hợp lệ", HttpStatus.BAD_REQUEST),

    RESTAURANT_INVALID_DELIVERY_RADIUS(3012, "Bán kính giao hàng không hợp lệ", HttpStatus.BAD_REQUEST),

    RESTAURANT_INVALID_PHONE_NUMBER(3013, "Số điện thoại nhà hàng không hợp lệ", HttpStatus.BAD_REQUEST),

    // Xóa nhà hàng
    RESTAURANT_DELETE_FAILED(3014, "Không thể xóa nhà hàng", HttpStatus.CONFLICT),

    RESTAURANT_HAS_RELATED_DATA(3015, "Không thể xóa nhà hàng vì đang có dữ liệu liên quan; hãy dùng active=false để ngừng hoạt động", HttpStatus.CONFLICT),
    RESTAURANT_CLOSED(3017, "Nhà hàng hiện đang đóng cửa", HttpStatus.CONFLICT),
    RESTAURANT_INVALID_PAGE_REQUEST(3018, "Tham số phân trang hoặc sắp xếp nhà hàng không hợp lệ", HttpStatus.BAD_REQUEST),

    // ================= PAYMENT =================
    PAYMENT_NOT_FOUND(4001, "Không tìm thấy giao dịch thanh toán", HttpStatus.NOT_FOUND),
    PAYMENT_INVALID_ORDER_ID(4002, "Mã đơn hàng không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_METHOD_INVALID(4003, "Phương thức thanh toán không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_AMOUNT_INVALID(4004, "Số tiền thanh toán phải lớn hơn 0", HttpStatus.BAD_REQUEST),
    PAYMENT_INVALID_STATE(4005, "Trạng thái giao dịch không cho phép thao tác này", HttpStatus.CONFLICT),
    PAYMENT_URL_INVALID(4006, "URL thanh toán không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_GATEWAY_TRANSACTION_ID_REQUIRED(4007, "Thiếu mã giao dịch từ cổng thanh toán", HttpStatus.BAD_REQUEST),
    PAYMENT_ALREADY_COMPLETED(4008, "Đơn hàng đã có giao dịch thanh toán thành công", HttpStatus.CONFLICT),
    PAYMENT_ORDER_NOT_PAYABLE(4009, "Đơn hàng không thể thanh toán ở trạng thái hiện tại", HttpStatus.CONFLICT),
    PAYMENT_AMOUNT_MISMATCH(4010, "Số tiền thanh toán không khớp với đơn hàng", HttpStatus.CONFLICT),
    VNPAY_CONFIGURATION_MISSING(4011, "Cấu hình VNPay chưa đầy đủ", HttpStatus.SERVICE_UNAVAILABLE),
    VNPAY_INVALID_SIGNATURE(4012, "Chữ ký VNPay không hợp lệ", HttpStatus.BAD_REQUEST),
    VNPAY_MERCHANT_MISMATCH(4013, "Mã merchant VNPay không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_INVALID_PAGE_REQUEST(4014, "Tham số tìm kiếm, phân trang hoặc sắp xếp thanh toán không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_RECONCILIATION_IN_PROGRESS(4015, "Giao dịch đang được đối soát", HttpStatus.CONFLICT),
    PAYMENT_RECONCILIATION_NOT_ALLOWED(4016, "Giao dịch không thể đối soát", HttpStatus.CONFLICT),
    PAYMENT_GATEWAY_RESPONSE_INVALID(4017, "Phản hồi từ VNPay không hợp lệ", HttpStatus.BAD_GATEWAY),
    PAYMENT_GATEWAY_UNAVAILABLE(4018, "Không thể xác định kết quả từ VNPay; cần đối soát lại", HttpStatus.BAD_GATEWAY),
    PAYMENT_REFUND_NOT_ALLOWED(4019, "Giao dịch không đủ điều kiện hoàn tiền", HttpStatus.CONFLICT),
    PAYMENT_REFUND_AMOUNT_INVALID(4020, "Số tiền hoàn không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_REFUND_EXCEEDS_PAID_AMOUNT(4021, "Tổng tiền hoàn vượt quá số tiền đã thanh toán", HttpStatus.CONFLICT),
    PAYMENT_REFUND_IN_PROGRESS(4022, "Giao dịch hoàn tiền đang được xử lý hoặc cần đối soát", HttpStatus.CONFLICT),
    PAYMENT_REFUND_IDEMPOTENCY_REQUIRED(4023, "Idempotency key hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST),
    PAYMENT_REFUND_NOT_FOUND(4024, "Không tìm thấy lịch sử hoàn tiền", HttpStatus.NOT_FOUND),

    // ================= DELIVERY =================
    INVALID_GPS_COORDINATES(5001, "Tọa độ GPS không hợp lệ", HttpStatus.BAD_REQUEST),
    DELIVERY_DISTANCE_EXCEEDED(5002, "Địa chỉ giao hàng vượt quá bán kính của nhà hàng", HttpStatus.BAD_REQUEST),
    RESTAURANT_GPS_NOT_CONFIGURED(5003, "Nhà hàng chưa cấu hình tọa độ giao hàng", HttpStatus.CONFLICT),
    RESTAURANT_DELIVERY_POLICY_INVALID(5004, "Chính sách phí giao hàng của nhà hàng không hợp lệ", HttpStatus.CONFLICT),

    // ================= MENU ITEM =================
    MENU_ITEM_NOT_FOUND(6001, "Không tìm thấy món ăn", HttpStatus.NOT_FOUND),
    MENU_ITEM_INVALID_PRICE(6002, "Giá món ăn không hợp lệ", HttpStatus.BAD_REQUEST),
    MENU_ITEM_UNAVAILABLE(6003, "Món ăn hiện không còn bán", HttpStatus.CONFLICT),
    MENU_ITEM_NOT_IN_RESTAURANT(6004, "Món ăn không thuộc nhà hàng đã chọn", HttpStatus.BAD_REQUEST),

    // ================= ORDER =================
    ORDER_NOT_FOUND(7001, "Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND),
    ORDER_INVALID_QUANTITY(7002, "Số lượng món ăn không hợp lệ", HttpStatus.BAD_REQUEST),
    ORDER_IDEMPOTENCY_CONFLICT(7003, "Idempotency key đã được sử dụng cho yêu cầu khác", HttpStatus.CONFLICT),
    ORDER_DUPLICATE_MENU_ITEM(7004, "Đơn hàng chứa món ăn bị trùng lặp", HttpStatus.BAD_REQUEST),
    ORDER_INVALID_STATE(7005, "Trạng thái đơn hàng không cho phép thao tác này", HttpStatus.CONFLICT),
    CHECKOUT_PAYMENT_METHOD_UNSUPPORTED(7006, "Checkout chỉ hỗ trợ COD hoặc VNPAY", HttpStatus.BAD_REQUEST),
    ORDER_CONFIRMATION_EXPIRED(7007, "Đã quá hạn xác nhận đơn hàng", HttpStatus.CONFLICT),
    ORDER_NOT_AWAITING_CONFIRMATION(7008, "Đơn hàng không ở trạng thái chờ xác nhận", HttpStatus.CONFLICT),
    ORDER_INVALID_TRANSITION(7009, "Không thể chuyển sang trạng thái đơn hàng yêu cầu", HttpStatus.CONFLICT),
    ORDER_PAYMENT_NOT_READY(7010, "Trạng thái thanh toán chưa đáp ứng thao tác đơn hàng", HttpStatus.CONFLICT),
    ORDER_CANCELLATION_NOT_ALLOWED(7011, "Không thể hủy đơn hàng ở trạng thái hiện tại", HttpStatus.CONFLICT),
    COD_COLLECTION_REQUIRED(7012, "Phải xác nhận đã thu tiền COD thực tế", HttpStatus.CONFLICT),
    ORDER_NOT_COD(7013, "Đơn hàng không sử dụng phương thức COD", HttpStatus.CONFLICT),
    VNPAY_ORDER_NOT_ACCEPTED(7014, "Đơn hàng chưa được nhà hàng chấp nhận để thanh toán VNPay", HttpStatus.CONFLICT),
    ORDER_INVALID_SEARCH_REQUEST(7015, "Tham số tìm kiếm hoặc phân trang đơn hàng không hợp lệ", HttpStatus.BAD_REQUEST),

    // ================= VOUCHER =================
    VOUCHER_NOT_FOUND(8001, "Voucher không tồn tại", HttpStatus.NOT_FOUND),
    VOUCHER_INACTIVE(8002, "Voucher đã bị vô hiệu hóa", HttpStatus.CONFLICT),
    VOUCHER_NOT_STARTED(8003, "Voucher chưa đến thời gian hiệu lực", HttpStatus.CONFLICT),
    VOUCHER_EXPIRED(8004, "Voucher đã hết hạn", HttpStatus.CONFLICT),
    VOUCHER_USAGE_LIMIT_REACHED(8005, "Voucher đã hết lượt sử dụng", HttpStatus.CONFLICT),
    VOUCHER_USER_LIMIT_REACHED(8006, "Bạn đã vượt giới hạn sử dụng voucher", HttpStatus.CONFLICT),
    VOUCHER_MIN_ORDER_NOT_MET(8007, "Đơn hàng chưa đạt giá trị tối thiểu của voucher", HttpStatus.CONFLICT),
    VOUCHER_NOT_APPLICABLE_TO_RESTAURANT(8008, "Voucher không áp dụng cho nhà hàng này", HttpStatus.CONFLICT),
    VOUCHER_ALREADY_RESERVED_FOR_ORDER(8009, "Đơn hàng đã được giữ hoặc áp dụng voucher", HttpStatus.CONFLICT),
    VOUCHER_INVALID_DATA(8010, "Dữ liệu voucher không hợp lệ", HttpStatus.BAD_REQUEST),
    VOUCHER_CODE_EXISTS(8011, "Mã voucher đã tồn tại", HttpStatus.CONFLICT),
    VOUCHER_HISTORY_IMMUTABLE(8012, "Không thể sửa điều kiện voucher đã có lịch sử sử dụng", HttpStatus.CONFLICT),
    VOUCHER_INVALID_PAGE_REQUEST(8013, "Tham số phân trang hoặc sắp xếp voucher không hợp lệ", HttpStatus.BAD_REQUEST),
    LOYALTY_POINTS_INSUFFICIENT(8014, "Bạn chưa đủ 300 điểm khả dụng", HttpStatus.CONFLICT),
    VOUCHER_NOT_REDEEMABLE(8015, "Voucher không còn đủ điều kiện để đổi điểm", HttpStatus.CONFLICT)


    ;

    private final int code;
    private final String message;
    private final HttpStatus statusCode;

}
