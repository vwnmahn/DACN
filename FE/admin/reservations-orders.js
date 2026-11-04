"use strict";

/*
|--------------------------------------------------------------------------
| FCA CULINARY - RESERVATIONS & ORDERS
|--------------------------------------------------------------------------
| Backend: Spring Boot
| API_BASE: http://localhost:8080/api/v1
|
| Tích hợp theo AdminOrderController và AdminTableReservationController.
|--------------------------------------------------------------------------
*/

const API_BASE = "http://localhost:8080/api/v1";

/* ================= CẤU HÌNH API ================= */
const API_ENDPOINTS = {
    reservations: "/admin/table-reservations",
    reservationDetail: "/admin/table-reservations/{id}",
    reservationStatus: "/admin/table-reservations/{id}/status",

    orders: "/admin/orders",
    orderDetail: "/admin/orders/{id}",
    assignShipper: "/admin/orders/{id}/shipper",
    restaurantEmployees: "/admin/restaurants/{restaurantId}/employees",
    revenueReport: "/admin/reports/revenue"
};

/*
 * Cấu hình phân trang.
 */
const PAGE_SIZE = 10;

/*
 * Key lưu JWT trong localStorage.
 * Nếu phần đăng nhập đang sử dụng key khác,
 * hãy thay đổi TOKEN_STORAGE_KEY cho đúng.
 */
const TOKEN_STORAGE_KEY = "adminAccessToken";
let orderRealtimeConnection = null;
let orderDetailRequestSequence = 0;
let orderDetailRefreshTimer = null;
let pendingCancelOrder = null;

/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

const state = {
    activeTab: "reservations",

    reservations: [],
    allReservations: [],
    orders: [],

    reservationPage: 1,
    orderPage: 1,

    reservationTotal: 0,
    orderTotal: 0,

    reservationFilters: {
        keyword: "",
        restaurant: "",
        status: "",
        date: ""
    },

    orderFilters: {
        keyword: "",
        restaurant: "",
        status: ""
    },

    loadingReservations: false,
    loadingOrders: false,
    orderReloadQueued: false,
    latestOrderEvents: new Map()
};

/*
|--------------------------------------------------------------------------
| DOM HELPERS
|--------------------------------------------------------------------------
*/

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(number);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    /*
     * Tránh lỗi lệch ngày khi backend trả về YYYY-MM-DD.
     */
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));

    const date = dateOnly
        ? new Date(`${value}T00:00:00`)
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("vi-VN").format(date);
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function formatTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function getInitial(name) {
    if (!name) {
        return "?";
    }

    return String(name).trim().charAt(0).toUpperCase();
}

function getAccessToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/*
|--------------------------------------------------------------------------
| API RESPONSE
|--------------------------------------------------------------------------
*/

async function apiRequest(endpoint, options = {}) {
    if (!endpoint) {
        throw new Error("API endpoint chưa được cấu hình.");
    }

    const token = getAccessToken();

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";

    let responseData = null;

    if (contentType.includes("application/json")) {
        responseData = await response.json();
    } else {
        responseData = await response.text();
    }

    if (!response.ok) {
        const message =
            responseData?.message ||
            responseData?.error ||
            `Yêu cầu thất bại. HTTP ${response.status}`;

        throw new Error(message);
    }

    if (responseData && typeof responseData === "object"
        && responseData.code !== undefined && responseData.code !== 1000) {
        throw new Error(responseData.message || "Backend không xử lý được yêu cầu.");
    }

    return responseData;
}

/*
|--------------------------------------------------------------------------
| RESPONSE MAPPING
|--------------------------------------------------------------------------
| Hỗ trợ một số cấu trúc response phổ biến.
| Nếu ApiResponse của dự án có cấu trúc khác, chỉnh tại đây.
|--------------------------------------------------------------------------
*/

function extractData(response) {
    if (response === null || response === undefined) {
        return null;
    }

    if (typeof response !== "object") {
        return response;
    }

    if (response.data !== undefined) {
        return response.data;
    }

    return response;
}

function extractList(response) {
    const data = extractData(response);

    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.content)) {
        return data.content;
    }

    return [];
}

function extractTotal(response, list) {
    const data = extractData(response);

    const total =
        data?.totalElements;

    if (total !== undefined && Number.isFinite(Number(total))) {
        return Number(total);
    }

    return list.length;
}

/*
|--------------------------------------------------------------------------
| TOAST
|--------------------------------------------------------------------------
*/

function showToast(message, type = "info") {
    const container = getElement("toastContainer");

    if (!container) {
        return;
    }

    const toast = document.createElement("div");

    toast.className = `toast ${type}`;

    let icon = "fa-circle-info";

    if (type === "success") {
        icon = "fa-circle-check";
    } else if (type === "error") {
        icon = "fa-circle-exclamation";
    }

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3500);
}

/*
|--------------------------------------------------------------------------
| TABLE STATES
|--------------------------------------------------------------------------
*/

function renderEmptyState(message = "Chưa có dữ liệu") {
    return `
        <tr>
            <td colspan="20" class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <strong>${escapeHtml(message)}</strong>
                <span>Dữ liệu sẽ hiển thị khi API trả về kết quả.</span>
            </td>
        </tr>
    `;
}

function renderLoadingState() {
    return `
        <tr>
            <td colspan="20" class="empty-state">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <strong>Đang tải dữ liệu...</strong>
            </td>
        </tr>
    `;
}

function renderErrorState(message) {
    return `
        <tr>
            <td colspan="20" class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <strong>Không thể tải dữ liệu</strong>
                <span>${escapeHtml(message)}</span>
            </td>
        </tr>
    `;
}

/*
|--------------------------------------------------------------------------
| STATUS
|--------------------------------------------------------------------------
*/

const STATUS_CONFIG = {
    PENDING: {
        label: "Chờ xác nhận",
        className: "status-pending"
    },

    CONFIRMED: {
        label: "Đã xác nhận",
        className: "status-confirmed"
    },

    AWAITING_PAYMENT: {
        label: "Chờ thanh toán",
        className: "status-pending"
    },

    PREPARING: {
        label: "Đang chuẩn bị",
        className: "status-preparing"
    },

    READY_FOR_DELIVERY: {
        label: "Sẵn sàng giao",
        className: "status-confirmed"
    },

    DELIVERING: {
        label: "Đang giao",
        className: "status-preparing"
    },

    ARRIVED: {
        label: "Chờ khách xác nhận",
        className: "status-confirmed"
    },

    COMPLETED: {
        label: "Hoàn thành",
        className: "status-completed"
    },

    CANCELLED: {
        label: "Đã hủy",
        className: "status-cancelled"
    },

    NO_SHOW: {
        label: "Khách không đến",
        className: "status-cancelled"
    },

    PAID: {
        label: "Đã thanh toán",
        className: "status-paid"
    },

    UNPAID: {
        label: "Chưa thanh toán",
        className: "status-unpaid"
    },

    REFUNDED: {
        label: "Đã hoàn tiền",
        className: "status-refunded"
    }
};

