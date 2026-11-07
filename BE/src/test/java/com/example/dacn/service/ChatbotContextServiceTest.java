package com.example.dacn.service;

import com.example.dacn.repository.MenuItemRepository;
import com.example.dacn.repository.RestaurantRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ChatbotContextServiceTest {
    private final ChatbotContextService service = new ChatbotContextService(
            mock(RestaurantRepository.class),
            mock(MenuItemRepository.class),
            mock(VoucherService.class),
            mock(OrderService.class),
            mock(PaymentService.class));

    @Test
    void classifiesEquivalentBusinessQuestions() {
        assertThat(service.classifiedIntentNames("Có những chi nhánh nào?"))
                .contains("RESTAURANT");
        assertThat(service.classifiedIntentNames("Thực đơn đang bán món gì?"))
                .contains("MENU");
        assertThat(service.classifiedIntentNames("Có ưu đãi hay mã giảm giá nào không?"))
                .contains("VOUCHER");
        assertThat(service.classifiedIntentNames("Đơn hàng của tôi đến đâu rồi?"))
                .contains("ORDER");
        assertThat(service.classifiedIntentNames("Có mấy cách trả tiền?"))
                .contains("PAYMENT");
        assertThat(service.classifiedIntentNames("Tìm nhà hàng gần tôi"))
                .contains("NEAREST_BRANCH");
    }

    @Test
    void ambiguousQuestionRequiresClarification() {
        assertThat(service.classifiedIntentNames("Bạn giúp mình được không?"))
                .isEmpty();
    }

    @Test
    void priorQuestionCombinedWithFollowUpKeepsBusinessIntent() {
        assertThat(service.classifiedIntentNames(
                "Thực đơn có món nào? Câu hỏi tiếp nối: Món nào rẻ nhất?"))
                .contains("MENU");
    }
}
