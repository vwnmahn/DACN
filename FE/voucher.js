
"use strict";

/* =========================
   CẤU HÌNH API SPRING BOOT
========================= */
const API_BASE_URL = "http://localhost:8080";
const VOUCHER_API_URL = `${API_BASE_URL}/api/v1/vouchers`;
const CATEGORY_API_VALUES = {
    all: null,
    freeship: "FREE_SHIP",
    dish: "DISH",
    vip: "VIP"
};
let selectedCategory = "all";
let currentAvailablePoints = 0;

/* =========================
   LẤY TOKEN ĐĂNG NHẬP
========================= */
function getAccessToken() {
    return localStorage.getItem("accessToken");
}

/* =========================
   TỰ ĐỘNG REFRESH TOKEN
========================= */

let refreshTokenPromise = null;

function getRefreshToken() {
    return localStorage.getItem("refreshToken");
}

function saveTokens(data) {
    if (!data?.accessToken) {
        throw new Error("API refresh không trả về accessToken.");
    }

    localStorage.setItem("accessToken", data.accessToken);

    // Backend trả refreshToken mới thì cập nhật luôn.
    if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
    }

    if (data.tokenType) {
        localStorage.setItem("tokenType", data.tokenType);
    }

    return data.accessToken;
}

async function refreshAccessToken() {
    // Tránh nhiều request cùng lúc refresh nhiều lần.
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }

    refreshTokenPromise = (async () => {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
            throw new Error("Không tìm thấy refreshToken.");
        }

        const response = await fetch(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ refreshToken })
            }
        );

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                result?.message || `Refresh token thất bại: HTTP ${response.status}`
            );
        }

        // Backend trả ApiResponse<RTResponse>:
        // { code, message, data: { accessToken, refreshToken, ... } }
        const data = result?.data;

        if (!data?.accessToken) {
            throw new Error("Response refresh không có data.accessToken.");
        }

        return saveTokens(data);
    })();

    try {
        return await refreshTokenPromise;
    } finally {
        refreshTokenPromise = null;
    }
}

async function fetchWithAuthRetry(url, options = {}) {
    const sendRequest = (token) => {
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");

        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        return fetch(url, {
            ...options,
            headers
        });
    };

    let token = getAccessToken();
    let response = await sendRequest(token);

    if (response.status !== 401) {
        return response;
    }

    try {
        token = await refreshAccessToken();
    } catch (error) {
        console.error("Không thể refresh token:", error);

        // Chỉ xóa token khi refresh thất bại.
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("tokenType");

        throw new Error(
            "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        );
    }

    // Thử lại request đúng một lần bằng AT mới.
    response = await sendRequest(token);

    return response;
}

/* =========================
   HIỂN THỊ THÔNG BÁO
========================= */
function showVoucherMessage(message, type = "info") {
    let messageElement = document.getElementById("voucher-message");

    if (!messageElement) {
        messageElement = document.createElement("div");
        messageElement.id = "voucher-message";
        messageElement.setAttribute("role", "status");

        const container =
            document.getElementById("voucher-cards-container") ||
            document.getElementById("voucher-list") ||
            document.getElementById("vouchers-container") ||
            document.querySelector(".voucher-list") ||
            document.querySelector("main") ||
            document.body;

        container.prepend(messageElement);
    }

    messageElement.textContent = message;
    messageElement.dataset.type = type;
}

/* =========================
   HIỂN THỊ DANH SÁCH VOUCHER
========================= */
function getVoucherContainer() {
    return (
        document.getElementById("voucher-cards-container") ||
        document.getElementById("voucher-list") ||
        document.getElementById("vouchers-container") ||
        document.querySelector(".voucher-list") ||
        document.querySelector(".vouchers-container")
    );
}

function formatVoucherValue(voucher) {
    const value =
        voucher.discountValue ??
        voucher.discountAmount ??
        voucher.value;

    if (value === undefined || value === null) {
        return "";
    }

    const type = String(
        voucher.discountType ??
        voucher.type ??
        ""
    ).toUpperCase();

    if (
        type.includes("PERCENT") ||
        type.includes("PERCENTAGE") ||
        type.includes("PERCENTAGE_DISCOUNT")
    ) {
        return `${value}%`;
    }

    if (typeof value === "number") {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND"
        }).format(value);
    }

    return String(value);
}

