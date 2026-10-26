
// ============================================
// FCA Table Reservation
// File: table-reservation.js
// ============================================

"use strict";

const API_ORIGIN = "http://localhost:8080";
const API_BASE_URL = `${API_ORIGIN}/api/v1`;

// Endpoint availability cần đối chiếu với controller thực tế.
const AVAILABILITY_URL = (restaurantId, date, time, guests) => {
    const params = new URLSearchParams({
        date,
        time: `${time}:00`,
        guests: String(guests)
    });

    return `${API_BASE_URL}/restaurants/${restaurantId}/tables/availability?${params}`;
};

const state = {
    availabilityChecked: false,
    submitting: false,
    checkingAvailability: false,
    restaurantName: "",
    restaurantRequestId: 0,
    pendingReservation: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
    cacheElements();
    setMinDate();
    readRestaurantIdFromUrl();
    bindEvents();
    updateSummary();
}

function cacheElements() {
    [
        "reservation-form",
        "restaurant-id",
        "restaurant-name",
        "reservation-date",
        "reservation-time",
        "guest-count",
        "guest-decrease",
        "guest-increase",
        "customer-name",
        "customer-phone",
        "reservation-note",
        "check-availability",
        "availability-message",
        "reservation-message",
        "submit-reservation",
        "summary-restaurant",
        "summary-date",
        "summary-time",
        "summary-guests",
        "reservation-confirm-modal",
        "reservation-confirm-question",
        "reservation-confirm-details",
        "cancel-reservation-confirm",
        "continue-reservation-confirm",
        "back-reservation-confirm",
        "final-reservation-confirm",
        "reservation-confirm-error",
        "confirm-restaurant-name",
        "confirm-date",
        "confirm-time",
        "confirm-guests",
        "confirm-customer-name",
        "confirm-customer-phone",
        "confirm-note",
        
        "reservation-success-modal",
        "close-reservation-success",
        "success-restaurant",
        "success-date",
        "success-time",
        "success-guests",
        "success-customer-name",
        "success-customer-phone",
        "success-note",
        "success-code-row",
        "success-code"

    ].forEach((id) => {
        elements[id] = document.getElementById(id);
    });
}

function bindEvents() {
    elements["reservation-form"].addEventListener("submit", handleSubmit);

    elements["guest-decrease"].addEventListener("click", () => {
        changeGuestCount(-1);
    });

    elements["guest-increase"].addEventListener("click", () => {
        changeGuestCount(1);
    });

    elements["close-reservation-success"].addEventListener(
        "click",
        closeSuccessModal
    );

    [
        "restaurant-id",
        "reservation-date",
        "reservation-time",
        "guest-count"
    ].forEach((id) => {
        elements[id].addEventListener("change", () => {
            invalidateAvailability();
            updateSummary();
        });

        elements[id].addEventListener("input", updateSummary);
    });

    elements["check-availability"].addEventListener(
        "click",
        handleCheckAvailability
    );

    elements["cancel-reservation-confirm"].addEventListener("click", closeConfirmationModal);
    elements["back-reservation-confirm"].addEventListener("click", closeConfirmationModal);
    elements["continue-reservation-confirm"].addEventListener("click", showConfirmationDetails);
    elements["final-reservation-confirm"].addEventListener("click", submitConfirmedReservation);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !state.submitting) {
            closeConfirmationModal();
        }
    });
}

function setMinDate() {
    // Dùng ngày theo múi giờ địa phương, tránh lệch ngày do UTC.
    const now = new Date();
    const localDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
    ].join("-");

    elements["reservation-date"].min = localDate;
}

function readRestaurantIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get("restaurantId");

    if (restaurantId && /^\d+$/.test(restaurantId) &&
        Number(restaurantId) > 0) {
        elements["restaurant-id"].value = restaurantId;
        loadRestaurantName(restaurantId);
    } else {
        elements["restaurant-name"].value = "Chưa chọn nhà hàng";
    }

    updateSummary();
}

