
"use strict";

/*
 * CẤU HÌNH API
 *
 * Thay ORDER_API_URL bằng endpoint GET chi tiết đơn hàng đang có
 * trong Spring Boot của dự án.
 *
 * Ví dụ dạng URL:
 * /api/v1/orders/{id}
 *
 * Không để nguyên URL ví dụ nếu backend không có endpoint đó.
 */
const REFRESH_INTERVAL = 10000;

const STATUS_FLOW = [
    {
        code: "PENDING",
        label: "Chờ xác nhận",
        description: "Đơn hàng đang chờ nhà hàng xác nhận."
    },
    { code: "AWAITING_PAYMENT", label: "Chờ thanh toán", description: "Đơn hàng đang chờ thanh toán được xác minh." },
    {
        code: "CONFIRMED",
        label: "Đã xác nhận",
        description: "Nhà hàng đã xác nhận đơn hàng của bạn."
    },
    { code: "READY_FOR_DELIVERY", label: "Đã chuẩn bị xong, chờ giao", description: "Món ăn đã sẵn sàng và đang chờ đơn vị giao hàng." },
    {
        code: "PREPARING",
        label: "Đang chuẩn bị món",
        description: "Nhà bếp đang chuẩn bị món ăn."
    },
    {
        code: "DELIVERING",
        label: "Đang giao",
        description: "Đơn hàng đang được vận chuyển đến bạn."
    },
    {
        code: "ARRIVED",
        label: "Đã đến nơi",
        description: "Đơn hàng đã đến địa chỉ nhận."
    },
    {
        code: "COMPLETED",
        label: "Giao hàng thành công",
        description: "Đơn hàng đã được giao thành công."
    }
];

/*
 * Chỉ thêm alias cho những giá trị backend thực sự sử dụng.
 * Điều chỉnh các alias này theo enum/status trong Java.
 */
const STATUS_ALIASES = {
    WAITING_CONFIRMATION: "PENDING",
    WAITING_FOR_CONFIRMATION: "PENDING",

    CONFIRM: "CONFIRMED",
    ACCEPTED: "CONFIRMED",

    PREPARING_FOOD: "PREPARING",
    PROCESSING: "PREPARING",

    SHIPPING: "DELIVERING",
    IN_TRANSIT: "DELIVERING",

    ARRIVED_AT_DESTINATION: "ARRIVED",

    SUCCESS: "COMPLETED"
};

const STATUS_TEXT = {
    PENDING: ["Chờ xác nhận", "Đơn hàng đang chờ nhà hàng xác nhận."],
    AWAITING_PAYMENT: ["Chờ thanh toán", "Đơn hàng đang chờ thanh toán được xác minh."],
    CONFIRMED: ["Đã xác nhận", "Nhà hàng đã xác nhận đơn hàng của bạn."],
    PREPARING: ["Đang chuẩn bị món", "Nhà bếp đang chuẩn bị món ăn."],
    READY_FOR_DELIVERY: ["Đã chuẩn bị xong, chờ giao", "Món ăn đã sẵn sàng và đang chờ giao."],
    DELIVERING: ["Đang giao", "Đơn hàng đang được vận chuyển đến bạn."],
    ARRIVED: ["Đã đến nơi", "Đơn hàng đã đến địa chỉ nhận."],
    COMPLETED: ["Giao hàng thành công", "Đơn hàng đã được giao thành công."],
    CANCELLED: ["Đã hủy", "Đơn hàng đã bị hủy."]
};

const $ = (id) => document.getElementById(id);

let refreshTimer = null;
let isLoading = false;
let currentOrder = null;
let lastStatusCode = null;
let serverTimeOffset = 0;
let cancelPending = false;
let cancelWindowTimer = null;
let refreshAccessTokenPromise = null;

