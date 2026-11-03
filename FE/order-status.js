
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
    {
        code: "PREPARING",
        label: "Đang chuẩn bị món",
        description: "Nhà bếp đang chuẩn bị món ăn."
    },
    { code: "READY_FOR_DELIVERY", label: "Sẵn sàng giao", description: "Món ăn đã sẵn sàng và đang chờ đơn vị giao hàng." },
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
    READY_FOR_DELIVERY: ["Sẵn sàng giao", "Món ăn đã sẵn sàng và đang chờ giao."],
    DELIVERING: ["Đang giao", "Đơn hàng đang được vận chuyển đến bạn."],
    ARRIVED: ["Chờ xác nhận nhận hàng", "Đơn hàng đã đến địa chỉ nhận. Vui lòng xác nhận sau khi bạn nhận đủ món."],
    COMPLETED: ["Giao hàng thành công", "Đơn hàng đã được giao thành công."],
    CANCELLED: ["Đã hủy", "Đơn hàng đã bị hủy."]
};

const $ = (id) => document.getElementById(id);

let refreshTimer = null;
let isLoading = false;
let orderRefreshQueued = false;
let currentOrder = null;
let lastStatusCode = null;
let serverTimeOffset = 0;
let cancelPending = false;
let confirmReceivedPending = false;
let receiveModalPreviousFocus = null;
let receivePointerStartedOnOverlay = false;
let cancelModalPreviousFocus = null;
let cancelPointerStartedOnOverlay = false;
let cancelWindowTimer = null;
let refreshAccessTokenPromise = null;
let orderRealtimeConnection = null;
const pendingOrderEvents = new Map();

function mergeOrderEvent(order, event) {
    if (!order || !event || String(order.id) !== String(event.orderId)) return order;
    return {
        ...order,
        status: event.status ?? order.status,
        paymentStatus: event.paymentStatus ?? order.paymentStatus
    };
}

function markRealtimeUpdated() {
    $("lastUpdated").textContent =
        "Cập nhật realtime lúc " +
        new Intl.DateTimeFormat("vi-VN", {
            hour: "2-digit", minute: "2-digit", second: "2-digit"
        }).format(new Date());
}

function updateOrderListStatus(event) {
    const item = [...document.querySelectorAll("#orderList [data-order-id]")]
        .find(element => element.dataset.orderId === String(event.orderId));
    const status = item?.querySelector("span:last-child strong");
    const statusCode = normalizeStatus(event.status);
    if (status && statusCode) status.textContent = STATUS_TEXT[statusCode]?.[0] || statusCode;
}

