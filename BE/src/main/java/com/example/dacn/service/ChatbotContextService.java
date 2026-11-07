package com.example.dacn.service;

import com.example.dacn.dto.response.OrderResponse;
import com.example.dacn.dto.response.VoucherResponse;
import com.example.dacn.entity.MenuItem;
import com.example.dacn.entity.Restaurant;
import com.example.dacn.repository.MenuItemRepository;
import com.example.dacn.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatbotContextService {
    private static final double EARTH_RADIUS_KM = 6371.0088;
    private static final int MAX_RESTAURANTS = 30;
    private static final int MAX_MENU_ITEMS = 50;
    private static final int MAX_VOUCHERS = 30;
    private static final int MAX_ORDERS = 10;
    private static final DateTimeFormatter DATE_TIME =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Pattern ORDER_ID_PATTERN = Pattern.compile(
            "(?:don(?:\\s*hang)?|ma\\s*don)\\s*#?\\s*(\\d+)");

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;
    private final VoucherService voucherService;
    private final OrderService orderService;
    private final PaymentService paymentService;

    @Transactional(readOnly = true)
    public String buildContext(String question) {
        return buildContext(question, null, null);
    }

    @Transactional(readOnly = true)
    public String buildContext(String question, BigDecimal latitude, BigDecimal longitude) {
        return buildContextResult(question, latitude, longitude).content();
    }

    @Transactional(readOnly = true)
    public ContextResult buildContextResult(String question, BigDecimal latitude, BigDecimal longitude) {
        String normalized = normalize(question);
        StringBuilder context = new StringBuilder(
                "DỮ LIỆU BACKEND FCA CULINARY LIÊN QUAN ĐẾN CÂU HỎI:\n");
        EnumSet<Intent> intents = classify(normalized);
        ContextStatus status = ContextStatus.EMPTY;
        log.info("Chatbot intents selected: {}; gps={}", intents,
                validCoordinates(latitude, longitude) ? "valid" : "absent-or-invalid");

        if (intents.contains(Intent.NEAREST_BRANCH)) {
            appendNearestRestaurants(context, latitude, longitude);
        } else if (intents.contains(Intent.RESTAURANT)) {
            status = merge(status, appendRestaurants(context));
        }
        if (intents.contains(Intent.MENU)) {
            status = merge(status, appendMenuItems(context));
        }
        if (intents.contains(Intent.VOUCHER)) {
            status = merge(status, appendVouchers(context));
        }
        if (intents.contains(Intent.PAYMENT)) {
            appendPaymentMethods(context);
            status = ContextStatus.HAS_DATA;
        }
        if (intents.contains(Intent.ORDER)) {
            status = merge(status, appendOrders(context, normalized));
        }

        if (intents.isEmpty()) {
            log.info("Chatbot intent classification requires clarification");
            context.append("Ý định nghiệp vụ chưa rõ. Hãy hỏi lại người dùng một câu ngắn để xác định họ cần ")
                    .append("hỗ trợ về chi nhánh, món ăn, voucher, đơn hàng hay thanh toán.\n");
        }
        context.insert(0, "CONTEXT_STATUS=" + status + "\n");
        return new ContextResult(status, context.toString());
    }

    public Optional<String> nearestBranchAnswer(
            String question, BigDecimal latitude, BigDecimal longitude) {
        if (!classify(normalize(question)).contains(Intent.NEAREST_BRANCH)) {
            return Optional.empty();
        }
        if (!validCoordinates(latitude, longitude)) {
            return Optional.of("Mình chưa nhận được vị trí hợp lệ. "
                    + "Bạn vui lòng cấp quyền vị trí hoặc cho biết khu vực cần tìm nhé.");
        }
        try {
            List<RestaurantDistance> nearest = findNearestRestaurants(latitude, longitude);
            log.info("Chatbot direct nearest branch answer: returned={}", nearest.size());
            if (nearest.isEmpty()) {
                return Optional.of("Hiện chưa có chi nhánh đang hoạt động với tọa độ hợp lệ để tìm gần bạn.");
            }
            StringBuilder answer = new StringBuilder(
                    "Dựa trên vị trí hiện tại của bạn, chi nhánh gần nhất là:\n");
            for (RestaurantDistance item : nearest) {
                answer.append("- ").append(value(item.restaurant().getName()))
                        .append(" — ").append(value(item.restaurant().getAddress()))
                        .append(" — cách khoảng ")
                        .append(String.format(Locale.ROOT, "%.2f", item.distanceKm()))
                        .append(" km.\n");
            }
            return Optional.of(answer.toString().trim());
        } catch (RuntimeException exception) {
            log.error("Chatbot direct nearest branch query failed", exception);
            return Optional.of("Hệ thống tạm thời chưa thể truy xuất dữ liệu chi nhánh. "
                    + "Bạn vui lòng thử lại sau nhé.");
        }
    }

    boolean hasRecognizedIntent(String question) {
        return question != null && !classify(normalize(question)).isEmpty();
    }

    java.util.Set<String> classifiedIntentNames(String question) {
        return classify(normalize(question)).stream()
                .map(Enum::name)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private EnumSet<Intent> classify(String question) {
        EnumSet<Intent> intents = EnumSet.noneOf(Intent.class);
        boolean nearest = containsAny(question, "gan toi", "gan day", "gan nhat", "gan minh",
                "gan vi tri", "vi tri cua toi", "vi tri hien tai", "quanh day", "xung quanh toi");
        if (nearest && containsAny(question, "chi nhanh", "nha hang", "cua hang", "quan", "o dau", "tim")) {
            intents.add(Intent.NEAREST_BRANCH);
        } else if (containsAny(question, "nha hang", "chi nhanh", "cua hang", "co so", "dia chi",
                "lien he", "so dien thoai", "gio mo", "gio dong", "ha noi", "o dau")) {
            intents.add(Intent.RESTAURANT);
        }
        if (containsAny(question, "mon an", "thuc don", "menu", "mon gi", "nhung mon",
                "mon nao", "gia bao nhieu", "bao nhieu tien", "dang ban", "tam ngung",
                "re nhat", "duoi 50", "danh muc", "do uong", "ca phe", "tra sua",
                "con phuc vu", "con ban", "het mon")) {
            intents.add(Intent.MENU);
        }
        if (containsAny(question, "voucher", "khuyen mai", "uu dai", "giam gia", "ma giam",
                "con han", "dung duoc")) {
            intents.add(Intent.VOUCHER);
        }
        if (containsAny(question, "don hang", "ma don", "trang thai don", "don cua toi",
                "don gan nhat", "den dau", "da duoc giao", "toi co don", "giao chua",
                "huy don", "lich su don")) {
            intents.add(Intent.ORDER);
        }
        if (ORDER_ID_PATTERN.matcher(question).find()) {
            intents.add(Intent.ORDER);
        }
        if (containsAny(question, "thanh toan", "phuong thuc thanh toan", "tra tien",
                "cod", "vnpay", "momo", "zalopay", "thanh toan khi nhan hang", "thanh toan truc tuyen",
                "thanh toan online")) {
            intents.add(Intent.PAYMENT);
        }
        return intents;
    }

    private void appendNearestRestaurants(StringBuilder context, BigDecimal latitude, BigDecimal longitude) {
        context.append("\n[CHI NHÁNH GẦN VỊ TRÍ NGƯỜI DÙNG]\n");
        if (!validCoordinates(latitude, longitude)) {
            context.append("Không có GPS hợp lệ. Hãy đề nghị người dùng cấp quyền vị trí hoặc nhập khu vực/địa chỉ.\n");
            return;
        }
        try {
            List<RestaurantDistance> result = findNearestRestaurants(latitude, longitude);
            log.info("Chatbot nearest branch query completed: returned={}", result.size());
            if (result.isEmpty()) {
                context.append("Không có chi nhánh đang hoạt động với tọa độ hợp lệ trong Database.\n");
                return;
            }
            result.forEach(item -> context.append("- ").append(value(item.restaurant().getName()))
                    .append(" | địa chỉ: ").append(value(item.restaurant().getAddress()))
                    .append(" | điện thoại: ").append(value(item.restaurant().getPhoneNumber()))
                    .append(" | khoảng cách Haversine: ")
                    .append(String.format(Locale.ROOT, "%.2f", item.distanceKm())).append(" km\n"));
            context.append("Các khoảng cách trên do Backend tính toán; không được tự thay đổi hoặc ước lượng lại.\n");
        } catch (RuntimeException exception) {
            log.error("Chatbot nearest branch query failed", exception);
            appendRetrievalError(context);
        }
    }

    private List<RestaurantDistance> findNearestRestaurants(
            BigDecimal latitude, BigDecimal longitude) {
        List<RestaurantDistance> nearest = new ArrayList<>();
        for (Restaurant restaurant : restaurantRepository.findAll()) {
            if (!Boolean.TRUE.equals(restaurant.getActive())
                    || !validCoordinates(restaurant.getLatitude(), restaurant.getLongitude())) {
                continue;
            }
            double distance = haversine(latitude.doubleValue(), longitude.doubleValue(),
                    restaurant.getLatitude().doubleValue(), restaurant.getLongitude().doubleValue());
            nearest.add(new RestaurantDistance(restaurant, distance));
        }
        nearest.sort(Comparator.comparingDouble(RestaurantDistance::distanceKm));
        return nearest.stream().limit(3).toList();
    }

    private boolean validCoordinates(BigDecimal latitude, BigDecimal longitude) {
        return latitude != null && longitude != null
                && latitude.compareTo(BigDecimal.valueOf(-90)) >= 0
                && latitude.compareTo(BigDecimal.valueOf(90)) <= 0
                && longitude.compareTo(BigDecimal.valueOf(-180)) >= 0
                && longitude.compareTo(BigDecimal.valueOf(180)) <= 0;
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double latitudeDelta = Math.toRadians(lat2 - lat1);
        double longitudeDelta = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(latitudeDelta / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.pow(Math.sin(longitudeDelta / 2), 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private ContextStatus appendRestaurants(StringBuilder context) {
        context.append("\n[NHÀ HÀNG/CHI NHÁNH]\n");
        try {
            List<Restaurant> all = restaurantRepository.findAll();
            List<Restaurant> active = all.stream()
                    .filter(restaurant -> Boolean.TRUE.equals(restaurant.getActive()))
                    .toList();
            log.info("Chatbot restaurant context query completed: total={}, active={}",
                    all.size(), active.size());
            context.append("Tổng số chi nhánh đang hoạt động: ").append(active.size()).append(".\n");
            active.stream().limit(MAX_RESTAURANTS).forEach(restaurant -> context
                    .append("- ").append(value(restaurant.getName()))
                    .append(" | địa chỉ: ").append(value(restaurant.getAddress()))
                    .append(" | điện thoại: ").append(value(restaurant.getPhoneNumber()))
                    .append(" | giờ hoạt động: ").append(value(restaurant.getOpeningTime()))
                    .append(" - ").append(value(restaurant.getClosingTime()))
                    .append(" | trạng thái: đang hoạt động")
                    .append("\n"));
            appendLimitNotice(context, active.size(), MAX_RESTAURANTS);
            return active.isEmpty() ? ContextStatus.EMPTY : ContextStatus.HAS_DATA;
        } catch (RuntimeException exception) {
            log.error("Chatbot restaurant context query failed", exception);
            appendRetrievalError(context);
            return ContextStatus.ERROR;
        }
    }

    private ContextStatus appendMenuItems(StringBuilder context) {
        context.append("\n[THỰC ĐƠN/MÓN ĂN]\n");
        try {
            List<MenuItem> items = menuItemRepository
                    .findByActiveTrueAndRestaurantActiveTrueOrderByIdDesc();
            log.info("Chatbot menu context query completed: total={}", items.size());
            if (items.isEmpty()) {
                context.append("Database hiện không có món ăn đang kinh doanh.\n");
                return ContextStatus.EMPTY;
            }
            items.stream().limit(MAX_MENU_ITEMS).forEach(item -> context
                    .append("- ").append(value(item.getName()))
                    .append(" | nhà hàng: ").append(value(item.getRestaurant().getName()))
                    .append(" | giá hiện tại: ").append(value(item.getPrice())).append(" VND")
                    .append(" | mô tả: ").append(value(item.getDescription()))
                    .append(" | trạng thái phục vụ: ")
                    .append(Boolean.TRUE.equals(item.getAvailable())
                            ? "đang bán" : "tạm ngừng")
                    .append("\n"));
            context.append("Danh mục món: Entity/DTO hiện tại không có trường danh mục.\n");
            appendLimitNotice(context, items.size(), MAX_MENU_ITEMS);
            return ContextStatus.HAS_DATA;
        } catch (RuntimeException exception) {
            log.error("Chatbot menu context query failed", exception);
            appendRetrievalError(context);
            return ContextStatus.ERROR;
        }
    }

    private ContextStatus appendVouchers(StringBuilder context) {
        context.append("\n[VOUCHER/KHUYẾN MÃI KHẢ DỤNG CHO TÀI KHOẢN HIỆN TẠI]\n");
        try {
            List<VoucherResponse> vouchers = voucherService
                    .getAvailable(null, PageRequest.of(0, 100))
                    .getContent().stream()
                    .filter(voucher -> voucher.getCustomerStatus() == null
                            || "AVAILABLE".equals(voucher.getCustomerStatus()))
                    .limit(MAX_VOUCHERS)
                    .toList();
            log.info("Chatbot voucher context query completed: total={}", vouchers.size());
            if (vouchers.isEmpty()) {
                context.append("Không có voucher khả dụng cho tài khoản hiện tại.\n");
                return ContextStatus.EMPTY;
            }
            vouchers.forEach(voucher -> context
                    .append("- mã: ").append(value(voucher.getCode()))
                    .append(" | mô tả: ").append(value(voucher.getDescription()))
                    .append(" | loại giảm: ").append(value(voucher.getDiscountType()))
                    .append(" | giá trị giảm: ").append(value(voucher.getDiscountValue()))
                    .append(" | đơn tối thiểu: ").append(value(voucher.getMinOrderAmount()))
                    .append(" | giảm tối đa: ").append(value(voucher.getMaxDiscountAmount()))
                    .append(" | hiệu lực: ").append(format(voucher.getStartDate()))
                    .append(" đến ").append(format(voucher.getEndDate()))
                    .append(" | nhà hàng áp dụng: ").append(value(voucher.getRestaurantId()))
                    .append("\n"));
            return ContextStatus.HAS_DATA;
        } catch (RuntimeException exception) {
            log.error("Chatbot voucher context query failed", exception);
            appendRetrievalError(context);
            return ContextStatus.ERROR;
        }
    }

    private void appendPaymentMethods(StringBuilder context) {
        context.append("\n[PHƯƠNG THỨC THANH TOÁN]\n")
                .append("FCA Culinary hiện hỗ trợ tổng cộng 2 phương thức thanh toán:\n")
                .append("- COD: thanh toán khi nhận hàng.\n")
                .append("- VNPay: thanh toán trực tuyến qua cổng VNPay.\n")
                .append("- MoMo và ZaloPay: chưa được hỗ trợ trong checkout.\n");
    }

    private ContextStatus appendOrders(StringBuilder context, String normalizedQuestion) {
        context.append("\n[ĐƠN HÀNG CỦA TÀI KHOẢN ĐANG ĐĂNG NHẬP]\n");
        try {
            Matcher matcher = ORDER_ID_PATTERN.matcher(normalizedQuestion);
            if (matcher.find()) {
                OrderResponse order = orderService.getMyOrder(Long.valueOf(matcher.group(1)));
                appendOrder(context, order);
                return ContextStatus.HAS_DATA;
            }

            List<OrderResponse> orders = orderService.getMyOrders();
            log.info("Chatbot order context query completed: total={}", orders.size());
            if (orders.isEmpty()) {
                context.append("Tài khoản hiện tại chưa có đơn hàng.\n");
                return ContextStatus.EMPTY;
            }
            context.append("Danh sách được sắp xếp từ đơn mới nhất đến cũ hơn.\n");
            orders.stream().limit(MAX_ORDERS).forEach(order -> appendOrder(context, order));
            appendLimitNotice(context, orders.size(), MAX_ORDERS);
            return ContextStatus.HAS_DATA;
        } catch (RuntimeException exception) {
            log.error("Chatbot order context query failed", exception);
            context.append("Không tìm thấy đơn hàng thuộc tài khoản hiện tại hoặc không thể truy xuất. ")
                    .append("Không được suy đoán đơn hàng có thuộc tài khoản khác hay không.\n");
            return ContextStatus.ERROR;
        }
    }

    private ContextStatus merge(ContextStatus current, ContextStatus next) {
        if (current == ContextStatus.HAS_DATA || next == ContextStatus.HAS_DATA) {
            return ContextStatus.HAS_DATA;
        }
        if (current == ContextStatus.ERROR || next == ContextStatus.ERROR) {
            return ContextStatus.ERROR;
        }
        return ContextStatus.EMPTY;
    }

    private void appendOrder(StringBuilder context, OrderResponse order) {
        context.append("- đơn #").append(value(order.getId()))
                .append(" | nhà hàng: ").append(value(order.getRestaurantName()))
                .append(" | trạng thái: ").append(value(order.getStatus()))
                .append(" | thời gian đặt: ").append(format(order.getCreatedAt()))
                .append(" | tổng tiền: ").append(value(order.getTotalAmount())).append(" VND")
                .append(" | dự kiến giao: ").append(format(order.getEstimatedDeliveryAt()))
                .append(" | hạn hủy: ").append(format(order.getCancellationDeadline()))
                .append(" | địa chỉ giao: ").append(value(order.getDeliveryAddress()));
        try {
            var payment = paymentService.getStatusForCurrentUser(order.getId());
            context.append(" | phương thức thanh toán thực tế: ").append(value(payment.getPaymentMethod()))
                    .append(" | trạng thái thanh toán: ").append(value(payment.getPaymentStatus()));
        } catch (RuntimeException exception) {
            log.warn("Chatbot payment context unavailable for orderId={}", order.getId());
            context.append(" | thông tin thanh toán: chưa truy xuất được");
        }
        context.append("\n");
        if (order.getItems() != null && !order.getItems().isEmpty()) {
            context.append("  Món trong đơn:\n");
            order.getItems().forEach(item -> context.append("  + ")
                    .append(value(item.getItemName()))
                    .append(" | số lượng: ").append(value(item.getQuantity()))
                    .append(" | đơn giá: ").append(value(item.getUnitPrice())).append(" VND")
                    .append("\n"));
        }
    }

    private void appendLimitNotice(StringBuilder context, int total, int limit) {
        if (total > limit) {
            context.append("Kết quả đã giới hạn ").append(limit).append("/")
                    .append(total).append(" bản ghi; không được tuyên bố đây là danh sách đầy đủ.\n");
        }
    }

    private void appendRetrievalError(StringBuilder context) {
        context.append("Không thể truy xuất nhóm dữ liệu này ở thời điểm hiện tại; ")
                .append("không được diễn giải thành Database không có dữ liệu.\n");
    }

    private String format(java.time.LocalDateTime value) {
        return value == null ? "không có dữ liệu" : DATE_TIME.format(value);
    }

    private String value(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return "không có dữ liệu";
        return String.valueOf(value).replace('\n', ' ').replace('\r', ' ').trim();
    }

    private boolean containsAny(String value, String... keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) return true;
        }
        return false;
    }

    private String normalize(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        return normalized.replaceAll("\\s+", " ");
    }

    private enum Intent {
        RESTAURANT, NEAREST_BRANCH, MENU, VOUCHER, ORDER, PAYMENT
    }

    public enum ContextStatus {
        HAS_DATA, EMPTY, ERROR
    }

    public record ContextResult(ContextStatus status, String content) {}

    private record RestaurantDistance(Restaurant restaurant, double distanceKm) {}
}