async function refreshAccessToken() {
    if (refreshAccessTokenPromise) return refreshAccessTokenPromise;
    refreshAccessTokenPromise = (async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        const origin = window.FCA_SHELL?.apiOrigin;
        if (!origin) throw new Error("Không xác định được cấu hình API dùng chung.");
        const response = await fetch(`${origin}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken })
        });
        const payload = await response.json().catch(() => ({}));
        const data = payload.data ?? payload;
        if (!response.ok || !data?.accessToken) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            window.location.replace("login.html");
            throw new Error(payload.message || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
        localStorage.setItem("accessToken", data.accessToken);
        if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
        return data.accessToken;
    })();
    try { return await refreshAccessTokenPromise; }
    finally { refreshAccessTokenPromise = null; }
}

async function request(path, options = {}) {
    const origin = window.FCA_SHELL?.apiOrigin;
    if (!origin) throw new Error("Không xác định được cấu hình API dùng chung.");
    const send = (token) => fetch(`${origin}${path}`, {
        ...options,
        headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: "no-store"
    });
    let response = await send(localStorage.getItem("accessToken"));
    if (response.status === 401) response = await send(await refreshAccessToken());
    const serverDate = Date.parse(response.headers.get("Date") || "");
    if (Number.isFinite(serverDate)) serverTimeOffset = serverDate - Date.now();
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Không thể tải dữ liệu (HTTP ${response.status}).`);
    return payload.data ?? payload;
}

function renderCancelAction(order) {
    const wrapper = $("order-cancel-action");
    const button = $("cancel-order-btn");
    const hint = $("cancel-order-hint");
    if (!wrapper || !button || !hint) return;

    if (cancelWindowTimer) {
        clearTimeout(cancelWindowTimer);
        cancelWindowTimer = null;
    }
    const createdAt = Date.parse(order.createdAt || "");
    const manualOrder = Boolean(order.confirmationDeadline);
    const withinWindow = Number.isFinite(createdAt)
        && Date.now() + serverTimeOffset < createdAt + 15000;
    const canCancel = getOrderStatus(order) === "PENDING" && manualOrder && withinWindow;

    wrapper.hidden = !canCancel;
    button.disabled = cancelPending;
    hint.textContent = canCancel ? "Có thể hủy trong 15 giây đầu sau khi tạo đơn." : "";
    if (canCancel) {
        const remaining = createdAt + 15000 - (Date.now() + serverTimeOffset);
        cancelWindowTimer = setTimeout(() => renderCancelAction(currentOrder || order), Math.max(0, remaining));
    }
}

async function cancelCurrentOrder() {
    if (cancelPending || !currentOrder?.id) return;
    if (!window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;
    cancelPending = true;
    renderCancelAction(currentOrder);
    try {
        const updated = await request(`/api/v1/orders/${encodeURIComponent(currentOrder.id)}/cancel`, {
            method: "PATCH"
        });
        hideNotice();
        renderOrder(updated);
    } catch (error) {
        showNotice(error.message || "Không thể hủy đơn hàng.", true);
        await fetchOrder(currentOrder.id);
    } finally {
        cancelPending = false;
        if (currentOrder) renderCancelAction(currentOrder);
    }
}

function getOrderIdFromUrl() {
    const params = new URLSearchParams(window.location.search);

    /*
     * URL hỗ trợ:
     * order-status.html?id=123
     * order-status.html?orderId=123
     *
     * ID phải là ID thật của đơn hàng trong hệ thống.
     */
    return params.get("orderId") || params.get("id");
}

function normalizeStatus(rawStatus) {
    if (rawStatus === null || rawStatus === undefined) {
        return "";
    }

    const value = String(rawStatus)
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s-]+/g, "_");

    return STATUS_ALIASES[value] || value;
}

