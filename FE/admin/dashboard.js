"use strict";

/* =========================================================
   FCA CULINARY - ADMIN DASHBOARD
   ========================================================= */

/*
 * 1. CẤU HÌNH API
 *
 * Điền endpoint thực tế của Spring Boot vào đây.
 * Để trống endpoint nào thì chức năng tương ứng chưa gọi API.
 *
 * Không tự tạo endpoint giả.
 */

const API_BASE = "http://localhost:8080/api/v1";

const API_ENDPOINTS = {
    // Thông tin tài khoản quản trị
    currentUser: "/auth/me",

    // Thống kê tổng quan
    dashboardSummary: "/admin/reports/revenue",

    // Thống kê doanh thu theo thời gian
    revenueStatistics: "/admin/reports/revenue",

    // Danh sách chi nhánh
    branches: "/admin/restaurants?page=0&size=100&sortBy=id&sortDirection=asc",

    // Yêu cầu cần xử lý
    urgentItems: "",

    // Trạng thái bếp
    kitchenStatus: "",

    // Đặt bàn mới nhất
    recentReservations: "/admin/table-reservations",

    // Tồn kho nguyên liệu
    inventory: ""
};

/*
 * 2. CẤU HÌNH TOKEN
 *
 * Nếu trang đăng nhập đang dùng key khác,
 * sửa ACCESS_TOKEN_KEY và REFRESH_TOKEN_KEY.
 */

const ACCESS_TOKEN_KEY = "adminAccessToken";
const REFRESH_TOKEN_KEY = "adminRefreshToken";

/*
 * 3. STATE
 */

const dashboardState = {
    period: "today",
    branchId: "",
    summary: null,
    revenue: [],
    branches: [],
    urgentItems: [],
    kitchen: null,
    recentReservations: [],
    inventory: []
};

/*
 * 4. DOM HELPERS
 */

function getElement(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value ?? "--";
    }
}

function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(number);
}

function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
        return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return new Intl.NumberFormat("vi-VN").format(number);
}