async function loadRestaurantName(restaurantId) {
    const requestId = ++state.restaurantRequestId;
    state.restaurantName = "";
    elements["restaurant-name"].value = "Đang tải tên nhà hàng...";
    updateSummary();

    try {
        const response = await fetch(
            `${API_BASE_URL}/restaurants/${encodeURIComponent(restaurantId)}`,
            { headers: getAuthHeaders() }
        );
        const result = await readApiResponse(response);

        if (requestId !== state.restaurantRequestId) return;

        const restaurant = result.data;
        const name = String(restaurant?.name || "").trim();

        if (!name) {
            throw new Error("Backend không trả về tên nhà hàng.");
        }

        state.restaurantName = name;
        elements["restaurant-name"].value = name;
        updateSummary();
    } catch (error) {
        if (requestId !== state.restaurantRequestId) return;

        state.restaurantName = "";
        elements["restaurant-name"].value = "Không tải được tên nhà hàng";
        updateSummary();
        showNotice(error.message || "Không thể tải thông tin nhà hàng.", "error");
    }
}

function getFormData() {
    return {
        restaurantId: Number(elements["restaurant-id"].value),
        customerName: elements["customer-name"].value.trim(),
        customerPhone: elements["customer-phone"].value.trim(),
        guestCount: Number(elements["guest-count"].value),
        date: elements["reservation-date"].value,
        time: elements["reservation-time"].value,
        note: elements["reservation-note"].value.trim()
    };
}

function getAuthHeaders(includeJson = false) {
    if (window.FCA_SHELL?.authHeaders) {
        return {
            Accept: "application/json",
            ...window.FCA_SHELL.authHeaders(includeJson)
        };
    }

    const headers = { Accept: "application/json" };
    const token = localStorage.getItem("accessToken");

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function validateBooking(data) {
    if (!Number.isInteger(data.restaurantId) || data.restaurantId < 1) {
        return "Vui lòng nhập mã nhà hàng hợp lệ.";
    }

    if (!data.customerName) {
        return "Vui lòng nhập họ và tên.";
    }

    if (data.customerName.length > 150) {
        return "Họ tên không được vượt quá 150 ký tự.";
    }

    if (!data.customerPhone) {
        return "Vui lòng nhập số điện thoại.";
    }

    if (data.customerPhone.length > 20) {
        return "Số điện thoại không được vượt quá 20 ký tự.";
    }

    // Kiểm tra cơ bản, không áp đặt riêng định dạng số Việt Nam.
    if (!/^[+\d][\d\s().-]{5,19}$/.test(data.customerPhone)) {
        return "Số điện thoại không hợp lệ.";
    }

    if (!Number.isInteger(data.guestCount) ||
        data.guestCount < 1 ||
        data.guestCount > 50) {
        return "Số lượng khách phải từ 1 đến 50.";
    }

    if (!data.date) {
        return "Vui lòng chọn ngày đặt bàn.";
    }

    if (!data.time) {
        return "Vui lòng chọn giờ đến.";
    }

    if (data.date < elements["reservation-date"].min) {
        return "Ngày đặt bàn không được ở trong quá khứ.";
    }

    if (data.note.length > 500) {
        return "Ghi chú không được vượt quá 500 ký tự.";
    }

    return null;
}

function changeGuestCount(delta) {
    const input = elements["guest-count"];
    const current = Number(input.value) || 1;

    input.value = Math.min(50, Math.max(1, current + delta));

    invalidateAvailability();
    updateSummary();
}

function updateSummary() {
    const restaurantId = elements["restaurant-id"].value.trim();
    const date = elements["reservation-date"].value;
    const time = elements["reservation-time"].value;
    const guests = Number(elements["guest-count"].value);

    elements["summary-restaurant"].textContent =
        state.restaurantName
            ? state.restaurantName
            : restaurantId && Number(restaurantId) > 0
                ? "Đang tải tên nhà hàng..."
            : "Chưa chọn";

    elements["summary-date"].textContent =
        date ? formatDate(date) : "Chưa chọn";

    elements["summary-time"].textContent =
        time || "Chưa chọn";

    elements["summary-guests"].textContent =
        Number.isInteger(guests) && guests > 0
            ? `${guests} người`
            : "Chưa chọn";
}

function formatDate(value) {
    const parts = value.split("-");

    if (parts.length !== 3) {
        return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function invalidateAvailability() {
    state.availabilityChecked = false;

    const box = elements["availability-message"];
    box.hidden = true;
    box.textContent = "";
    box.className = "availability-message";
}

function showNotice(message, type = "info") {
    const box = elements["reservation-message"];

    box.textContent = message;
    box.className = `notice ${type}`;
    box.hidden = false;

    box.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function showAvailability(message, type = "info") {
    const box = elements["availability-message"];

    box.textContent = message;
    box.className = `availability-message ${type}`;
    box.hidden = false;
}

async function readApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        const text = await response.text();

        throw new Error(
            response.ok
                ? "Máy chủ không trả về JSON như mong đợi."
                : `Yêu cầu thất bại (HTTP ${response.status}).`
        );
    }

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            result.message ||
            `Yêu cầu thất bại (HTTP ${response.status}).`
        );
    }

    // ApiResponse của dự án dùng code = 1000 khi thành công.
    if (typeof result.code === "number" && result.code !== 1000) {
        throw new Error(result.message || "Máy chủ từ chối yêu cầu.");
    }

    return result;
}