async function refreshAccessToken() {
    if (refreshAccessTokenPromise) return refreshAccessTokenPromise;
    refreshAccessTokenPromise = (async () => {
        const refreshToken = localStorage.getItem("userRefreshToken");
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
            localStorage.removeItem("userAccessToken");
            localStorage.removeItem("userRefreshToken");
            window.location.replace("login.html");
            throw new Error(payload.message || "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
        localStorage.setItem("userAccessToken", data.accessToken);
        if (data.refreshToken) localStorage.setItem("userRefreshToken", data.refreshToken);
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
    let response = await send(localStorage.getItem("userAccessToken"));
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
    const cancellationDeadline = Date.parse(order.cancellationDeadline || "");
    const withinWindow = Number.isFinite(cancellationDeadline)
        && Date.now() + serverTimeOffset < cancellationDeadline;
    const canCancel = getOrderStatus(order) === "PENDING" && withinWindow;

    wrapper.hidden = !canCancel;
    button.disabled = cancelPending;
    hint.textContent = canCancel ? "Bạn có thể hủy trước khi thời hạn xác nhận kết thúc." : "";
    if (canCancel) {
        const remaining = cancellationDeadline - (Date.now() + serverTimeOffset);
        cancelWindowTimer = setTimeout(() => renderCancelAction(currentOrder || order), Math.max(0, remaining));
    }
}

function renderReceivedAction(order) {
    const wrapper = $("order-received-action");
    const button = $("confirm-received-btn");
    if (!wrapper || !button) return;

    const canConfirm = getOrderStatus(order) === "ARRIVED";
    wrapper.hidden = !canConfirm;
    button.disabled = confirmReceivedPending;
    button.textContent = confirmReceivedPending ? "Đang xác nhận..." : "Đã nhận hàng";
}

function setReceiveModalState(type, title, message) {
    const modal = $("receive-confirm-modal");
    const icon = $("receive-confirm-icon")?.querySelector(".material-symbols-outlined");
    const cancelButton = $("receive-confirm-cancel");
    const submitButton = $("receive-confirm-submit");
    if (!modal || !icon || !cancelButton || !submitButton) return;

    modal.classList.toggle("is-success", type === "success");
    modal.classList.toggle("is-error", type === "error");
    $("receive-confirm-title").textContent = title;
    $("receive-confirm-message").textContent = message;
    icon.textContent = type === "success" ? "check_circle" : type === "error" ? "error" : "inventory_2";
    cancelButton.textContent = type === "confirm" ? "Chưa, quay lại" : "Đóng";
    submitButton.hidden = type !== "confirm";
}

function openReceiveConfirmation() {
    if (confirmReceivedPending || !currentOrder?.id || getOrderStatus(currentOrder) !== "ARRIVED") return;
    const modal = $("receive-confirm-modal");
    if (!modal) return;

    receiveModalPreviousFocus = document.activeElement;
    setReceiveModalState(
        "confirm",
        "Xác nhận đã nhận hàng?",
        "Bạn xác nhận đã nhận đầy đủ hàng và hoàn tất đơn hàng này?"
    );
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("receive-modal-open");
    $("receive-confirm-cancel")?.focus();
}

function closeReceiveModal() {
    if (confirmReceivedPending) return;
    const modal = $("receive-confirm-modal");
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("receive-modal-open");
    receiveModalPreviousFocus?.focus?.();
    receiveModalPreviousFocus = null;
}

function setReceiveModalProcessing(processing) {
    const cancelButton = $("receive-confirm-cancel");
    const submitButton = $("receive-confirm-submit");
    if (cancelButton) cancelButton.disabled = processing;
    if (submitButton) {
        submitButton.disabled = processing;
        submitButton.textContent = processing ? "Đang xử lý..." : "Xác nhận đã nhận hàng";
    }
}

function showReceiveResult(success, message) {
    setReceiveModalState(
        success ? "success" : "error",
        success ? "Đã xác nhận nhận hàng" : "Không thể xác nhận",
        message
    );
    $("receive-confirm-cancel")?.focus();
}

async function confirmReceivedOrder() {
    if (confirmReceivedPending || !currentOrder?.id) return;

    confirmReceivedPending = true;
    setReceiveModalProcessing(true);
    renderReceivedAction(currentOrder);
    try {
        await request(`/api/v1/orders/${encodeURIComponent(currentOrder.id)}/confirm-received`, {
            method: "PATCH"
        });
        await fetchOrder(currentOrder.id);
        showReceiveResult(true, "Đơn hàng đã hoàn thành. Cảm ơn bạn đã xác nhận!");
    } catch (error) {
        await fetchOrder(currentOrder.id);
        showReceiveResult(false, error.message || "Không thể xác nhận đã nhận hàng.");
    } finally {
        confirmReceivedPending = false;
        setReceiveModalProcessing(false);
        if ($("receive-confirm-submit")?.hidden) $("receive-confirm-cancel")?.focus();
        if (currentOrder) renderReceivedAction(currentOrder);
    }
}

function openCancelConfirmation() {
    if (cancelPending || !currentOrder?.id) return;
    cancelModalPreviousFocus = document.activeElement;
    $("cancel-confirm-error").hidden = true;
    $("cancel-confirm-error").textContent = "";
    $("cancel-confirm-modal").hidden = false;
    $("cancel-confirm-modal").setAttribute("aria-hidden", "false");
    document.body.classList.add("receive-modal-open");
    $("cancel-confirm-keep").focus();
}

function closeCancelConfirmation() {
    if (cancelPending) return;
    $("cancel-confirm-modal").hidden = true;
    $("cancel-confirm-modal").setAttribute("aria-hidden", "true");
    document.body.classList.remove("receive-modal-open");
    cancelModalPreviousFocus?.focus?.();
    cancelModalPreviousFocus = null;
}

function setCancelModalProcessing(processing) {
    $("cancel-confirm-keep").disabled = processing;
    $("cancel-confirm-submit").disabled = processing;
    $("cancel-confirm-submit").textContent = processing ? "Đang hủy đơn..." : "Đồng ý hủy đơn";
}

async function cancelCurrentOrder() {
    if (cancelPending || !currentOrder?.id) return;
    cancelPending = true;
    setCancelModalProcessing(true);
    renderCancelAction(currentOrder);
    try {
        const updated = await request(`/api/v1/orders/${encodeURIComponent(currentOrder.id)}/cancel`, {
            method: "PATCH"
        });
        hideNotice();
        renderOrder(updated);
        cancelPending = false;
        setCancelModalProcessing(false);
        closeCancelConfirmation();
    } catch (error) {
        const message = error.message || "Không thể hủy đơn hàng.";
        $("cancel-confirm-error").textContent = message;
        $("cancel-confirm-error").hidden = false;
        await fetchOrder(currentOrder.id);
    } finally {
        cancelPending = false;
        setCancelModalProcessing(false);
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
    renderReceivedAction(order);

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
    orders.forEach((rawOrder) => {
        const order = mergeOrderEvent(rawOrder, pendingOrderEvents.get(String(rawOrder.id)));
        const button = document.createElement("button");
        button.type = "button";
        button.className = "order-list-item";
        button.dataset.orderId = String(order.id);
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
        orderRefreshQueued = true;
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
        const queuedEvent = pendingOrderEvents.get(String(order.id));
        if (queuedEvent) {
            order = mergeOrderEvent(order, queuedEvent);
            pendingOrderEvents.delete(String(order.id));
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
        if (orderRefreshQueued) {
            orderRefreshQueued = false;
            fetchOrder(requestedOrderId || currentOrder?.id);
        }
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

function initializeOrderRealtime() {
    if (orderRealtimeConnection || !window.FCA_ORDER_REALTIME) return;
    const token = localStorage.getItem("userAccessToken");
    const accountId = window.FCA_ORDER_REALTIME.accountIdFromToken(token || "");
    if (!accountId) return;

    orderRealtimeConnection = window.FCA_ORDER_REALTIME.connect({
        connectionKey: "user-order-status",
        apiOrigin: window.FCA_SHELL?.apiOrigin || "http://localhost:8080",
        getToken: () => localStorage.getItem("userAccessToken"),
        destinations: () => {
            const currentId = window.FCA_ORDER_REALTIME.accountIdFromToken(localStorage.getItem("userAccessToken") || "");
            return currentId ? [`/topic/accounts/${currentId}/orders`] : [];
        },
        onEvent: async event => {
            console.info("[User order realtime] Processing event", {
                type: event?.type,
                orderId: event?.orderId,
                status: event?.status
            });
            if (!event?.orderId) return;
            if (event?.accountId && String(event.accountId) !== accountId) return;
            const eventKey = String(event.orderId);
            pendingOrderEvents.set(eventKey, event);
            window.setTimeout(() => pendingOrderEvents.delete(eventKey), 300000);
            updateOrderListStatus(event);

            const visibleOrderId = getOrderIdFromUrl() || currentOrder?.id;
            if (visibleOrderId && eventKey === String(visibleOrderId)
                    && currentOrder && eventKey === String(currentOrder.id)) {
                currentOrder = mergeOrderEvent(currentOrder, event);
                pendingOrderEvents.delete(eventKey);
                renderOrder(currentOrder);
                markRealtimeUpdated();
            }
        },
        onConnected: reconnected => {
            if (reconnected) fetchOrder();
        },
        onAuthError: () => {
            localStorage.removeItem("userAccessToken");
            localStorage.removeItem("userRefreshToken");
            window.location.replace("login.html");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    $("refreshBtn").addEventListener("click", () => fetchOrder());
    $("cancel-order-btn")?.addEventListener("click", openCancelConfirmation);
    $("cancel-confirm-keep")?.addEventListener("click", closeCancelConfirmation);
    $("cancel-confirm-submit")?.addEventListener("click", cancelCurrentOrder);
    const cancelOverlay = $("cancel-confirm-overlay");
    cancelOverlay?.addEventListener("pointerdown", () => {
        cancelPointerStartedOnOverlay = true;
    });
    cancelOverlay?.addEventListener("pointerup", () => {
        if (cancelPointerStartedOnOverlay) closeCancelConfirmation();
        cancelPointerStartedOnOverlay = false;
    });
    cancelOverlay?.addEventListener("pointercancel", () => {
        cancelPointerStartedOnOverlay = false;
    });
    $("confirm-received-btn")?.addEventListener("click", openReceiveConfirmation);
    $("receive-confirm-submit")?.addEventListener("click", confirmReceivedOrder);
    $("receive-confirm-cancel")?.addEventListener("click", closeReceiveModal);
    const receiveOverlay = $("receive-confirm-overlay");
    receiveOverlay?.addEventListener("pointerdown", () => {
        receivePointerStartedOnOverlay = true;
    });
    receiveOverlay?.addEventListener("pointerup", () => {
        if (receivePointerStartedOnOverlay) closeReceiveModal();
        receivePointerStartedOnOverlay = false;
    });
    receiveOverlay?.addEventListener("pointercancel", () => {
        receivePointerStartedOnOverlay = false;
    });
    if (getOrderIdFromUrl()) loadOrders().catch((error) => showNotice(error.message, true));
    fetchOrder();
    initializeOrderRealtime();
});