function formatDateTime(value) {
    if (!value) {
        return "--";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("vi-VN");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showToast(message, type = "") {
    const container = getElement("toastContainer");

    if (!container) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3500);
}

function setEmptyState(containerId, title, description, icon = "info") {
    const container = getElement(containerId);

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="empty-state ${containerId === "branchList" ? "full-width" : ""}">
            <span class="material-symbols-outlined">${escapeHTML(icon)}</span>
            <strong>${escapeHTML(title)}</strong>
            <p>${escapeHTML(description)}</p>
        </div>
    `;
}

/*
 * 5. API HELPER
 */

async function apiRequest(endpoint, options = {}) {
    if (!endpoint) {
        throw new Error("API endpoint chưa được cấu hình.");
    }

    const token = getAccessToken();

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    if (response.status === 401) {
        throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }

    if (response.status === 403) {
        throw new Error("Bạn không có quyền truy cập chức năng này.");
    }

    if (!response.ok) {
        let message = `Lỗi API: ${response.status}`;

        try {
            const errorData = await response.json();
            message = errorData.message || errorData.error || message;
        } catch {
            // Giữ thông báo mặc định nếu response không phải JSON.
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        return null;
    }

    return response.json();
}

/*
 * 6. RESPONSE HANDLER
 *
 * Hỗ trợ một số cấu trúc response phổ biến:
 * - { data: ... }
 * - { result: ... }
 * - Response trả trực tiếp dữ liệu.
 *
 * Bạn cần chỉnh lại nếu ApiResponse của backend có cấu trúc khác.
 */

function extractData(response) {
    if (response === null || response === undefined) {
        return null;
    }

    if (Object.prototype.hasOwnProperty.call(response, "data")) {
        return response.data;
    }

    if (Object.prototype.hasOwnProperty.call(response, "result")) {
        return response.result;
    }

    return response;
}

function extractList(response) {
    const data = extractData(response);

    if (Array.isArray(data)) {
        return data;
    }

    if (data && Array.isArray(data.content)) {
        return data.content;
    }

    if (data && Array.isArray(data.items)) {
        return data.items;
    }

    if (data && Array.isArray(data.records)) {
        return data.records;
    }

    return [];
}

/*
 * 7. MAPPING DTO
 *
 * Đây là mapping dự kiến để bạn thay bằng tên trường DTO thật.
 * Không có dữ liệu mặc định hoặc dữ liệu mẫu.
 */

// Dashboard summary
function mapSummary(data) {
    if (!data) {
        return null;
    }

    return {
        totalRevenue: data.totalRevenue,
        revenueChange: data.revenueChange,

        totalOrders: data.totalOrders,
        pendingOrders: data.pendingOrders,
        processingOrders: data.processingOrders,

        totalReservations: data.totalReservations,
        pendingReservations: data.pendingReservations,

        totalBranches: data.totalBranches,
        activeBranches: data.activeBranches
    };
}

// Revenue statistics
function mapRevenue(item) {
    return {
        label: item.date,
        revenue: Number(item.revenue ?? 0)
    };
}

// Branch
function mapBranch(item) {
    return {
        id: item.id ?? item.branchId,
        name: item.name ?? item.branchName,
        address: item.address ?? item.location,
        active: item.active,
        revenue: item.revenue ?? item.totalRevenue,
        occupiedTables: item.occupiedTables,
        totalTables: item.totalTables
    };
}

// Urgent item
function mapUrgentItem(item) {
    return {
        id: item.id,
        title: item.title ?? item.name,
        description: item.description ?? item.content,
        branchName: item.branchName,
        createdAt: item.createdAt,
        status: item.status
    };
}

// Kitchen status
function mapKitchen(data) {
    if (!data) {
        return null;
    }

    return {
        waiting: data.waiting ?? data.pendingOrders,
        processing: data.processing ?? data.cookingOrders,
        delayed: data.delayed ?? data.overdueOrders,
        message: data.message ?? data.description
    };
}

// Reservation
function mapReservation(item) {
    return {
        id: item.reservationId,
        customerName: item.customerName,
        branchName: item.restaurantName,
        guestCount: item.guestCount,
        reservationTime: item.startTime,
        status: item.status
    };
}

// Inventory
function mapInventory(item) {
    return {
        id: item.id,
        name: item.name ?? item.ingredientName,
        quantity: item.quantity ?? item.stockQuantity,
        unit: item.unit,
        status: item.status
    };
}

/*
 * 8. QUERY PARAMETERS
 */

function buildDashboardQuery() {
    const params = new URLSearchParams();
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (dashboardState.period === "week") {
        const day = from.getDay() || 7;
        from.setDate(from.getDate() - day + 1);
    } else if (dashboardState.period === "month") {
        from.setDate(1);
    }

    const toDateString = date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    params.set("from", toDateString(from));
    params.set("to", toDateString(today));

    if (dashboardState.branchId) {
        params.set("restaurantId", dashboardState.branchId);
    }

    return `?${params.toString()}`;
}

/*
 * 9. LOAD API DATA
 */

async function loadEndpoint(endpoint, onSuccess, errorLabel) {
    if (!endpoint) {
        return false;
    }

    try {
        const response = await apiRequest(endpoint);
        onSuccess(extractData(response));
        return true;
    } catch (error) {
        console.error(`[Dashboard] ${errorLabel}:`, error);
        showToast(`${errorLabel}: ${error.message}`, "error");
        return false;
    }
}

async function loadSummary() {
    if (!API_ENDPOINTS.dashboardSummary) {
        renderSummary(null);
        return;
    }

    const endpoint = API_ENDPOINTS.dashboardSummary + buildDashboardQuery();

    await loadEndpoint(
        endpoint,
        data => {
            dashboardState.summary = mapSummary(data?.summary);
            renderSummary(dashboardState.summary);
        },
        "Không thể tải thống kê tổng quan"
    );
}

async function loadRevenue() {
    if (!API_ENDPOINTS.revenueStatistics) {
        dashboardState.revenue = [];
        renderRevenueChart([]);
        return;
    }

    const endpoint = API_ENDPOINTS.revenueStatistics + buildDashboardQuery();

    await loadEndpoint(
        endpoint,
        data => {
            const list = data?.dailyRevenue || [];

            dashboardState.revenue = list.map(mapRevenue);
            renderRevenueChart(dashboardState.revenue);
        },
        "Không thể tải thống kê doanh thu"
    );
}

async function loadBranches() {
    if (!API_ENDPOINTS.branches) {
        dashboardState.branches = [];
        renderBranches([]);
        return;
    }

    await loadEndpoint(
        API_ENDPOINTS.branches,
        data => {
            const list = Array.isArray(data)
                ? data
                : data?.items || data?.content || [];

            dashboardState.branches = list.map(mapBranch);
            renderBranches(dashboardState.branches);
            renderBranchFilter(dashboardState.branches);
            setText("totalBranches", formatNumber(data?.totalElements ?? list.length));
            setText(
                "branchDescription",
                `Đang hoạt động: ${formatNumber(list.filter(item => item.active !== false).length)}`
            );
        },
        "Không thể tải danh sách chi nhánh"
    );
}

async function loadUrgentItems() {
    if (!API_ENDPOINTS.urgentItems) {
        dashboardState.urgentItems = [];
        renderUrgentItems([]);
        return;
    }

    await loadEndpoint(
        API_ENDPOINTS.urgentItems,
        data => {
            const list = Array.isArray(data)
                ? data
                : data?.items || data?.content || [];

            dashboardState.urgentItems = list.map(mapUrgentItem);
            renderUrgentItems(dashboardState.urgentItems);
        },
        "Không thể tải yêu cầu cần xử lý"
    );
}

async function loadKitchenStatus() {
    if (!API_ENDPOINTS.kitchenStatus) {
        dashboardState.kitchen = null;
        renderKitchen(null);
        return;
    }

    await loadEndpoint(
        API_ENDPOINTS.kitchenStatus,
        data => {
            dashboardState.kitchen = mapKitchen(data);
            renderKitchen(dashboardState.kitchen);
        },
        "Không thể tải trạng thái bếp"
    );
}

async function loadRecentReservations() {
    if (!API_ENDPOINTS.recentReservations) {
        dashboardState.recentReservations = [];
        renderRecentReservations([]);
        return;
    }

    await loadEndpoint(
        API_ENDPOINTS.recentReservations,
        data => {
            const list = Array.isArray(data)
                ? data
                : data?.items || data?.content || [];

            dashboardState.recentReservations = list.map(mapReservation);
            renderRecentReservations(dashboardState.recentReservations);
            setText("totalReservations", formatNumber(list.length));
            setText(
                "reservationDescription",
                `Đặt bàn đang chờ: ${formatNumber(list.filter(item => item.status === "PENDING").length)}`
            );
        },
        "Không thể tải danh sách đặt bàn"
    );
}

async function loadInventory() {
    if (!API_ENDPOINTS.inventory) {
        dashboardState.inventory = [];
        renderInventory([]);
        return;
    }

    await loadEndpoint(
        API_ENDPOINTS.inventory,
        data => {
            const list = Array.isArray(data)
                ? data
                : data?.items || data?.content || [];

            dashboardState.inventory = list.map(mapInventory);
            renderInventory(dashboardState.inventory);
        },
        "Không thể tải tồn kho"
    );
}

/*
 * 10. RENDER SUMMARY
 */

function renderSummary(data) {
    if (!data) {
        setText("totalRevenue", "--");
        setText("revenueComparison", "Chưa có dữ liệu thống kê");
        setText("totalOrders", "--");
        setText("orderDescription", "Chưa có dữ liệu thống kê");
        setText("chartTotalRevenue", "--");

        return;
    }

    setText("totalRevenue", formatCurrency(data.totalRevenue));
    setText(
        "revenueComparison",
        data.revenueChange !== undefined && data.revenueChange !== null
            ? `Mức thay đổi: ${data.revenueChange}%`
            : "Không có thông tin so sánh"
    );

    setText("totalOrders", formatNumber(data.totalOrders));
    setText(
        "orderDescription",
        data.pendingOrders !== undefined
            ? `Đơn đang chờ: ${formatNumber(data.pendingOrders)}`
            : "Tổng số đơn hàng"
    );

    setText("chartTotalRevenue", formatCurrency(data.totalRevenue));
}

/*
 * 11. RENDER REVENUE CHART
 *
 * Vẽ biểu đồ bằng Canvas thuần.
 * Chỉ vẽ khi API trả về dữ liệu thực.
 */

function renderRevenueChart(items) {
    const container = getElement("revenueChartContainer");

    if (!container) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        setEmptyState(
            "revenueChartContainer",
            "Chưa có dữ liệu biểu đồ",
            "Dữ liệu sẽ được hiển thị khi API thống kê được kết nối.",
            "bar_chart"
        );

        setText("chartDataCount", "--");
        return;
    }

    setText("chartDataCount", formatNumber(items.length));

    container.innerHTML = `
        <canvas id="revenueCanvas" aria-label="Biểu đồ doanh thu"></canvas>
    `;

    const canvas = getElement("revenueCanvas");
    const context = canvas.getContext("2d");

    const width = container.clientWidth;
    const height = 235;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.scale(ratio, ratio);

    const values = items.map(item => Number(item.revenue) || 0);
    const maxValue = Math.max(...values, 1);

    const padding = {
        top: 18,
        right: 15,
        bottom: 42,
        left: 15
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Grid
    context.strokeStyle = "#eaedff";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);

    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;

        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
    }

    context.setLineDash([]);

    const slotWidth = chartWidth / items.length;
    const barWidth = Math.min(28, slotWidth * 0.48);

    values.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
        const y = padding.top + chartHeight - barHeight;

        context.fillStyle = "#006b2c";

        context.beginPath();
        context.roundRect(
            x,
            y,
            barWidth,
            Math.max(barHeight, 2),
            4
        );
        context.fill();

        const label = String(items[index].label ?? "");

        context.fillStyle = "#647064";
        context.font = "10px Be Vietnam Pro";
        context.textAlign = "center";

        context.fillText(
            label.length > 12 ? label.substring(0, 12) : label,
            x + barWidth / 2,
            height - 15
        );
    });
}

/*
 * 12. RENDER BRANCHES
 */

function renderBranches(items) {
    const container = getElement("branchList");

    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        setEmptyState(
            "branchList",
            "Chưa có dữ liệu chi nhánh",
            "Không có dữ liệu để hiển thị.",
            "storefront"
        );
        return;
    }

    container.innerHTML = items.map(branch => {
        const occupied = Number(branch.occupiedTables);
        const total = Number(branch.totalTables);

        const hasCapacity =
            Number.isFinite(occupied) &&
            Number.isFinite(total) &&
            total > 0;

        const percentage = hasCapacity
            ? Math.min(100, Math.max(0, occupied / total * 100))
            : null;

        return `
            <article class="branch-card">
                <div class="branch-card-header">
                    <div>
                        <div class="branch-location">
                            ${escapeHTML(branch.address || "Chưa có địa chỉ")}
                        </div>
                        <div class="branch-name">
                            ${escapeHTML(branch.name || "Chưa có tên chi nhánh")}
                        </div>
                    </div>

                    <span class="status-pill">
                        ${percentage === null ? "Chưa có dữ liệu" : `${percentage.toFixed(1)}%`}
                    </span>
                </div>

                <div class="branch-card-footer">
                    <div>
                        <div class="branch-metric-label">Doanh thu</div>
                        <div class="branch-metric-value">
                            ${formatCurrency(branch.revenue)}
                        </div>
                    </div>

                    <div class="branch-metric-label">
                        ${
                            hasCapacity
                                ? `${formatNumber(occupied)} / ${formatNumber(total)} bàn`
                                : "Chưa có thông tin bàn"
                        }
                    </div>
                </div>

                <div class="branch-capacity">
                    <div class="branch-capacity-fill"
                         style="width: ${percentage ?? 0}%"></div>
                </div>
            </article>
        `;
    }).join("");
}

function renderBranchFilter(items) {
    const select = getElement("branchFilter");

    if (!select) {
        return;
    }

    const currentValue = select.value;

    select.innerHTML = `
        <option value="">Tất cả chi nhánh</option>
        ${items.map(branch => `
            <option value="${escapeHTML(branch.id)}">
                ${escapeHTML(branch.name || "Chi nhánh")}
            </option>
        `).join("")}
    `;

    if (items.some(item => String(item.id) === currentValue)) {
        select.value = currentValue;
    }
}

/*
 * 13. RENDER URGENT ITEMS
 */

function renderUrgentItems(items) {
    const container = getElement("urgentList");

    if (!container) {
        return;
    }

    setText("urgentCount", formatNumber(items.length));

    if (!items || items.length === 0) {
        setEmptyState(
            "urgentList",
            "Chưa có yêu cầu cần xử lý",
            "Dữ liệu sẽ xuất hiện khi có API tương ứng.",
            "priority_high"
        );
        return;
    }

    container.innerHTML = items.map(item => `
        <article class="urgent-item">
            <div class="urgent-content">
                <div class="urgent-title">
                    ${escapeHTML(item.title || "Yêu cầu chưa có tiêu đề")}
                </div>

                <p class="urgent-description">
                    ${escapeHTML(item.description || "Không có mô tả")}
                </p>

                <div class="urgent-meta">
                    ${item.branchName
                        ? `<span>${escapeHTML(item.branchName)}</span>`
                        : ""}
                    ${item.createdAt
                        ? `<span>${escapeHTML(formatDateTime(item.createdAt))}</span>`
                        : ""}
                    ${item.status
                        ? `<span>${escapeHTML(item.status)}</span>`
                        : ""}
                </div>
            </div>
        </article>
    `).join("");
}

/*
 * 14. RENDER KITCHEN
 */

function renderKitchen(data) {
    if (!data) {
        setText("kdsWaiting", "--");
        setText("kdsProcessing", "--");
        setText("kdsDelayed", "--");

        const status = getElement("kdsStatus");

        if (status) {
            status.innerHTML = `
                <span class="material-symbols-outlined">info</span>
                <span>Chưa có dữ liệu trạng thái bếp.</span>
            `;
        }

        return;
    }

    setText("kdsWaiting", formatNumber(data.waiting));
    setText("kdsProcessing", formatNumber(data.processing));
    setText("kdsDelayed", formatNumber(data.delayed));

    const status = getElement("kdsStatus");

    if (status) {
        status.innerHTML = `
            <span class="material-symbols-outlined">info</span>
            <span>${escapeHTML(data.message || "Đã tải dữ liệu trạng thái bếp.")}</span>
        `;
    }
}

/*
 * 15. RENDER RECENT RESERVATIONS
 */

function renderRecentReservations(items) {
    const container = getElement("recentReservations");

    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        setEmptyState(
            "recentReservations",
            "Chưa có dữ liệu đặt bàn",
            "Danh sách sẽ hiển thị khi kết nối API.",
            "event_busy"
        );
        return;
    }

    container.innerHTML = items.map(item => `
        <article class="recent-item">
            <div class="recent-icon">
                <span class="material-symbols-outlined">event</span>
            </div>

            <div class="recent-info">
                <strong>
                    ${escapeHTML(item.customerName || "Khách hàng")}
                </strong>

                <p>
                    ${escapeHTML(item.branchName || "Chưa có chi nhánh")}
                    ${item.guestCount !== undefined && item.guestCount !== null
                        ? ` · ${formatNumber(item.guestCount)} khách`
                        : ""}
                </p>

                <p>
                    ${escapeHTML(formatDateTime(item.reservationTime))}
                </p>
            </div>
        </article>
    `).join("");
}

/*
 * 16. RENDER INVENTORY
 */

function renderInventory(items) {
    const container = getElement("inventoryList");

    if (!container) {
        return;
    }

    if (!items || items.length === 0) {
        setEmptyState(
            "inventoryList",
            "Chưa có dữ liệu tồn kho",
            "Chưa có thông tin nguyên liệu để hiển thị.",
            "inventory"
        );
        return;
    }

    container.innerHTML = items.map(item => `
        <article class="inventory-item">
            <div class="inventory-info">
                <strong>${escapeHTML(item.name || "Nguyên liệu")}</strong>
                <span>${escapeHTML(item.status || "Chưa có trạng thái")}</span>
            </div>

            <div class="inventory-quantity">
                <strong>
                    ${formatNumber(item.quantity)}
                    ${escapeHTML(item.unit || "")}
                </strong>
            </div>
        </article>
    `).join("");
}

/*
 * 17. ADMIN PROFILE
 */

async function loadCurrentUser() {
    const endpoint = API_ENDPOINTS.currentUser;

    if (!endpoint) {
        setText("sidebarAdminName", "Quản trị viên");
        setText("sidebarAdminEmail", "Chưa tải được thông tin");
        setText("topbarAdminName", "Quản trị viên");
        return;
    }

    await loadEndpoint(
        endpoint,
        data => {
            const user = data?.account ?? data?.user ?? data;

            const name =
                user?.fullName ??
                user?.username ??
                user?.name ??
                "Quản trị viên";

            const email = user?.email ?? "";

            setText("sidebarAdminName", name);
            setText("sidebarAdminEmail", email);
            setText("topbarAdminName", name);
        },
        "Không thể tải thông tin quản trị viên"
    );
}

/*
 * 18. LOAD ALL DASHBOARD DATA
 */

async function loadDashboard() {
    const refreshButton = getElement("refreshButton");

    if (refreshButton) {
        refreshButton.disabled = true;
        refreshButton.classList.add("loading");
    }

    try {
        await Promise.allSettled([
            loadSummary(),
            loadRevenue(),
            loadBranches(),
            loadUrgentItems(),
            loadKitchenStatus(),
            loadRecentReservations(),
            loadInventory()
        ]);

        setText(
            "lastUpdated",
            `Cập nhật lúc ${new Date().toLocaleTimeString("vi-VN")}`
        );
    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.classList.remove("loading");
        }
    }
}

/*
 * 19. PERIOD FILTER
 */

function initializePeriodFilter() {
    const buttons = document.querySelectorAll(".filter-button");

    buttons.forEach(button => {
        button.addEventListener("click", async () => {
            const period = button.dataset.period;

            if (!period || period === dashboardState.period) {
                return;
            }

            dashboardState.period = period;

            buttons.forEach(item => {
                item.classList.toggle("active", item === button);
            });

            await Promise.allSettled([
                loadSummary(),
                loadRevenue()
            ]);
        });
    });
}

/*
 * 20. BRANCH FILTER
 */

function initializeBranchFilter() {
    const select = getElement("branchFilter");

    if (!select) {
        return;
    }

    select.addEventListener("change", async () => {
        dashboardState.branchId = select.value;

        await Promise.allSettled([
            loadSummary(),
            loadRevenue(),
            loadUrgentItems(),
            loadKitchenStatus(),
            loadRecentReservations(),
            loadInventory()
        ]);
    });
}

/*
 * 21. REFRESH BUTTON
 */

function initializeRefreshButton() {
    const button = getElement("refreshButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", async () => {
        await loadDashboard();
    });
}

/*
 * 22. EXPORT BUTTON
 *
 * Chưa có API xuất báo cáo nên không giả lập tải file.
 */

function initializeExportButton() {
    const button = getElement("exportButton");

    if (!button) {
        return;
    }

    button.disabled = true;
    button.title = "Backend chưa hỗ trợ xuất báo cáo";
}

/*
 * 23. GLOBAL SEARCH
 *
 * Hiện tại chỉ tìm trong dữ liệu đã tải trên trang.
 * Không gọi API tìm kiếm khi chưa có endpoint.
 */

function initializeGlobalSearch() {
    const input = getElement("globalSearch");

    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        const keyword = input.value.trim().toLowerCase();

        document.querySelectorAll(
            ".branch-card, .urgent-item, .recent-item, .inventory-item"
        ).forEach(item => {
            item.style.display = item.textContent
                .toLowerCase()
                .includes(keyword)
                ? ""
                : "none";
        });
    });
}

/*
 * 24. MOBILE SIDEBAR
 */

function initializeMobileMenu() {
    const button = getElement("mobileMenuButton");
    const sidebar = getElement("sidebar");

    if (!button || !sidebar || sidebar.classList.contains("admin-shell-sidebar")) {
        return;
    }

    button.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 700 &&
            sidebar.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !button.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });
}

/*
 * 25. LOGOUT
 *
 * Sửa đường dẫn LOGIN_PAGE theo tên file đăng nhập thực tế.
 */

/*
 * 26. NOTIFICATION
 *
 * Chưa có API thông báo nên không hiển thị thông báo giả.
 */

function initializeNotification() {
    const button = getElement("notificationButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", () => {
        showToast("Chưa cấu hình chức năng thông báo.", "error");
    });
}

/*
 * 27. INITIALIZE
 */

async function initializeDashboard() {
    initializePeriodFilter();
    initializeBranchFilter();
    initializeRefreshButton();
    initializeExportButton();
    initializeGlobalSearch();
    initializeMobileMenu();
    initializeNotification();

    await Promise.allSettled([
        loadCurrentUser(),
        loadDashboard()
    ]);
}

document.addEventListener("DOMContentLoaded", initializeDashboard);