function renderStatus(status) {
    if (!status) {
        return "—";
    }

    const normalized = String(status).toUpperCase();
    const config = STATUS_CONFIG[normalized];

    if (!config) {
        return `<span>${escapeHtml(status)}</span>`;
    }

    return `
        <span class="status-badge ${config.className}">
            ${escapeHtml(config.label)}
        </span>
    `;
}

function renderPaymentStatus(status) {
    const normalized = String(status || "").toUpperCase();
    const config = {
        PENDING: ["Chưa thanh toán", "status-unpaid"],
        SUCCESS: ["Đã thanh toán", "status-paid"],
        FAILED: ["Thanh toán thất bại", "status-cancelled"],
        CANCELLED: ["Đã hủy", "status-cancelled"],
        REFUNDED: ["Đã hoàn tiền", "status-refunded"],
        NEEDS_RECONCILIATION: ["Cần đối soát", "status-pending"]
    }[normalized];

    if (!config) return `<span>${escapeHtml(status || "—")}</span>`;
    return `<span class="status-badge ${config[1]}">${escapeHtml(config[0])}</span>`;
}

function paymentMethodLabel(method) {
    return ({ COD: "COD", VNPAY: "VNPay" })[method] || method || "—";
}

/*
|--------------------------------------------------------------------------
| DATA MAPPING
|--------------------------------------------------------------------------
| Mapping dưới đây chỉ là lớp chuyển đổi dữ liệu giao diện.
| Cần đối chiếu tên field với DTO thực tế của backend.
|--------------------------------------------------------------------------
*/

function mapReservation(item) {
    return {
        id: item.reservationId,
        code: item.reservationId,
        customerName: item.customerName,
        phone: item.customerPhone,
        date: item.startTime,
        time: item.startTime,
        guestCount: item.guestCount,
        status: item.status,

        note: item.note,
        restaurantName: item.restaurantName,
        tableNumber: item.tableNumber,
        endTime: item.endTime
    };
}

function renderReservationStatus(status) {
    if (status === "PENDING") {
        return '<span class="status-badge status-pending">Chưa xác nhận (dữ liệu cũ)</span>';
    }
    return renderStatus(status);
}

function mapOrder(item) {
    const order = item.order || {};

    return {
        id: order.id,
        code: order.id,
        customerName: item.username,
        customerPhone: item.phoneNumber,
        customerEmail: item.email,
        createdAt: order.createdAt,
        estimatedDeliveryAt: order.estimatedDeliveryAt,
        deliveryDistanceKm: order.deliveryDistanceKm,
        deliveryOverdue: order.deliveryOverdue,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        totalAmount: order.totalAmount,
        status: order.status,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        shipperId: order.shipperId,
        shipperName: order.shipperName,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        items: order.items || [],
        cancellationCode: order.cancellationCode,
        cancellationDetail: order.cancellationDetail
    };
}

function orderEventTime(event) {
    const value = Date.parse(event?.changedAt || "");
    return Number.isFinite(value) ? value : Date.now();
}

function rememberOrderEvent(event) {
    const id = String(event.orderId);
    const previous = state.latestOrderEvents.get(id);
    if (previous && orderEventTime(previous) > orderEventTime(event)) return false;
    state.latestOrderEvents.set(id, event);
    return true;
}

function applyOrderEvent(item, event) {
    if (!item || !event || String(item.order?.id) !== String(event.orderId)) return item;
    return {
        ...item,
        order: {
            ...item.order,
            status: event.status || item.order.status
        },
        paymentStatus: event.paymentStatus || item.paymentStatus
    };
}

function reconcileOrderEvents(items) {
    return items.map(item => {
        const event = state.latestOrderEvents.get(String(item?.order?.id));
        return event ? applyOrderEvent(item, event) : item;
    });
}

function orderMatchesCurrentFilters(rawItem) {
    const item = mapOrder(rawItem);
    const keyword = state.orderFilters.keyword.toLowerCase();
    const matchesKeyword = !keyword || (/^\d+$/.test(keyword)
        ? String(item.id) === keyword
        : [item.customerName, item.customerPhone, item.customerEmail]
            .some(value => String(value || "").toLowerCase().includes(keyword)));
    const matchesStatus = !state.orderFilters.status || item.status === state.orderFilters.status;
    const matchesRestaurant = !state.orderFilters.restaurant
        || String(item.restaurantName || "").toLowerCase()
            .includes(state.orderFilters.restaurant.toLowerCase());
    return matchesKeyword && matchesStatus && matchesRestaurant;
}

function updateVisibleOrderFromEvent(event) {
    const index = state.orders.findIndex(item =>
        String(item?.order?.id) === String(event.orderId));
    if (index < 0) return false;

    const updated = applyOrderEvent(state.orders[index], event);
    if (orderMatchesCurrentFilters(updated)) {
        state.orders[index] = updated;
    } else {
        state.orders.splice(index, 1);
        state.orderTotal = Math.max(0, state.orderTotal - 1);
    }
    renderOrderTable();
    updateOrderPagination();
    return true;
}