function formatVoucherDate(dateValue) {
    if (!dateValue) {
        return "Không có thông tin";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString("vi-VN");
}


function createVoucherElement(voucher) {
    const card = document.createElement("article");
    card.className = "voucher-card";

    const top = document.createElement("div");
    top.className = "voucher-card-top";

    const brand = document.createElement("div");
    brand.className = "voucher-brand";
    brand.textContent = "FCA CULINARY";

    const title = document.createElement("h3");
    title.className = "voucher-title";
    title.textContent =
        voucher.name ??
        voucher.voucherName ??
        voucher.code ??
        "Voucher";

    const codeRow = document.createElement("div");
    codeRow.className = "voucher-code-row";

    const codeLabel = document.createElement("span");
    codeLabel.className = "voucher-code-label";
    codeLabel.textContent = "MÃ ƯU ĐÃI";

    const code = document.createElement("p");
    code.className = "voucher-code";
    code.textContent =
        voucher.code ??
        voucher.voucherCode ??
        "Chưa có mã";

    codeRow.append(codeLabel, code);

    const discount = document.createElement("div");
    discount.className = "voucher-discount";
    discount.textContent =
        formatVoucherValue(voucher) || "Ưu đãi đặc biệt";

    const descriptionText =
        voucher.description ??
        voucher.content ??
        "";

    const description = document.createElement("p");
    description.className = "voucher-description";
    description.textContent = descriptionText;

    top.append(brand, title, codeRow, discount);

    if (descriptionText) {
        top.appendChild(description);
    }

    const divider = document.createElement("div");
    divider.className = "voucher-ticket-divider";
    divider.setAttribute("aria-hidden", "true");

    const dividerLine = document.createElement("span");
    dividerLine.className = "voucher-ticket-line";
    divider.appendChild(dividerLine);

    const bottom = document.createElement("div");
    bottom.className = "voucher-card-bottom";

    const dateInfo = document.createElement("div");
    dateInfo.className = "voucher-date-info";

    const startDate = document.createElement("p");
    startDate.className = "voucher-date";
    startDate.textContent =
        `Bắt đầu: ${formatVoucherDate(
            voucher.startDate ??
            voucher.validFrom ??
            voucher.startTime
        )}`;

    const endDate = document.createElement("p");
    endDate.className = "voucher-date";
    endDate.textContent =
        `Kết thúc: ${formatVoucherDate(
            voucher.endDate ??
            voucher.validTo ??
            voucher.expiryDate ??
            voucher.endTime
        )}`;

    dateInfo.append(startDate, endDate);

    const action = document.createElement("button");
    action.className = "voucher-action";
    action.type = "button";

    const customerStatus = String(voucher.customerStatus || "").toUpperCase();
    if (customerStatus === "AVAILABLE") {
        action.textContent = "Sử dụng";
        action.setAttribute("aria-label", "Sử dụng voucher và chuyển đến giỏ hàng");
        action.addEventListener("click", () => {
            window.location.href = "cart.html";
        });
    } else if (customerStatus === "USED") {
        action.textContent = "Đã sử dụng";
        action.disabled = true;
    } else if (customerStatus === "UNOWNED" && currentAvailablePoints >= 300) {
        action.textContent = "Đổi voucher";
        action.addEventListener("click", async () => {
            action.disabled = true;
            try {
                const response = await fetchWithAuthRetry(`${VOUCHER_API_URL}/${voucher.id}/redeem`, {
                    method: "POST"
                });
                const result = await response.json().catch(() => null);
                if (!response.ok) throw new Error(result?.message || `HTTP ${response.status}`);
                await loadVouchers();
            } catch (error) {
                action.disabled = false;
                showVoucherMessage(error.message || "Không thể đổi voucher.", "error");
            }
        });
    } else if (customerStatus === "UNOWNED") {
        action.textContent = "Chưa đủ điều kiện";
        action.disabled = true;
    } else {
        action.textContent = "Không khả dụng";
        action.disabled = true;
    }

    bottom.append(dateInfo, action);
    card.append(top, divider, bottom);

    return card;
}

function renderVouchers(vouchers) {
    const container = getVoucherContainer();

    if (!container) {
        console.error(
            "Không tìm thấy vùng hiển thị voucher. " +
            "Hãy kiểm tra ID/class trong HTML."
        );

        showVoucherMessage(
            "Không tìm thấy vùng hiển thị danh sách voucher.",
            "error"
        );
        return;
    }

    container.replaceChildren();

    if (!Array.isArray(vouchers) || vouchers.length === 0) {
        showVoucherMessage("Hiện chưa có voucher.", "info");
        return;
    }

    const fragment = document.createDocumentFragment();

    vouchers.forEach((voucher) => {
        fragment.appendChild(createVoucherElement(voucher));
    });

    container.appendChild(fragment);
}

/* =========================
   GỌI API LẤY VOUCHER
========================= */

async function loadVouchers() {
    if (!getAccessToken()) {
        showVoucherMessage(
            "Bạn chưa đăng nhập hoặc chưa lưu accessToken.",
            "error"
        );
        return;
    }

    const container = getVoucherContainer();

    if (container) {
        container.textContent = "Đang tải danh sách voucher...";
    }

    try {
        const accountResponse = await fetchWithAuthRetry(`${API_BASE_URL}/api/v1/auth/me`, {
            method: "GET"
        });
        const accountResult = await accountResponse.json().catch(() => null);
        if (!accountResponse.ok) {
            throw new Error(accountResult?.message || `HTTP ${accountResponse.status}`);
        }
        currentAvailablePoints = Number(accountResult?.data?.availablePoints) || 0;

        const url = new URL(VOUCHER_API_URL);
        const category = CATEGORY_API_VALUES[selectedCategory];

        if (category) {
            url.searchParams.set("category", category);
        }

        const response = await fetchWithAuthRetry(url.toString(), {
            method: "GET"
        });

        const responseText = await response.text();
        let result = null;

        if (responseText) {
            try {
                result = JSON.parse(responseText);
            } catch {
                result = responseText;
            }
        }

        if (response.status === 401) {
            showVoucherMessage(
                "Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.",
                "error"
            );
            console.error("API voucher vẫn trả 401 sau refresh:", result);
            return;
        }

        if (response.status === 403) {
            showVoucherMessage(
                "Tài khoản không có quyền truy cập danh sách voucher.",
                "error"
            );
            console.error("API voucher trả 403:", result);
            return;
        }

        if (!response.ok) {
            const detail =
                typeof result === "string"
                    ? result
                    : result?.message ??
                      result?.error ??
                      `HTTP ${response.status}`;

            showVoucherMessage(
                `Không thể tải voucher: ${detail}`,
                "error"
            );

            console.error("Lỗi API voucher:", response.status, result);
            return;
        }

        let vouchers;

        if (Array.isArray(result)) {
            vouchers = result;
        } else if (Array.isArray(result?.data)) {
            vouchers = result.data;
        } else if (Array.isArray(result?.content)) {
            vouchers = result.content;
        } else if (Array.isArray(result?.data?.content)) {
            vouchers = result.data.content;
        } else {
            console.error("Cấu trúc response voucher:", result);

            showVoucherMessage(
                "Cấu trúc dữ liệu voucher chưa được nhận diện. " +
                "Hãy kiểm tra response trong Network.",
                "error"
            );
            return;
        }

        renderVouchers(vouchers);

    } catch (error) {
        console.error("Lỗi tải voucher:", error);

        showVoucherMessage(
            error.message || "Không thể kết nối đến backend.",
            "error"
        );
    }
}

/* =========================
   KHỞI TẠO
========================= */
document.addEventListener("DOMContentLoaded", () => {
    loadVouchers();

    document.getElementById("category-tabs")?.addEventListener("click", (event) => {
        const button = event.target.closest(".category-btn");
        if (!button || !(button.dataset.category in CATEGORY_API_VALUES)) return;
        if (button.dataset.category === selectedCategory) return;

        document.querySelector("#category-tabs .category-btn.active")
            ?.classList.remove("active");
        button.classList.add("active");
        selectedCategory = button.dataset.category;
        loadVouchers();
    });

    const reloadButton =
        document.getElementById("reload-vouchers") ||
        document.getElementById("refresh-vouchers");

    if (reloadButton) {
        reloadButton.addEventListener("click", loadVouchers);
    }
});