function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "--";
    }

    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0
    }).format(amount);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatDate(value) {
    if (!value) {
        return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function showNotice(message, isError = false) {
    const notice = $("notice");

    notice.textContent = message;
    notice.hidden = false;
    notice.classList.toggle("error", isError);
}

function hideNotice() {
    $("notice").hidden = true;
    $("notice").textContent = "";
    $("notice").classList.remove("error");
}

function getOrderStatus(order) {
    /*
     * Điều chỉnh các tên trường này nếu DTO backend dùng tên khác.
     * Ưu tiên trường trạng thái đơn hàng, không dùng paymentStatus
     * thay cho trạng thái giao hàng.
     */
    const rawStatus =
        order.orderStatus ??
        order.status ??
        order.order_status;

    return normalizeStatus(rawStatus);
}

function getPaymentLabel(order) {
    const status = normalizeStatus(
        order.paymentStatus ?? order.payment_status ?? ""
    );

    const labels = {
        PAID: "Đã thanh toán",
        SUCCESS: "Đã thanh toán",
        COMPLETED: "Đã thanh toán",
        UNPAID: "Chưa thanh toán",
        PENDING: "Chờ thanh toán",
        FAILED: "Thanh toán thất bại",
        CANCELLED: "Đã hủy thanh toán",
        REFUNDED: "Đã hoàn tiền",
        SIMULATED_PAID: "Đã thanh toán mô phỏng (DEV)"
    };

    return labels[status] || status || "Chưa có dữ liệu";
}

function renderStatus(statusCode) {
    const index = STATUS_FLOW.findIndex(
        (step) => step.code === statusCode
    );

    const currentIndex = index >= 0 ? index : -1;
    const currentStep = STATUS_FLOW[currentIndex];

    const badge = $("currentStatus");
    const description = $("statusDescription");

    if (!currentStep) {
        const statusText = STATUS_TEXT[statusCode];
        badge.textContent = statusText?.[0] || statusCode || "Chưa xác định";
        badge.className = "status-badge";
        description.textContent = statusText?.[1] || "Trạng thái đơn hàng chưa được xác định.";
    } else {
        badge.textContent = currentStep.label;
        badge.className = "status-badge";

        if (statusCode === "COMPLETED") {
            badge.classList.add("status-success");
        }

        description.textContent = currentStep.description;
    }

    document.querySelectorAll(".tracking-step").forEach((element, i) => {
        element.classList.remove("completed", "active", "pending");

        if (currentIndex < 0) {
            element.classList.add("pending");
            return;
        }

        if (i < currentIndex) {
            element.classList.add("completed");
        } else if (i === currentIndex) {
            element.classList.add("active");
        } else {
            element.classList.add("pending");
        }

        const icon = element.querySelector(".step-icon .material-symbols-outlined");

        if (icon && i < currentIndex) {
            icon.textContent = "check";
        } else if (icon) {
            const icons = ["schedule", "payments", "verified", "skillet", "takeout_dining", "delivery_dining", "location_on", "check_circle"];

            icon.textContent = icons[i];
        }
    });

    if (statusCode !== lastStatusCode && currentStep) {
        $("lastUpdated").textContent =
            "Trạng thái hiện tại: " + currentStep.label +
            ". Cập nhật lúc " +
            new Intl.DateTimeFormat("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }).format(new Date());

        lastStatusCode = statusCode;
    }
}

function renderItems(items) {
    const container = $("orderItems");
    container.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Đơn hàng chưa có dữ liệu món ăn.";
        container.appendChild(empty);
        $("itemCount").textContent = "0 món";
        return;
    }

    let totalQuantity = 0;

    items.forEach((item) => {
        const name =
            item.itemName ??
            item.productName ??
            item.name ??
            item.foodName ??
            item.product?.name ??
            "Sản phẩm";

        const quantity = Number(item.quantity ?? item.qty ?? 1);
        const unitPrice = Number(
            item.unitPrice ??
            item.price ??
            item.product?.price ??
            0
        );

        const lineTotal = Number(
            item.subtotal ??
            item.totalPrice ??
            item.lineTotal ??
            unitPrice * quantity
        );

        totalQuantity += quantity;

        const row = document.createElement("div");
        row.className = "order-item";

        const info = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent = String(name);

        const detail = document.createElement("p");
        detail.textContent =
            "Số lượng: " + quantity +
            " × " + formatMoney(unitPrice);

        const price = document.createElement("strong");
        price.className = "order-item-price";
        price.textContent = formatMoney(lineTotal);

        info.append(title, detail);
        row.append(info, price);
        container.appendChild(row);
    });

    $("itemCount").textContent = totalQuantity + " phần";
}

function renderOrder(order) {
    currentOrder = order;
    renderCancelAction(order);

    const orderId =
        order.orderCode ??
        order.code ??
        order.orderNumber ??
        order.id ??
        getOrderIdFromUrl();

    $("orderCode").textContent =
        orderId ? "#" + orderId : "Chưa có mã đơn";

    $("orderDate").textContent = formatDate(
        order.createdAt ??
        order.orderDate ??
        order.createdDate
    );
    $("restaurantName").textContent = order.restaurantName || "--";

    $("paymentMethod").textContent =
        ({ COD: "Thanh toán khi nhận hàng (COD)", VNPAY: "VNPay" }[order.paymentMethod] || order.paymentMethod) ??
        order.paymentType ??
        "Chưa có dữ liệu";

    $("paymentStatus").textContent = getPaymentLabel(order);

    const total =
        order.totalAmount ??
        order.totalPrice ??
        order.total ??
        order.finalAmount;

    $("orderTotal").textContent = formatMoney(total);
    $("summaryTotal").textContent = formatMoney(total);

    $("subtotal").textContent = formatMoney(
        order.subtotal ?? order.subTotal
    );

    $("shippingFee").textContent = formatMoney(
        order.shippingFee ?? order.deliveryFee
    );

    $("discount").textContent = formatMoney(
        order.discountAmount ?? order.discount
    );

    $("customerName").textContent =
        order.recipientName ??
        order.receiverName ??
        order.customerName ??
        order.fullName ??
        "--";

    $("customerPhone").textContent =
        order.recipientPhone ??
        order.receiverPhone ??
        order.phoneNumber ??
        order.phone ??
        "--";

    $("deliveryAddress").textContent =
        order.deliveryAddress ??
        order.shippingAddress ??
        order.address ??
        "--";

    $("orderNote").textContent =
        order.deliveryNote ?? order.note ?? order.orderNote ?? "Không có ghi chú";

    renderStatus(getOrderStatus(order));

    renderItems(
        order.items ??
        order.orderItems ??
        order.details ??
        []
    );
}

function renderOrderList(orders) {
    const container = $("orderList");
    container.replaceChildren();
    if (!orders.length) {
        container.innerHTML = '<p class="empty-state">Bạn chưa có đơn hàng nào.</p>';
        return;
    }
    orders.forEach((order) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "order-list-item";
        const statusCode = getOrderStatus(order);
        const statusLabel = STATUS_TEXT[statusCode]?.[0] || statusCode;
        button.innerHTML = `<span><strong>#${escapeHtml(order.id)}</strong><small>${escapeHtml(order.restaurantName || "Quán ăn FCA")}</small></span><span><strong>${escapeHtml(statusLabel)}</strong><small>${formatMoney(order.totalAmount)}</small></span>`;
        button.addEventListener("click", () => {
            history.replaceState(null, "", `order-status.html?orderId=${encodeURIComponent(order.id)}`);
            fetchOrder(order.id);
        });
        container.appendChild(button);
    });
}

async function loadOrders() {
    const orders = await request("/api/v1/orders");
    const list = Array.isArray(orders) ? orders : [];
    renderOrderList(list);
    return list;
}

async function fetchOrder(requestedOrderId) {
    if (isLoading) {
        return;
    }

    const orderId = requestedOrderId || getOrderIdFromUrl() || currentOrder?.id;

    isLoading = true;

    const refreshBtn = $("refreshBtn");
    const refreshIcon = $("refreshIcon");

    refreshBtn.disabled = true;
    refreshIcon.classList.add("spin");

    try {
        let order;
        if (orderId) {
            order = await request(`/api/v1/orders/${encodeURIComponent(orderId)}`);
        } else {
            const orders = await loadOrders();
            order = orders[0];
            if (!order) {
                $("orderCode").textContent = "Chưa có đơn hàng";
                $("orderItems").innerHTML = '<p class="empty-state">Bạn chưa có đơn hàng nào.</p>';
                hideNotice();
                return;
            }
        }

        if (!order || typeof order !== "object") {
            throw new Error("Dữ liệu đơn hàng trả về không hợp lệ.");
        }

        try {
            const payment = await request(`/api/v1/payments/${encodeURIComponent(order.id)}/status`);
            order.paymentMethod = payment.paymentMethod;
            order.paymentStatus = payment.paymentStatus;
        } catch (paymentError) {
            order.paymentStatus = order.paymentStatus || "";
        }
        hideNotice();
        renderOrder(order);

        $("lastUpdated").textContent =
            "Đã đồng bộ với máy chủ lúc " +
            new Intl.DateTimeFormat("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }).format(new Date());

    } catch (error) {
        showNotice(
            error.message || "Đã xảy ra lỗi khi tải trạng thái đơn hàng.",
            true
        );
    } finally {
        isLoading = false;
        refreshBtn.disabled = false;
        refreshIcon.classList.remove("spin");
    }
}

function startAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
        /*
         * Không tự gọi lại sau khi đơn hoàn tất.
         */
        if (lastStatusCode === "COMPLETED" || lastStatusCode === "CANCELLED") {
            clearInterval(refreshTimer);
            refreshTimer = null;
            return;
        }

        fetchOrder();
    }, REFRESH_INTERVAL);
}

document.addEventListener("DOMContentLoaded", () => {
    $("refreshBtn").addEventListener("click", () => fetchOrder());
    $("cancel-order-btn")?.addEventListener("click", cancelCurrentOrder);
    if (getOrderIdFromUrl()) loadOrders().catch((error) => showNotice(error.message, true));
    fetchOrder();
    startAutoRefresh();
});