async function handleCheckAvailability() {
    if (state.checkingAvailability || state.submitting) {
        return;
    }

    const data = getFormData();

    if (!Number.isInteger(data.restaurantId) || data.restaurantId < 1) {
        showAvailability("Vui lòng nhập mã nhà hàng hợp lệ.", "error");
        return;
    }

    if (!data.date || !data.time) {
        showAvailability("Vui lòng chọn ngày và giờ trước khi kiểm tra.", "error");
        return;
    }

    if (!Number.isInteger(data.guestCount) ||
        data.guestCount < 1 ||
        data.guestCount > 50) {
        showAvailability("Vui lòng nhập số lượng khách hợp lệ.", "error");
        return;
    }

    if (data.date < elements["reservation-date"].min) {
        showAvailability("Ngày đặt bàn không được ở trong quá khứ.", "error");
        return;
    }

    state.checkingAvailability = true;

    const button = elements["check-availability"];
    button.disabled = true;
    button.textContent = "Đang kiểm tra...";

    showAvailability("Đang gửi yêu cầu kiểm tra đến máy chủ.", "info");

    try {
        const response = await fetch(
            AVAILABILITY_URL(
                data.restaurantId,
                data.date,
                data.time,
                data.guestCount
            ),
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const result = await readApiResponse(response);
        const availability = result.data;

        if (availability == null) {
            throw new Error("Máy chủ không trả về dữ liệu tình trạng bàn.");
        }

        // Chỉ diễn giải các trường khả dụng khi API thực tế trả về.
        const available = Number(availability.availableTableCount) > 0;

        if (available === true) {
            state.availabilityChecked = true;
            showAvailability(
                "Máy chủ cho biết có bàn phù hợp. Bạn có thể gửi yêu cầu đặt bàn.",
                "success"
            );
        } else {
            state.availabilityChecked = true;
            showAvailability(
                "Không có bàn phù hợp với yêu cầu của khách hàng.",
                "error"
            );
        }
    } catch (error) {
        showAvailability(
            `${error.message || "Không thể kiểm tra tình trạng bàn."} Hãy kiểm tra endpoint availability và thử lại.`,
            "error"
        );
    } finally {
        state.checkingAvailability = false;
        button.disabled = false;
        button.textContent = "Kiểm tra bàn";
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (state.submitting || state.checkingAvailability) {
        return;
    }

    const form = elements["reservation-form"];

    if (!form.reportValidity()) {
        return;
    }

    const data = getFormData();
    const validationError = validateBooking(data);

    if (validationError) {
        showNotice(validationError, "error");
        return;
    }

    if (!state.restaurantName) {
        showNotice("Chưa tải được tên nhà hàng. Vui lòng thử lại.", "error");
        return;
    }

    state.pendingReservation = { ...data };
    hideNotice();
    openConfirmationModal();
}

function openConfirmationModal() {
    elements["reservation-confirm-question"].hidden = false;
    elements["reservation-confirm-details"].hidden = true;
    elements["reservation-confirm-error"].hidden = true;
    elements["reservation-confirm-error"].textContent = "";
    elements["reservation-confirm-modal"].hidden = false;
    elements["reservation-confirm-modal"].setAttribute("aria-hidden", "false");
    document.body.classList.add("reservation-confirm-open");
    elements["cancel-reservation-confirm"].focus();
}

function closeConfirmationModal(force = false) {
    if (state.submitting && !force) return;

    elements["reservation-confirm-modal"].hidden = true;
    elements["reservation-confirm-modal"].setAttribute("aria-hidden", "true");
    document.body.classList.remove("reservation-confirm-open");
    state.pendingReservation = null;
    elements["submit-reservation"].focus();
}

function showConfirmationDetails() {
    const data = state.pendingReservation;
    if (!data) return;

    elements["confirm-restaurant-name"].textContent = state.restaurantName;
    elements["confirm-date"].textContent = formatDate(data.date);
    elements["confirm-time"].textContent = data.time;
    elements["confirm-guests"].textContent = `${data.guestCount} người`;
    elements["confirm-customer-name"].textContent = data.customerName;
    elements["confirm-customer-phone"].textContent = data.customerPhone;
    elements["confirm-note"].textContent = data.note || "Không có";
    elements["reservation-confirm-question"].hidden = true;
    elements["reservation-confirm-details"].hidden = false;
    elements["final-reservation-confirm"].focus();
}

async function submitConfirmedReservation() {
    if (state.submitting || !state.pendingReservation) return;

    const data = state.pendingReservation;

    // Spring LocalTime thường nhận HH:mm:ss.
    const requestBody = {
        restaurantId: data.restaurantId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        guestCount: data.guestCount,
        date: data.date,
        time: `${data.time}:00`,
        note: data.note
    };

    state.submitting = true;
    setSubmitLoading(true);
    setConfirmationLoading(true);
    hideNotice();

    try {
        const response = await fetch(`${API_BASE_URL}/table-reservations`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify(requestBody)
        });


        const result = await readApiResponse(response);

        const reservation = result.data;
        const reservationId = reservation?.reservationId ?? reservation?.id;

        // Đóng bước xác nhận và hiện hộp thoại thành công
        // chỉ sau khi readApiResponse xác nhận response hợp lệ.
        closeConfirmationModal(true);
        hideNotice();
        showSuccessModal(data, reservationId);

        state.availabilityChecked = false;

    } catch (error) {
        const message = error.message ||
            "Không thể gửi yêu cầu đặt bàn. Vui lòng thử lại.";
        elements["reservation-confirm-error"].textContent = message;
        elements["reservation-confirm-error"].hidden = false;
        showNotice(message, "error");
    } finally {
        state.submitting = false;
        setSubmitLoading(false);
        setConfirmationLoading(false);
    }
}

function setConfirmationLoading(loading) {
    const button = elements["final-reservation-confirm"];
    button.disabled = loading;
    button.textContent = loading ? "Đang đặt bàn..." : "Xác nhận đặt bàn";
}

function setSubmitLoading(loading) {
    const button = elements["submit-reservation"];

    button.disabled = loading;
    button.innerHTML = loading
        ? `<span class="material-symbols-outlined">progress_activity</span>
           <span>Đang gửi yêu cầu...</span>`
        : `<span class="material-symbols-outlined">event_available</span>
           <span>Gửi yêu cầu đặt bàn</span>`;
}

function hideNotice() {
    const box = elements["reservation-message"];
    box.hidden = true;
    box.textContent = "";
    box.className = "notice";
}

function showSuccessModal(data, reservationId = null) {
    elements["success-restaurant"].textContent = state.restaurantName;
    elements["success-date"].textContent = formatDate(data.date);
    elements["success-time"].textContent = data.time;
    elements["success-guests"].textContent = `${data.guestCount} người`;
    elements["success-customer-name"].textContent = data.customerName;
    elements["success-customer-phone"].textContent = data.customerPhone;
    elements["success-note"].textContent = data.note || "Không có";

    elements["success-code-row"].hidden = reservationId == null;

    if (reservationId != null) {
        elements["success-code"].textContent = String(reservationId);
    }

    elements["reservation-success-modal"].hidden = false;
    elements["reservation-success-modal"].setAttribute("aria-hidden", "false");
    document.body.classList.add("reservation-success-open");

    elements["close-reservation-success"].focus();
}

function closeSuccessModal() {
    elements["reservation-success-modal"].hidden = true;
    elements["reservation-success-modal"].setAttribute("aria-hidden", "true");
    document.body.classList.remove("reservation-success-open");
}