async function addOrderFromEvent(event) {
    if (state.activeTab !== "orders" || state.orderPage !== 1) return false;
    if (state.orders.some(item => String(item?.order?.id) === String(event.orderId))) return true;
    const isNewOrder = event.type === "CREATED";
    const movedIntoStatusFilter = state.orderFilters.status
        && state.orderFilters.status === event.status;
    if (!isNewOrder && !movedIntoStatusFilter) return false;

    try {
        const endpoint = API_ENDPOINTS.orderDetail.replace("{id}", encodeURIComponent(event.orderId));
        const item = applyOrderEvent(extractData(await apiRequest(endpoint)), event);
        if (!item || !orderMatchesCurrentFilters(item)) return false;
        state.orders.unshift(item);
        state.orders = state.orders.slice(0, PAGE_SIZE);
        state.orderTotal += 1;
        renderOrderTable();
        updateOrderPagination();
        console.info("[Admin order realtime] CREATED inserted", {
            orderId: event.orderId
        });
        return true;
    } catch (error) {
        console.error("Load order realtime error:", error);
        showToast(error.message, "error");
        if (event.type === "CREATED" && state.activeTab === "orders") {
            console.info("[Admin order realtime] Falling back to list reload", {
                orderId: event.orderId
            });
            await loadOrders();
        }
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| RESERVATION TABLE
|--------------------------------------------------------------------------
*/

function renderReservationTable() {
    const tbody = getElement("reservationTableBody");

    if (!tbody) {
        return;
    }

    if (!state.reservations.length) {
        tbody.innerHTML = renderEmptyState("Không có dữ liệu đặt bàn.");
        return;
    }

    tbody.innerHTML = state.reservations.map((rawItem) => {
        const item = mapReservation(rawItem);

        return `
            <tr>
                <td>
                    <span class="table-code">
                        ${escapeHtml(item.code ?? "—")}
                    </span>
                </td>

                <td>
                    <div class="customer-cell">
                        <div class="customer-avatar">
                            ${escapeHtml(getInitial(item.customerName))}
                        </div>

                        <div>
                            <span class="customer-name">
                                ${escapeHtml(item.customerName ?? "—")}
                            </span>

                            <span class="customer-sub">${escapeHtml(item.restaurantName ?? "")}</span>
                        </div>
                    </div>
                </td>

                <td>${escapeHtml(item.phone ?? "—")}</td>
                <td>${formatDate(item.date)}</td>
                <td>${formatTime(item.time)}</td>
                <td>${escapeHtml(item.guestCount ?? "—")}</td>
                <td>${renderReservationStatus(item.status)}</td>

                <td>
                    <div class="action-group">
                        <button class="action-button"
                                type="button"
                                title="Xem chi tiết"
                                data-action="reservation-detail"
                                data-id="${escapeHtml(item.id)}">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/*
|--------------------------------------------------------------------------
| ORDER TABLE
|--------------------------------------------------------------------------
*/

function renderOrderTable() {
    const tbody = getElement("orderTableBody");

    if (!tbody) {
        return;
    }

    if (!state.orders.length) {
        tbody.innerHTML = renderEmptyState("Không có dữ liệu đơn hàng.");
        return;
    }

    tbody.innerHTML = state.orders.map((rawItem) => {
        const item = mapOrder(rawItem);
        const nextStatus = {
            CONFIRMED: "PREPARING",
            PREPARING: "READY_FOR_DELIVERY",
            READY_FOR_DELIVERY: "DELIVERING",
            DELIVERING: "ARRIVED"
        }[item.status];
        const canCancel = [
            "PENDING", "AWAITING_PAYMENT", "CONFIRMED", "PREPARING", "READY_FOR_DELIVERY"
        ].includes(item.status);
        const isOverdue = item.deliveryOverdue === true;

        return `
            <tr>
                <td>
                    <span class="table-code">
                        ${escapeHtml(item.code ?? "—")}
                    </span>
                </td>

                <td>
                    <div class="customer-cell">
                        <div class="customer-avatar">
                            ${escapeHtml(getInitial(item.customerName))}
                        </div>

                        <div>
                            <span class="customer-name">
                                ${escapeHtml(item.customerName ?? "—")}
                            </span>

                            <span class="customer-sub">
                                ${escapeHtml(item.customerPhone ?? "")}
                            </span>
                        </div>
                    </div>
                </td>

                <td>${formatDateTime(item.createdAt)}</td>
                <td>${escapeHtml(item.itemCount ?? "—")}</td>

                <td>
                    <span class="amount">
                        ${formatCurrency(item.totalAmount)}
                    </span>
                </td>

                <td>${renderStatus(item.status)}${item.estimatedDeliveryAt ? `<small class="delivery-estimate">Dự kiến: ${escapeHtml(formatDateTime(item.estimatedDeliveryAt))}</small>` : ""}${isOverdue ? '<span class="delivery-overdue">Trễ trên 20 phút</span>' : ""}</td>
                <td>${escapeHtml(paymentMethodLabel(item.paymentMethod))}</td>
                <td>${renderPaymentStatus(item.paymentStatus)}</td>

                <td>
                    <div class="action-group">
                        <button class="action-button"
                                type="button"
                                title="Xem chi tiết"
                                data-action="order-detail"
                                data-id="${escapeHtml(item.id)}">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        ${item.status === "PENDING" ? `
                            <button class="action-button" type="button"
                                    title="Xác nhận đơn hàng"
                                    data-action="order-confirm" data-id="${escapeHtml(item.id)}">
                                <i class="fa-solid fa-check"></i>
                            </button>` : ""}
                        ${nextStatus ? `
                            <button class="action-button" type="button"
                                    title="Chuyển sang ${escapeHtml(STATUS_CONFIG[nextStatus]?.label || nextStatus)}"
                                    data-action="order-advance" data-next-status="${nextStatus}"
                                    data-id="${escapeHtml(item.id)}">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>` : ""}
                        ${canCancel ? `
                            <button class="action-button" type="button"
                                    title="Hủy đơn hàng"
                                    data-action="order-cancel" data-id="${escapeHtml(item.id)}">
                                <i class="fa-solid fa-ban"></i>
                            </button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

async function handleOrderUpdate(button) {
    const id = button.dataset.id;
    const action = button.dataset.action;
    let endpoint;
    let options = { method: "PATCH" };

    if (action === "order-confirm") {
        endpoint = `/admin/orders/${encodeURIComponent(id)}/confirm`;
    } else if (action === "order-advance") {
        endpoint = `/admin/orders/${encodeURIComponent(id)}/status`;
        options.body = JSON.stringify({ status: button.dataset.nextStatus });
    } else if (action === "order-cancel") {
        openOrderCancelDialog(button);
        return;
    } else {
        return;
    }

    button.disabled = true;
    try {
        await apiRequest(endpoint, options);
        showToast("Cập nhật đơn hàng thành công.", "success");
        await loadOrders();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

function openOrderCancelDialog(button) {
    const rawItem = state.orders.find(item => String(item?.order?.id) === String(button.dataset.id));
    const order = rawItem ? mapOrder(rawItem) : { id: button.dataset.id };
    const itemNames = Array.isArray(order.items) && order.items.length
        ? order.items.map(item => item.itemName || item.name).filter(Boolean).join(", ")
        : "—";
    pendingCancelOrder = { button, order };
    getElement("cancelOrderSummary").innerHTML = `
        <div><span>Mã đơn</span><strong>#${escapeHtml(order.id)}</strong></div>
        <div><span>Khách hàng</span><strong>${escapeHtml(order.customerName || "—")}</strong></div>
        <div><span>Nhà hàng</span><strong>${escapeHtml(order.restaurantName || "—")}</strong></div>
        <div><span>Số món</span><strong>${escapeHtml(order.itemCount ?? "—")}</strong></div>
        <div class="full"><span>Món ăn trong đơn</span><strong>${escapeHtml(itemNames)}</strong></div>`;
    getElement("cancelOrderReason").value = "";
    getElement("cancelOrderError").textContent = "";
    getElement("confirmModal").classList.add("show");
    getElement("cancelOrderReason").focus();
}

function closeOrderCancelDialog() {
    if (getElement("acceptConfirmButton").disabled) return;
    getElement("confirmModal").classList.remove("show");
    pendingCancelOrder = null;
}

async function confirmOrderCancellation() {
    if (!pendingCancelOrder) return;
    const reason = getElement("cancelOrderReason").value.trim();
    if (!reason) {
        getElement("cancelOrderError").textContent = "Vui lòng nhập lý do hủy đơn hàng.";
        getElement("cancelOrderReason").focus();
        return;
    }
    const { button, order } = pendingCancelOrder;
    const accept = getElement("acceptConfirmButton");
    const dismiss = getElement("cancelConfirmButton");
    accept.disabled = true;
    dismiss.disabled = true;
    accept.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    button.disabled = true;
    try {
        await apiRequest(`/admin/orders/${encodeURIComponent(order.id)}/cancel`, {
            method: "PATCH",
            body: JSON.stringify({ reason })
        });
        getElement("confirmModal").classList.remove("show");
        pendingCancelOrder = null;
        showToast("Hủy đơn hàng thành công.", "success");
        await loadOrders();
    } catch (error) {
        getElement("cancelOrderError").textContent = error.message;
    } finally {
        accept.disabled = false;
        dismiss.disabled = false;
        accept.textContent = "Xác nhận hủy đơn";
        button.disabled = false;
    }
}

/*
|--------------------------------------------------------------------------
| PAGINATION
|--------------------------------------------------------------------------
*/

function renderPagination(containerId, currentPage, total, onChange) {
    const container = getElement(containerId);

    if (!container) {
        return;
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);

    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    let html = `
        <button class="page-button"
                type="button"
                data-page="${currentPage - 1}"
                ${currentPage <= 1 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let page = start; page <= end; page++) {
        html += `
            <button class="page-button ${page === currentPage ? "active" : ""}"
                    type="button"
                    data-page="${page}">
                ${page}
            </button>
        `;
    }

    html += `
        <button class="page-button"
                type="button"
                data-page="${currentPage + 1}"
                ${currentPage >= totalPages ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;

    container.querySelectorAll("[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
            const page = Number(button.dataset.page);

            if (page >= 1 && page <= totalPages) {
                onChange(page);
            }
        });
    });
}

function updateReservationPagination() {
    const total = state.reservationTotal;

    const start = total === 0
        ? 0
        : (state.reservationPage - 1) * PAGE_SIZE + 1;

    const end = Math.min(state.reservationPage * PAGE_SIZE, total);

    setText(
        "reservationResultInfo",
        `Hiển thị ${start} - ${end} trên tổng ${total} kết quả`
    );

    renderPagination(
        "reservationPagination",
        state.reservationPage,
        total,
        (page) => {
            state.reservationPage = page;
            filterReservations();
        }
    );
}

function updateOrderPagination() {
    const total = state.orderTotal;

    const start = total === 0
        ? 0
        : (state.orderPage - 1) * PAGE_SIZE + 1;

    const end = Math.min(state.orderPage * PAGE_SIZE, total);

    setText(
        "orderResultInfo",
        `Hiển thị ${start} - ${end} trên tổng ${total} kết quả`
    );

    renderPagination(
        "orderPagination",
        state.orderPage,
        total,
        (page) => {
            state.orderPage = page;
            loadOrders();
        }
    );
}

/*
|--------------------------------------------------------------------------
| STATISTICS
|--------------------------------------------------------------------------
*/

function resetStatistics() {
    setText("totalReservations", "—");
    setText("pendingReservations", "—");
    setText("totalOrders", "—");
    setText("totalRevenue", "—");

    setText("reservationSummary", "Chưa có dữ liệu");
    setText("pendingReservationSummary", "Chưa có dữ liệu");
    setText("orderSummary", "Chưa có dữ liệu");
    setText("revenueSummary", "Chưa có dữ liệu");
}

function statisticsMonthRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = value => [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
    ].join("-");

    return { from: toDate(from), to: toDate(now) };
}

async function loadStatistics() {
    setText("totalReservations", "…");
    setText("pendingReservations", "…");
    setText("totalOrders", "…");
    setText("totalRevenue", "…");
    setText("reservationSummary", "Đang tải dữ liệu đặt bàn…");
    setText("pendingReservationSummary", "Đang tải dữ liệu đặt bàn…");
    setText("orderSummary", "Đang tải dữ liệu đơn hàng…");
    setText("revenueSummary", "Đang tải báo cáo doanh thu…");

    const period = statisticsMonthRange();
    const revenueParams = new URLSearchParams(period);
    const [reservationResult, orderResult, revenueResult] = await Promise.allSettled([
        apiRequest(API_ENDPOINTS.reservations),
        apiRequest(`${API_ENDPOINTS.orders}?page=0&size=1`),
        apiRequest(`${API_ENDPOINTS.revenueReport}?${revenueParams.toString()}`)
    ]);

    if (reservationResult.status === "fulfilled") {
        const reservations = extractList(reservationResult.value);
        const pendingCount = reservations.reduce((count, item) =>
            count + (mapReservation(item).status === "CONFIRMED" ? 1 : 0), 0);
        setText("totalReservations", reservations.length);
        setText("pendingReservations", pendingCount);
        setText("reservationSummary", reservations.length ? "Dữ liệu đặt bàn hiện có" : "Chưa có lượt đặt bàn");
        setText("pendingReservationSummary", pendingCount ? "Đã được xác nhận" : "Chưa có lượt đã xác nhận");
    } else {
        console.error("Load reservation statistics error:", reservationResult.reason);
        setText("totalReservations", "—");
        setText("pendingReservations", "—");
        setText("reservationSummary", "Không tải được dữ liệu đặt bàn");
        setText("pendingReservationSummary", "Không tải được dữ liệu đặt bàn");
    }

    if (orderResult.status === "fulfilled") {
        const list = extractList(orderResult.value);
        const total = extractTotal(orderResult.value, list);
        setText("totalOrders", total);
        setText("orderSummary", total ? "Dữ liệu đơn hàng hiện có" : "Chưa có đơn hàng");
    } else {
        console.error("Load order statistics error:", orderResult.reason);
        setText("totalOrders", "—");
        setText("orderSummary", "Không tải được dữ liệu đơn hàng");
    }

    if (revenueResult.status === "fulfilled") {
        const report = extractData(revenueResult.value);
        const totalRevenue = report?.summary?.totalRevenue;
        setText("totalRevenue", totalRevenue !== undefined ? formatCurrency(totalRevenue) : "—");
        setText("revenueSummary", `Từ ${period.from.split("-").reverse().join("/")} đến ${period.to.split("-").reverse().join("/")}`);
    } else {
        console.error("Load revenue statistics error:", revenueResult.reason);
        setText("totalRevenue", "—");
        setText("revenueSummary", "Không tải được báo cáo doanh thu");
    }
}

/*
|--------------------------------------------------------------------------
| LOAD RESERVATIONS
|--------------------------------------------------------------------------
*/

async function loadReservations() {
    const tbody = getElement("reservationTableBody");

    if (!tbody || state.loadingReservations) {
        return;
    }

    if (!API_ENDPOINTS.reservations) {
        state.reservations = [];
        state.reservationTotal = 0;

        renderReservationTable();
        updateReservationPagination();
        return;
    }

    state.loadingReservations = true;
    tbody.innerHTML = renderLoadingState();

    try {
        const response = await apiRequest(API_ENDPOINTS.reservations);

        const list = extractList(response);
        state.allReservations = list;
        filterReservations();

    } catch (error) {
        console.error("Load reservations error:", error);

        state.allReservations = [];
        state.reservations = [];
        state.reservationTotal = 0;

        tbody.innerHTML = renderErrorState(error.message);
        updateReservationPagination();

        showToast(error.message, "error");

    } finally {
        state.loadingReservations = false;
    }
}

function filterReservations() {
    const keyword = state.reservationFilters.keyword.toLowerCase();
    const filtered = state.allReservations.filter(item => {
        const reservation = mapReservation(item);
        const matchesKeyword = !keyword || [
            reservation.code,
            reservation.customerName,
            reservation.phone,
            reservation.restaurantName
        ].some(value => String(value ?? "").toLowerCase().includes(keyword));
        const matchesStatus = !state.reservationFilters.status
            || reservation.status === state.reservationFilters.status;
        const matchesRestaurant = !state.reservationFilters.restaurant
            || String(reservation.restaurantName ?? "").toLowerCase()
                .includes(state.reservationFilters.restaurant.toLowerCase());
        const matchesDate = !state.reservationFilters.date
            || String(reservation.date ?? "").slice(0, 10) === state.reservationFilters.date;

        return matchesKeyword && matchesRestaurant && matchesStatus && matchesDate;
    });

    state.reservationTotal = filtered.length;
    const start = (state.reservationPage - 1) * PAGE_SIZE;
    state.reservations = filtered.slice(start, start + PAGE_SIZE);
    renderReservationTable();
    updateReservationPagination();
}

/*
|--------------------------------------------------------------------------
| LOAD ORDERS
|--------------------------------------------------------------------------
*/

async function loadOrders() {
    const tbody = getElement("orderTableBody");

    if (!tbody) {
        return;
    }
    if (state.loadingOrders) {
        state.orderReloadQueued = true;
        return;
    }

    if (!API_ENDPOINTS.orders) {
        state.orders = [];
        state.orderTotal = 0;

        renderOrderTable();
        updateOrderPagination();
        return;
    }

    state.loadingOrders = true;
    tbody.innerHTML = renderLoadingState();

    try {
        const params = new URLSearchParams();

        params.set("page", String(state.orderPage - 1));
        params.set("size", String(PAGE_SIZE));

        if (state.orderFilters.keyword) {
            if (/^\d+$/.test(state.orderFilters.keyword)) {
                params.set("orderId", state.orderFilters.keyword);
            } else {
                params.set("customer", state.orderFilters.keyword);
            }
        }

        if (state.orderFilters.status) {
            params.set("status", state.orderFilters.status);
        }

        if (state.orderFilters.restaurant) {
            params.set("restaurant", state.orderFilters.restaurant);
        }

        const endpoint =
            `${API_ENDPOINTS.orders}?${params.toString()}`;

        const response = await apiRequest(endpoint);

        const list = extractList(response);

        state.orders = reconcileOrderEvents(list);
        state.orderTotal = extractTotal(response, list);

        renderOrderTable();
        updateOrderPagination();

    } catch (error) {
        console.error("Load orders error:", error);

        state.orders = [];
        state.orderTotal = 0;

        tbody.innerHTML = renderErrorState(error.message);
        updateOrderPagination();

        showToast(error.message, "error");

    } finally {
        state.loadingOrders = false;
        if (state.orderReloadQueued) {
            state.orderReloadQueued = false;
            loadOrders();
        }
    }
}

/*
|--------------------------------------------------------------------------
| RESERVATION FILTERS
|--------------------------------------------------------------------------
*/

function applyReservationFilters() {
    state.reservationFilters = {
        keyword: getElement("reservationSearch").value.trim(),
        restaurant: getElement("reservationRestaurant").value.trim(),
        status: getElement("reservationStatus").value,
        date: getElement("reservationDate").value
    };

    state.reservationPage = 1;

    filterReservations();
}

function resetReservationFilters() {
    getElement("reservationSearch").value = "";
    getElement("reservationRestaurant").value = "";
    getElement("reservationStatus").value = "";
    getElement("reservationDate").value = "";

    state.reservationFilters = {
        keyword: "",
        restaurant: "",
        status: "",
        date: ""
    };

    state.reservationPage = 1;

    filterReservations();
}

/*
|--------------------------------------------------------------------------
| ORDER FILTERS
|--------------------------------------------------------------------------
*/

function applyOrderFilters() {
    state.orderFilters = {
        keyword: getElement("orderSearch").value.trim(),
        restaurant: getElement("orderRestaurant").value.trim(),
        status: getElement("orderStatus").value
    };

    state.orderPage = 1;

    loadOrders();
}

function resetOrderFilters() {
    getElement("orderSearch").value = "";
    getElement("orderRestaurant").value = "";
    getElement("orderStatus").value = "";
    state.orderFilters = {
        keyword: "",
        restaurant: "",
        status: ""
    };

    state.orderPage = 1;

    loadOrders();
}

/*
|--------------------------------------------------------------------------
| DETAIL MODAL
|--------------------------------------------------------------------------
*/

function openDetailModal(title, subtitle, html) {
    setText("detailModalTitle", title);
    setText("detailModalSubtitle", subtitle || "");

    getElement("detailModalBody").innerHTML = html;

    getElement("detailModal").classList.add("show");
}

function closeDetailModal() {
    stopOrderDetailRefresh();
    orderDetailRequestSequence += 1;
    const modal = getElement("detailModal");
    modal.classList.remove("show");
    delete modal.dataset.orderId;
    delete modal.dataset.reservationId;
}

function stopOrderDetailRefresh() {
    if (!orderDetailRefreshTimer) return;
    window.clearInterval(orderDetailRefreshTimer);
    orderDetailRefreshTimer = null;
}

function startOrderDetailRefresh(orderId) {
    stopOrderDetailRefresh();
    orderDetailRefreshTimer = window.setInterval(() => {
        const modal = getElement("detailModal");
        if (!modal.classList.contains("show") || modal.dataset.orderId !== String(orderId)) {
            stopOrderDetailRefresh();
            return;
        }
        viewOrderDetail(orderId, false);
    }, 10000);
}

function renderDetailItem(label, value, full = false) {
    return `
        <div class="detail-item ${full ? "full" : ""}">
            <label>${escapeHtml(label)}</label>
            <strong>${escapeHtml(value ?? "—")}</strong>
        </div>
    `;
}

function renderReservationDetail(item) {
    stopOrderDetailRefresh();
    const data = mapReservation(item);
    getElement("detailModal").dataset.reservationId = String(data.id);

    const html = `
        <div class="detail-grid">
            ${renderDetailItem("Mã đặt bàn", data.code)}
            ${renderDetailItem("Trạng thái", data.status === "PENDING" ? "Chưa xác nhận (dữ liệu cũ)" : (STATUS_CONFIG[data.status]?.label || data.status))}
            ${renderDetailItem("Nhà hàng", data.restaurantName)}
            ${renderDetailItem("Số bàn", data.tableNumber)}
            ${renderDetailItem("Tên khách hàng", data.customerName)}
            ${renderDetailItem("Số điện thoại", data.phone)}
            ${renderDetailItem("Ngày đặt", formatDate(data.date))}
            ${renderDetailItem("Bắt đầu", formatDateTime(data.time))}
            ${renderDetailItem("Kết thúc", formatDateTime(data.endTime))}
            ${renderDetailItem("Số lượng khách", data.guestCount)}
            ${renderDetailItem("Ghi chú", data.note, true)}
        </div>
        ${!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(data.status) ? `
            <section class="shipper-assignment" data-reservation-id="${escapeHtml(data.id)}">
                <label for="reservation-status-select">Cập nhật trạng thái đặt bàn</label>
                <div class="shipper-assignment-controls">
                    <select id="reservation-status-select">
                        <option value="CONFIRMED" ${data.status === "CONFIRMED" ? "selected" : ""}>Đã xác nhận</option>
                        <option value="COMPLETED">Hoàn thành</option>
                        <option value="CANCELLED">Đã hủy</option>
                        <option value="NO_SHOW">Khách không đến</option>
                    </select>
                    <button class="btn btn-primary" id="update-reservation-status-button" type="button">
                        Cập nhật
                    </button>
                </div>
                <p class="shipper-assignment-message" id="reservation-status-message" aria-live="polite"></p>
            </section>` : ""}
    `;

    openDetailModal(
        "Chi tiết đặt bàn",
        data.code,
        html
    );
}

async function updateReservationStatus() {
    const section = document.querySelector(".shipper-assignment[data-reservation-id]");
    const select = getElement("reservation-status-select");
    const button = getElement("update-reservation-status-button");
    const message = getElement("reservation-status-message");
    if (!section || !select || !button || !message) return;

    button.disabled = true;
    message.textContent = "Đang cập nhật…";
    try {
        const endpoint = API_ENDPOINTS.reservationStatus.replace(
            "{id}", encodeURIComponent(section.dataset.reservationId)
        );
        await apiRequest(endpoint, {
            method: "PATCH",
            body: JSON.stringify({ status: select.value })
        });
        message.textContent = "Cập nhật trạng thái thành công.";
        await Promise.all([loadReservations(), loadStatistics()]);
        await viewReservationDetail(section.dataset.reservationId);
    } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
    }
}

function renderOrderDetail(item) {
    const data = mapOrder(item);
    const isOverdue = data.deliveryOverdue === true;

    const html = `
        <div class="detail-grid">
            ${renderDetailItem("Mã đơn hàng", data.code)}
            ${renderDetailItem("Trạng thái đơn hàng", data.status)}
            ${renderDetailItem("Phương thức thanh toán", paymentMethodLabel(data.paymentMethod))}
            ${renderDetailItem("Trạng thái thanh toán", ({
                PENDING: "Chưa thanh toán", SUCCESS: "Đã thanh toán", FAILED: "Thanh toán thất bại",
                CANCELLED: "Đã hủy", REFUNDED: "Đã hoàn tiền", NEEDS_RECONCILIATION: "Cần đối soát"
            })[data.paymentStatus] || data.paymentStatus)}
            ${renderDetailItem("Tên khách hàng", data.customerName)}
            ${renderDetailItem("Số điện thoại", data.customerPhone)}
            ${renderDetailItem("Email", data.customerEmail)}
            ${renderDetailItem("Nhà hàng", data.restaurantName)}
            ${renderDetailItem("Ngày tạo", formatDateTime(data.createdAt))}
            ${renderDetailItem("Dự kiến nhận hàng", data.estimatedDeliveryAt ? formatDateTime(data.estimatedDeliveryAt) : "Chưa xác định")}
            ${renderDetailItem("Khoảng cách giao hàng", Number.isFinite(Number(data.deliveryDistanceKm)) ? `${Number(data.deliveryDistanceKm).toLocaleString("vi-VN", {maximumFractionDigits: 3})} km` : "Chưa xác định")}
            ${renderDetailItem("Nhân viên giao hàng (Shipper)", data.shipperName || (["PENDING", "AWAITING_PAYMENT", "CONFIRMED", "PREPARING"].includes(data.status) ? "Chưa phân công tài xế" : "Chưa có tài xế"))}
            ${isOverdue ? renderDetailItem("Cảnh báo giao hàng", "Đã trễ hơn thời gian dự kiến 20 phút") : ""}
            ${renderDetailItem("Số lượng món", data.itemCount)}
            ${renderDetailItem("Tổng tiền", formatCurrency(data.totalAmount))}
            ${renderDetailItem("Địa chỉ giao hàng", data.deliveryAddress, true)}
            ${data.status === "CANCELLED" && data.cancellationDetail
                ? renderDetailItem("Lý do hủy", data.cancellationDetail, true)
                : ""}
        </div>
        ${!["DELIVERING", "ARRIVED", "COMPLETED", "CANCELLED"].includes(data.status) ? `
            <section class="shipper-assignment" data-order-id="${escapeHtml(data.id)}"
                     data-restaurant-id="${escapeHtml(data.restaurantId)}">
                <label for="order-shipper-select">Phân công nhân viên giao hàng</label>
                <div class="shipper-assignment-controls">
                    <select id="order-shipper-select" disabled>
                        <option value="">Đang tải danh sách shipper…</option>
                    </select>
                    <button class="btn btn-primary" id="assign-shipper-button" type="button" disabled>
                        Xác nhận phân công
                    </button>
                </div>
                <p class="shipper-assignment-message" id="shipper-assignment-message" aria-live="polite"></p>
            </section>` : ""}
    `;

    openDetailModal(
        "Chi tiết đơn hàng",
        data.code,
        html
    );

    if (!["DELIVERING", "ARRIVED", "COMPLETED", "CANCELLED"].includes(data.status)) {
        loadAvailableShippers(data);
    }
}

async function loadAvailableShippers(order) {
    const select = getElement("order-shipper-select");
    const button = getElement("assign-shipper-button");
    const message = getElement("shipper-assignment-message");
    if (!select || !button || !message || !order.restaurantId) return;

    try {
        const endpoint = API_ENDPOINTS.restaurantEmployees
            .replace("{restaurantId}", encodeURIComponent(order.restaurantId));
        const params = new URLSearchParams({ position: "SHIPPER", status: "ACTIVE" });
        const employees = extractData(await apiRequest(`${endpoint}?${params}`));
        const shippers = Array.isArray(employees) ? employees : [];

        select.innerHTML = '<option value="">Chọn nhân viên giao hàng</option>'
            + shippers.map(shipper => `<option value="${escapeHtml(shipper.id)}"`
                + `${String(shipper.id) === String(order.shipperId) ? " selected" : ""}>`
                + `${escapeHtml(shipper.fullName)} (${escapeHtml(shipper.employeeCode)})</option>`).join("");
        select.disabled = shippers.length === 0;
        button.disabled = shippers.length === 0 || !select.value;
        message.textContent = shippers.length === 0
            ? "Nhà hàng chưa có nhân viên SHIPPER đang hoạt động."
            : "";
    } catch (error) {
        select.innerHTML = '<option value="">Không tải được danh sách shipper</option>';
        select.disabled = true;
        button.disabled = true;
        message.textContent = error.message;
    }
}

async function assignSelectedShipper() {
    const modal = getElement("detailModal");
    const select = getElement("order-shipper-select");
    const button = getElement("assign-shipper-button");
    const message = getElement("shipper-assignment-message");
    const orderId = modal?.dataset.orderId;
    if (!orderId || !select?.value || !button || !message) return;

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = "Đang phân công…";
    message.textContent = "";
    try {
        const endpoint = API_ENDPOINTS.assignShipper.replace("{id}", encodeURIComponent(orderId));
        await apiRequest(endpoint, {
            method: "PATCH",
            body: JSON.stringify({ shipperId: Number(select.value) })
        });
        showToast("Phân công nhân viên giao hàng thành công.", "success");
        await viewOrderDetail(orderId, false);
    } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

/*
|--------------------------------------------------------------------------
| FETCH DETAIL
|--------------------------------------------------------------------------
*/

async function viewReservationDetail(id) {
    try {
        let item;

        if (API_ENDPOINTS.reservationDetail) {
            const endpoint = API_ENDPOINTS.reservationDetail.replace(
                "{id}",
                encodeURIComponent(id)
            );

            const response = await apiRequest(endpoint);
            item = extractData(response);
        } else {
            item = state.reservations.find(
                reservation => String(reservation.id) === String(id)
            );
        }

        if (!item) {
            showToast("Không tìm thấy thông tin đặt bàn.", "error");
            return;
        }

        renderReservationDetail(item);

    } catch (error) {
        console.error("Reservation detail error:", error);
        showToast(error.message, "error");
    }
}

async function viewOrderDetail(id, startRefresh = true) {
    const requestSequence = ++orderDetailRequestSequence;
    try {
        let item;

        if (API_ENDPOINTS.orderDetail) {
            const endpoint = API_ENDPOINTS.orderDetail.replace(
                "{id}",
                encodeURIComponent(id)
            );

            const response = await apiRequest(endpoint);
            item = extractData(response);
        } else {
            item = state.orders.find(
                order => String(order.id) === String(id)
            );
        }

        if (requestSequence !== orderDetailRequestSequence) return;
        if (!item) {
            showToast("Không tìm thấy thông tin đơn hàng.", "error");
            return;
        }

        getElement("detailModal").dataset.orderId = String(id);
        renderOrderDetail(item);
        if (startRefresh) startOrderDetailRefresh(id);

    } catch (error) {
        console.error("Order detail error:", error);
        showToast(error.message, "error");
    }
}

/*
|--------------------------------------------------------------------------
| TAB SWITCHING
|--------------------------------------------------------------------------
*/

function switchTab(tabName) {
    if (!["reservations", "orders"].includes(tabName)) {
        return;
    }

    state.activeTab = tabName;

    $$(".tab-button").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.tab === tabName
        );
    });

    getElement("reservationsPanel").classList.toggle(
        "active",
        tabName === "reservations"
    );

    getElement("ordersPanel").classList.toggle(
        "active",
        tabName === "orders"
    );

    if (tabName === "reservations") {
        loadReservations();
    } else {
        loadOrders();
    }
}

/*
|--------------------------------------------------------------------------
| TABLE ACTIONS
|--------------------------------------------------------------------------
*/

function bindTableActions() {
    getElement("reservationTableBody").addEventListener(
        "click",
        event => {
            const button = event.target.closest("[data-action]");

            if (!button) {
                return;
            }

            const id = button.dataset.id;

            if (button.dataset.action === "reservation-detail") {
                viewReservationDetail(id);
            }
        }
    );

    getElement("orderTableBody").addEventListener(
        "click",
        event => {
            const button = event.target.closest("[data-action]");

            if (!button) {
                return;
            }

            const id = button.dataset.id;

            if (button.dataset.action === "order-detail") {
                viewOrderDetail(id);
                return;
            }

            handleOrderUpdate(button);
        }
    );
}

/*
|--------------------------------------------------------------------------
| SIDEBAR
|--------------------------------------------------------------------------
*/

function bindSidebar() {
    const sidebar = getElement("sidebar");
    const menuToggle = getElement("mobileMenuButton");
    const sidebarClose = getElement("sidebarClose");

    if (!sidebar || !menuToggle || !sidebarClose || sidebar.classList.contains("admin-shell-sidebar")) {
        return;
    }

    menuToggle.addEventListener("click", () => {
        sidebar.classList.add("open");
    });

    sidebarClose.addEventListener("click", () => {
        sidebar.classList.remove("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 950 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !event.target.closest("#mobileMenuButton")
        ) {
            sidebar.classList.remove("open");
        }
    });
}

/*
|--------------------------------------------------------------------------
| MODAL EVENTS
|--------------------------------------------------------------------------
*/

function bindModalEvents() {
    getElement("detailModalBody").addEventListener("change", event => {
        if (event.target.id === "order-shipper-select") {
            getElement("assign-shipper-button").disabled = !event.target.value;
        }
    });
    getElement("detailModalBody").addEventListener("click", event => {
        if (event.target.closest("#update-reservation-status-button")) {
            updateReservationStatus();
        }
    });
    getElement("detailModalBody").addEventListener("click", event => {
        if (event.target.closest("#assign-shipper-button")) assignSelectedShipper();
    });
    getElement("closeDetailModal").addEventListener(
        "click",
        closeDetailModal
    );

    getElement("closeDetailButton").addEventListener(
        "click",
        closeDetailModal
    );

    getElement("detailModal").addEventListener("click", event => {
        if (event.target === getElement("detailModal")) {
            closeDetailModal();
        }
    });
    getElement("cancelConfirmButton").addEventListener("click", closeOrderCancelDialog);
    getElement("acceptConfirmButton").addEventListener("click", confirmOrderCancellation);
    getElement("confirmModal").addEventListener("click", event => {
        if (event.target === getElement("confirmModal")) closeOrderCancelDialog();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeDetailModal();
            closeOrderCancelDialog();
        }
    });
}

/*
|--------------------------------------------------------------------------
| EVENT LISTENERS
|--------------------------------------------------------------------------
*/

function bindEvents() {
    $$(".tab-button").forEach(button => {
        button.addEventListener("click", () => {
            switchTab(button.dataset.tab);
        });
    });

    getElement("filterReservationButton").addEventListener(
        "click",
        applyReservationFilters
    );

    getElement("resetReservationFilter").addEventListener(
        "click",
        resetReservationFilters
    );

    getElement("filterOrderButton").addEventListener(
        "click",
        applyOrderFilters
    );

    getElement("resetOrderFilter").addEventListener(
        "click",
        resetOrderFilters
    );

    getElement("reservationSearch").addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                applyReservationFilters();
            }
        }
    );

    getElement("orderSearch").addEventListener(
        "keydown",
        event => {
            if (event.key === "Enter") {
                applyOrderFilters();
            }
        }
    );

    bindTableActions();
    bindSidebar();
    bindModalEvents();
}

function initializeOrderRealtime() {
    if (orderRealtimeConnection || !window.FCA_ORDER_REALTIME) return;

    orderRealtimeConnection = window.FCA_ORDER_REALTIME.connect({
        connectionKey: "admin-orders",
        apiOrigin: API_BASE.replace(/\/api\/v1$/, ""),
        getToken: getAccessToken,
        destinations: () => ["/topic/admin/orders", "/topic/admin/reservations"],
        onEvent: event => {
            if (event?.reservationId) {
                console.info("[Admin reservation realtime] Processing event", {
                    type: event.type,
                    reservationId: event.reservationId,
                    status: event.status
                });
                loadReservations();
                loadStatistics();
                const modal = getElement("detailModal");
                if (modal?.classList.contains("show")
                        && modal.dataset.reservationId === String(event.reservationId)) {
                    viewReservationDetail(event.reservationId);
                }
                return;
            }
            console.info("[Admin order realtime] Processing event", {
                type: event?.type,
                orderId: event?.orderId
            });
            if (!event?.orderId) return;
            if (!rememberOrderEvent(event)) return;
            if (event.type === "CREATED") {
                showToast(`Có đơn hàng mới #${event.orderId}.`, "success");
                addOrderFromEvent(event);
            } else if (state.activeTab === "orders"
                    && !updateVisibleOrderFromEvent(event)) {
                addOrderFromEvent(event);
            }

            const modal = getElement("detailModal");
            if (modal?.classList.contains("show")
                    && modal.dataset.orderId === String(event.orderId)) {
                viewOrderDetail(event.orderId);
            }
        },
        onConnected: reconnected => {
            if (!reconnected) return;
            if (state.activeTab === "orders") loadOrders();
            if (state.activeTab === "reservations") loadReservations();
        },
        onAuthError: () => {
            localStorage.removeItem("adminAccessToken");
            localStorage.removeItem("adminRefreshToken");
            window.location.replace("../login.html");
        }
    });
}

/*
|--------------------------------------------------------------------------
| INITIALIZATION
|--------------------------------------------------------------------------
*/

async function initPage() {
    bindEvents();
    initializeOrderRealtime();

    resetStatistics();

    /*
     * Khi chưa cấu hình endpoint, hai bảng hiển thị trạng thái rỗng.
     * Không tự sinh dữ liệu minh họa.
     */
    renderReservationTable();
    renderOrderTable();

    updateReservationPagination();
    updateOrderPagination();

    await Promise.all([
        loadReservations(),
        loadStatistics()
    ]);
}

document.addEventListener("DOMContentLoaded", initPage);
