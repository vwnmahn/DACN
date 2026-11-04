
"use strict";

/* =========================================
   FCA CULINARY - ADMIN BRANCH MANAGEMENT
========================================= */

const API_BASE = "http://localhost:8080/api/v1";

const API_ENDPOINTS = {
    list: "/admin/restaurants?size=100&sortBy=id&sortDirection=asc",
    create: "/restaurants",
    update: "/restaurants",
    delete: "/restaurants",
    status: "/restaurants",
    confirmationMode: restaurantId => `/admin/restaurants/${restaurantId}/confirmation-mode`,
    menuItemsByRestaurant: "/menu-items/restaurant",
    workforce: restaurantId => `/admin/restaurants/${restaurantId}`
};

const AUTH_TOKEN_KEY = "adminAccessToken";

const state = {
    branches: [],
    filteredBranches: [],

    selectedBranchId: null,
    editingBranchId: null,

    keyword: "",
    status: "",

    currentPage: 1,
    pageSize: 5,

    loading: false,
    menuItems: [],
    menuLoadingFor: null,
    employees: [],
    allEmployees: []
};

const $ = id => document.getElementById(id);
let pendingDeleteBranch = null;
let deleteBranchPending = false;

/* =========================================
   FORMAT
========================================= */

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? new Intl.NumberFormat("vi-VN").format(number)
        : "—";
}

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );
}

function frontendAssetUrl(path) {
    const prefix = window.location.pathname.startsWith("/FE/") ? "/FE" : "";
    return new URL(`${prefix}/${String(path).replace(/^\/+/, "")}`, window.location.origin).href;
}

function resolveImageUrl(value) {
    const url = String(value ?? "").trim();
    if (!url) return "";

    const normalized = url.replace(/\\/g, "/");
    if (/^(?:https?:|data:|blob:)/i.test(normalized)) {
        try {
            return new URL(normalized, window.location.href).href;
        } catch (_error) {
            return url;
        }
    }
    const imagesIndex = normalized.toLowerCase().indexOf("/images/");
    if (imagesIndex >= 0) {
        return frontendAssetUrl(normalized.slice(imagesIndex + 1));
    }
    if (/^images\//i.test(normalized)) {
        return frontendAssetUrl(normalized);
    }
    if (/^(?:restaurant\/)?fca test\//i.test(normalized)) {
        return frontendAssetUrl(`images/restaurant/${normalized.replace(/^restaurant\//i, "")}`);
    }
    if (/^(?:anh-pho|pho-thai-1|quan-pho-sang-trong)\.jpg$/i.test(normalized)) {
        return frontendAssetUrl(`images/restaurant/FCA Test/${normalized}`);
    }

    try {
        const parsed = new URL(url, window.location.href);
        return parsed.href;
    } catch (_error) {
        return url;
    }
}

const RESTAURANT_IMAGE_FALLBACK = frontendAssetUrl("images/restaurant/FCA Test/quan-pho-sang-trong.jpg");

function updateBranchImagePreview() {
    const preview = $("branch-image-preview");
    const image = preview.querySelector("img");
    const value = $("branch-image-url").value.trim();
    preview.classList.toggle("empty", !value);
    image.removeAttribute("src");
    if (value) {
        image.onerror = () => {
            image.onerror = null;
            image.src = RESTAURANT_IMAGE_FALLBACK;
        };
        image.src = resolveImageUrl(value);
    }
}

/* =========================================
   MESSAGE
========================================= */

function showMessage(message, type = "info") {

    const element = $("page-message");

    element.textContent = message;

    element.className = "message";

    if (type === "error") {
        element.classList.add("error");
    }

    if (type === "success") {
        element.classList.add("success");
    }

    element.classList.remove("hidden");
}

function hideMessage() {
    $("page-message").classList.add("hidden");
}

/* =========================================
   LOADING
========================================= */

function setLoading(loading) {

    state.loading = loading;

    $("add-branch-btn").disabled = loading;
}

/* =========================================
   API
========================================= */

async function apiRequest(endpoint, options = {}) {

    if (!endpoint) {
        throw new Error(
            "API endpoint chưa được cấu hình."
        );
    }

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (
        options.body &&
        !(options.body instanceof FormData)
    ) {
        headers["Content-Type"] = "application/json";
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const url = endpoint.startsWith("http")
        ? endpoint
        : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        throw new Error(
            "Phiên đăng nhập đã hết hạn hoặc chưa được xác thực."
        );
    }

    if (response.status === 403) {
        throw new Error(
            "Bạn không có quyền thực hiện thao tác này."
        );
    }

    if (!response.ok) {

        const errorText = await response.text();
        let errorMessage = errorText;

        try {
            const errorBody = JSON.parse(errorText);
            errorMessage = errorBody.message || errorBody.error || errorText;
        } catch {
            // Giữ nguyên nội dung lỗi dạng text.
        }

        throw new Error(errorMessage || `Backend trả về lỗi HTTP ${response.status}.`);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType =
        response.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
        const body = await response.json();

        if (
            body &&
            typeof body === "object" &&
            typeof body.code === "number" &&
            body.code !== 1000
        ) {
            throw new Error(body.message || "Backend không xử lý được yêu cầu.");
        }

        return body;
    }

    return response;
}

/* =========================================
   RESPONSE ADAPTER
========================================= */

function normalizeBranch(raw) {

    return {
        id: raw.id ?? null,
        name: raw.name ?? "",
        address: raw.address ?? "",
        status: raw.active === true ? "ACTIVE" : "INACTIVE",
        active: raw.active === true,
        phone: raw.phoneNumber ?? "",
        openingTime: raw.openingTime ?? "",
        closingTime: raw.closingTime ?? "",
        deliveryFee: raw.deliveryFee ?? null,
        deliveryRadiusKm: raw.deliveryRadiusKm ?? null,
        latitude: raw.latitude ?? null,
        longitude: raw.longitude ?? null,
        baseDistanceKm: raw.baseDistanceKm ?? null,
        additionalFeePerKm: raw.additionalFeePerKm ?? null,
        imageUrl: resolveImageUrl(raw.imageUrl) || RESTAURANT_IMAGE_FALLBACK,
        imageUrl2: resolveImageUrl(raw.imageUrl2),
        imageUrl3: resolveImageUrl(raw.imageUrl3),
        categoryStatus: raw.categoryStatus ?? "",
        orderConfirmationMode: raw.orderConfirmationMode ?? ""
    };
}

/*
 * Hỗ trợ response dạng:
 * - Array
 * - { data: [...] }
 * - { content: [...] }
 *
 * Cần điều chỉnh nếu ApiResponse dự án
 * có cấu trúc khác.
 */

function extractBranchList(response) {

    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.data)) {
        return response.data;
    }

    if (Array.isArray(response?.content)) {
        return response.content;
    }

    if (Array.isArray(response?.data?.content)) {
        return response.data.content;
    }

    if (Array.isArray(response?.result)) {
        return response.result;
    }

    throw new Error("Phản hồi danh sách nhà hàng không đúng cấu trúc ApiResponse của Backend.");
}

/* =========================================
   LOAD BRANCHES
========================================= */

async function loadBranches() {

    if (state.loading) return;

    hideMessage();

    setLoading(true);

    try {

        const response = await apiRequest(
            API_ENDPOINTS.list
        );

        const rawBranches = extractBranchList(response);

        state.branches = rawBranches.map(
            normalizeBranch
        );

        state.branches = state.branches.filter(
            branch => branch.id !== null
        );

        applyFilters();

        if (
            state.selectedBranchId !== null &&
            !state.branches.some(
                branch =>
                    String(branch.id) ===
                    String(state.selectedBranchId)
            )
        ) {
            state.selectedBranchId = null;
        }

        renderAll();

    } catch (error) {

        console.error(
            "Lỗi tải danh sách chi nhánh:",
            error
        );

        state.branches = [];
        state.filteredBranches = [];

        renderAll();

        showMessage(error.message, "error");

    } finally {

        setLoading(false);

    }
}

/* =========================================
   STATUS
========================================= */

const STATUS_CONFIG = {

    ACTIVE: {
        label: "Đang hoạt động",
        className: "active"
    },

    INACTIVE: {
        label: "Ngừng hoạt động",
        className: "inactive"
    }

};

function getStatus(status) {

    const normalized = String(
        status ?? ""
    ).toUpperCase();

    return STATUS_CONFIG[normalized] || {
        label: status || "Chưa xác định",
        className: "inactive"
    };
}

/* =========================================
   STATISTICS
========================================= */

/*
 * Số liệu được tính trực tiếp từ danh sách
 * chi nhánh Backend trả về.
 *
 * Không tạo số liệu mặc định.
 */

function renderStatistics() {

    const branches = state.branches;

    $("total-branches").textContent =
        formatNumber(branches.length);

    $("active-branches").textContent =
        formatNumber(
            branches.filter(
                branch =>
                    String(branch.status).toUpperCase() === "ACTIVE"
            ).length
        );

    $("upcoming-branches").textContent =
        formatNumber(
            branches.filter(
                branch =>
                    branch.orderConfirmationMode === "AUTO"
            ).length
        );

    $("inactive-branches").textContent =
        formatNumber(
            branches.filter(
                branch =>
                    String(branch.status).toUpperCase() === "INACTIVE"
            ).length
        );
}

/* =========================================
   FILTER
========================================= */

function applyFilters() {

    const keyword = state.keyword
        .trim()
        .toLocaleLowerCase("vi");

    const status = state.status.toUpperCase();

    state.filteredBranches = state.branches.filter(
        branch => {

            const searchableText = [
                branch.name,
                branch.address,
                branch.phone,
                branch.categoryStatus
            ]
                .join(" ")
                .toLocaleLowerCase("vi");

            const matchKeyword =
                !keyword ||
                searchableText.includes(keyword);

            const matchStatus =
                !status ||
                String(branch.status).toUpperCase() === status;

            return matchKeyword && matchStatus;
        }
    );

    state.currentPage = 1;

    renderBranchList();
    renderPagination();
}

/* =========================================
   PAGINATION
========================================= */

function getCurrentPageBranches() {

    const start =
        (state.currentPage - 1) * state.pageSize;

    return state.filteredBranches.slice(
        start,
        start + state.pageSize
    );
}

function renderPagination() {

    const total = state.filteredBranches.length;

    const totalPages = Math.ceil(
        total / state.pageSize
    );

    $("page-information").textContent =
        totalPages > 0
            ? `Trang ${state.currentPage}/${totalPages}`
            : "Chưa có trang";

    $("previous-page").disabled =
        state.currentPage <= 1;

    $("next-page").disabled =
        state.currentPage >= totalPages ||
        totalPages === 0;

    $("branch-result-count").textContent =
        `Hiển thị ${getCurrentPageBranches().length} / ${total} chi nhánh`;
}

function changePage(direction) {

    const totalPages = Math.ceil(
        state.filteredBranches.length /
        state.pageSize
    );

    const nextPage =
        state.currentPage + direction;

    if (nextPage < 1 || nextPage > totalPages) {
        return;
    }

    state.currentPage = nextPage;

    renderBranchList();
    renderPagination();
}

/* =========================================
   BRANCH LIST
========================================= */

function renderBranchList() {

    const container = $("branch-list");

    const branches = getCurrentPageBranches();

    if (branches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">
                    storefront
                </span>
                Không tìm thấy chi nhánh phù hợp.
            </div>
        `;

        return;
    }

    container.innerHTML = branches.map(branch => {

        const status = getStatus(branch.status);

        const selected =
            String(branch.id) ===
            String(state.selectedBranchId);

        return `
            <article
                class="branch-card ${selected ? "selected" : ""}"
                data-id="${escapeHTML(branch.id)}"
            >

                <div class="branch-card-top">

                    <div class="branch-main-info">

                        ${branch.imageUrl ? `<img class="branch-image" src="${escapeHTML(branch.imageUrl)}" alt="${escapeHTML(branch.name || "Nhà hàng")}" onerror="this.onerror=null;this.src='${escapeHTML(RESTAURANT_IMAGE_FALLBACK)}'">` : `
                            <div class="branch-symbol"><span class="material-symbols-outlined">storefront</span></div>`}

                        <div>

                            <span class="status ${status.className}">
                                ${escapeHTML(status.label)}
                            </span>

                            <h3 class="branch-name">
                                ${escapeHTML(branch.name || "Chưa có tên")}
                            </h3>

                            <p class="branch-address">
                                <span class="material-symbols-outlined">
                                    location_on
                                </span>
                                ${escapeHTML(branch.address || "Chưa có địa chỉ")}
                            </p>

                        </div>

                    </div>

                </div>

                <div class="branch-meta">

                    <div>
                        <span>Danh mục</span>
                        <strong>
                            ${escapeHTML(branch.categoryStatus || "—")}
                        </strong>
                    </div>

                    <div>
                        <span>Giờ hoạt động</span>
                        <strong>
                            ${escapeHTML(branch.openingTime || "—")} – ${escapeHTML(branch.closingTime || "—")}
                        </strong>
                    </div>

                    <div>
                        <span>Hotline</span>
                        <strong>
                            ${escapeHTML(branch.phone || "—")}
                        </strong>
                    </div>

                </div>

                <div class="branch-actions">

                    <button
                        type="button"
                        data-action="detail"
                        data-id="${escapeHTML(branch.id)}"
                    >
                        <span class="material-symbols-outlined">
                            visibility
                        </span>
                        Chi tiết
                    </button>

                    <button
                        type="button"
                        data-action="edit"
                        data-id="${escapeHTML(branch.id)}"
                    >
                        <span class="material-symbols-outlined">
                            edit
                        </span>
                        Chỉnh sửa
                    </button>

                    <button
                        type="button"
                        class="danger-action"
                        data-action="delete"
                        data-id="${escapeHTML(branch.id)}"
                    >
                        <span class="material-symbols-outlined">delete</span>
                        Xóa
                    </button>

                </div>

            </article>
        `;

    }).join("");

}

/* =========================================
   BRANCH DETAIL
========================================= */

function renderBranchDetail() {

    const container = $("branch-detail-content");

    const branch = state.branches.find(
        item =>
            String(item.id) ===
            String(state.selectedBranchId)
    );

    if (!branch) {

        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">
                    info
                </span>
                Chọn một chi nhánh trong danh sách
                để xem thông tin.
            </div>
        `;

        $("edit-selected-btn").disabled = true;

        return;
    }

    const status = getStatus(branch.status);

    container.innerHTML = `
        <div class="branch-detail-hero">
            ${branch.imageUrl ? `<img class="branch-detail-image" src="${escapeHTML(resolveImageUrl(branch.imageUrl))}" alt="${escapeHTML(branch.name || "Nhà hàng")}" onerror="this.onerror=null;this.src='${escapeHTML(RESTAURANT_IMAGE_FALLBACK)}'">` : `<div class="branch-detail-image branch-detail-placeholder"><span class="material-symbols-outlined">storefront</span></div>`}
            <div><span class="status ${status.className}">${escapeHTML(status.label)}</span><h3 class="detail-name">${escapeHTML(branch.name || "Chưa có tên")}</h3><p>${escapeHTML(branch.address || "Chưa có địa chỉ")}</p></div>
        </div>
        <section class="detail-group"><h4>Thông tin liên hệ &amp; vận hành</h4><div class="detail-grid">
            <div class="detail-item"><span>Số điện thoại</span><strong>${escapeHTML(branch.phone || "—")}</strong></div>
            <div class="detail-item"><span>Danh mục</span><strong>${escapeHTML(branch.categoryStatus || "—")}</strong></div>
            <div class="detail-item"><span>Giờ hoạt động</span><strong>${escapeHTML(branch.openingTime || "—")} – ${escapeHTML(branch.closingTime || "—")}</strong></div>
            <div class="detail-item"><span>Xác nhận đơn</span><strong>${escapeHTML(branch.orderConfirmationMode || "—")}</strong></div>
        </div></section>
        <section class="detail-group"><h4>Giao hàng &amp; vị trí</h4><div class="detail-grid">
            <div class="detail-item"><span>Phí giao hàng</span><strong>${branch.deliveryFee !== null ? formatNumber(branch.deliveryFee) + "đ" : "—"}</strong></div>
            <div class="detail-item"><span>Bán kính giao hàng</span><strong>${branch.deliveryRadiusKm !== null ? formatNumber(branch.deliveryRadiusKm) + " km" : "—"}</strong></div>
            <div class="detail-item detail-wide"><span>Địa chỉ</span><strong>${escapeHTML(branch.address || "—")}</strong></div>
            <div class="detail-item detail-wide"><span>Tọa độ</span><strong>${escapeHTML(branch.latitude ?? "—")}, ${escapeHTML(branch.longitude ?? "—")}</strong></div>
        </div></section>`;

    $("edit-selected-btn").disabled = false;
}

function extractMenuItems(response) {
    const data = response?.data ?? response;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    return [];
}

function renderBranchMenu(branchId, status = "ready", error = "") {
    const container = $("branch-menu-content");
    if (status === "loading") {
        container.innerHTML = '<div class="menu-state"><span class="material-symbols-outlined spinning">progress_activity</span><strong>Đang tải món ăn...</strong></div>';
        return;
    }
    if (status === "error") {
        container.innerHTML = `<div class="menu-state error"><span class="material-symbols-outlined">error</span><strong>Không thể tải món ăn</strong><p>${escapeHTML(error)}</p></div>`;
        return;
    }
    const items = state.menuItems.filter(item => String(item.restaurantId) === String(branchId));
    if (!items.length) {
        container.innerHTML = '<div class="menu-state"><span class="material-symbols-outlined">restaurant_menu</span><strong>Nhà hàng chưa có món ăn</strong></div>';
        return;
    }
    container.innerHTML = `<div class="branch-menu-list">${items.map(item => `
        <article class="branch-menu-item">
            ${item.imageUrl ? `<img class="branch-menu-image" src="${escapeHTML(resolveImageUrl(item.imageUrl))}" alt="${escapeHTML(item.name || "Món ăn")}">` : ""}
            <div><strong>${escapeHTML(item.name || "Chưa có tên")}</strong><span>${formatNumber(item.price)}đ</span></div>
            <div class="menu-item-statuses">
                <span class="status ${item.active === true ? "active" : "maintenance"}">${item.active === true ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
                <span class="status ${item.available === true ? "active" : "upcoming"}">${item.available === true ? "Còn phục vụ" : "Tạm hết"}</span>
            </div>
            <div class="menu-item-actions">
                <a href="menu-management.html?restaurantId=${encodeURIComponent(branchId)}&dishId=${encodeURIComponent(item.id)}&action=view">Xem</a>
                <a href="menu-management.html?restaurantId=${encodeURIComponent(branchId)}&dishId=${encodeURIComponent(item.id)}&action=edit">Chỉnh sửa</a>
            </div>
        </article>`).join("")}</div>`;
}

async function loadBranchMenu(branchId) {
    state.menuLoadingFor = String(branchId);
    renderBranchMenu(branchId, "loading");
    try {
        const response = await apiRequest(
            `${API_ENDPOINTS.menuItemsByRestaurant}/${encodeURIComponent(branchId)}?availableOnly=false`
        );
        if (state.menuLoadingFor !== String(branchId)) return;
        state.menuItems = extractMenuItems(response);
        renderBranchMenu(branchId);
    } catch (error) {
        if (state.menuLoadingFor === String(branchId)) renderBranchMenu(branchId, "error", error.message);
    }
}

const workforceLabels = {MANAGER:"Quản lý",CASHIER:"Thu ngân",CHEF:"Đầu bếp",SERVER:"Phục vụ",SHIPPER:"Shipper",OTHER:"Khác"};
const employmentLabels = {ACTIVE:"Đang làm việc",PENDING_TERMINATION:"Chờ chấm dứt hợp đồng",TERMINATED:"Đã chấm dứt hợp đồng"};
const responseData = response => response?.data ?? response;

async function loadEmployees() {
    const container = $("employee-list");
    const restaurantId = state.selectedBranchId;
    container.innerHTML = '<div class="empty-state">Đang tải nhân sự…</div>';
    $("total-employee-count").textContent = "…";
    $("active-employee-count").textContent = "…";
    $("active-shipper-count").textContent = "…";
    try {
        const response = await apiRequest(`${API_ENDPOINTS.workforce(restaurantId)}/employees`);
        if (String(state.selectedBranchId) !== String(restaurantId)) return;
        state.allEmployees = responseData(response) || [];
        filterEmployees();
    } catch (error) {
        state.allEmployees = [];
        state.employees = [];
        $("total-employee-count").textContent = "—";
        $("active-employee-count").textContent = "—";
        $("active-shipper-count").textContent = "—";
        $("workforce-summary").replaceChildren();
        container.innerHTML = `<div class="empty-state error">${escapeHTML(error.message)}</div>`;
    }
}

function filterEmployees() {
    const keyword = $("employee-search").value.trim().toLocaleLowerCase("vi");
    const position = $("employee-position-filter").value;
    const status = $("employee-status-filter").value;
    state.employees = state.allEmployees.filter(employee => {
        const searchable = [employee.fullName, employee.phoneNumber, employee.employeeCode]
            .map(value => String(value || "").toLocaleLowerCase("vi"));
        return (!keyword || searchable.some(value => value.includes(keyword)))
            && (!position || employee.position === position)
            && (!status || employee.status === status);
    });
    renderEmployees();
}

function renderEmployees() {
    const active = state.allEmployees.filter(employee => employee.status === "ACTIVE");
    const groups = active.reduce((result, employee) => ((result[employee.position] = (result[employee.position] || 0) + 1), result), {});
    $("total-employee-count").textContent = state.allEmployees.length;
    $("active-employee-count").textContent = active.length;
    $("active-shipper-count").textContent = groups.SHIPPER || 0;
    $("workforce-summary").innerHTML = Object.entries(workforceLabels).map(([key,label]) => `<button type="button" data-position-summary="${key}"><strong>${groups[key] || 0}</strong><span>${label}</span></button>`).join("");
    const rows = state.employees.map(employee => {
        const remaining = employee.status === "PENDING_TERMINATION" ? Math.max(0, Math.ceil((new Date(employee.terminationEffectiveAt) - Date.now()) / 86400000)) : null;
        return `<tr><td><strong>${escapeHTML(employee.fullName)}</strong><small>${escapeHTML(employee.employeeCode)}</small></td><td>${escapeHTML(employee.phoneNumber)}</td><td>${escapeHTML(workforceLabels[employee.position] || employee.position)}</td><td><strong>${formatNumber(employee.monthlySalary)}đ</strong><small>/ tháng</small></td><td><span class="employee-status ${employee.status.toLowerCase()}">${escapeHTML(employmentLabels[employee.status] || employee.status)}</span>${remaining !== null ? `<small class="termination-note">Còn khoảng ${remaining} ngày</small>` : ""}</td><td><div class="employee-actions"><button data-employee-view="${employee.id}">Xem</button>${employee.status !== "TERMINATED" ? `<button data-employee-edit="${employee.id}">Sửa</button><button data-employee-salary="${employee.id}">Cập nhật lương</button>` : ""}<button data-employee-history="${employee.id}">Lịch sử</button>${employee.status === "ACTIVE" ? `<button class="danger" data-employee-terminate="${employee.id}">Nghỉ việc</button>` : ""}${employee.status === "PENDING_TERMINATION" ? `<button data-employee-cancel="${employee.id}">Hủy yêu cầu</button>` : ""}</div></td></tr>`;
    }).join("");
    $("employee-list").innerHTML = rows ? `<div class="employee-table-wrap"><table class="employee-table"><thead><tr><th>Nhân viên</th><th>Liên hệ</th><th>Vai trò</th><th>Lương hiện tại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Không có hồ sơ nhân sự phù hợp với bộ lọc.</div>';
}

function formatWorkforceDate(value, includeTime = false) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", includeTime ? {dateStyle:"short",timeStyle:"short"} : {dateStyle:"short"}).format(date);
}

function openEmployeeDetail(employee) {
    const termination = employee.status === "PENDING_TERMINATION" ? `<section class="employee-detail-alert"><strong>Đang chờ chấm dứt hợp đồng</strong><span>Lý do: ${escapeHTML(employee.terminationReason || "—")}</span><span>Yêu cầu lúc: ${escapeHTML(formatWorkforceDate(employee.terminationRequestedAt, true))}</span><span>Dự kiến hoàn tất: ${escapeHTML(formatWorkforceDate(employee.terminationEffectiveAt, true))}</span></section>` : "";
    openWorkforceInfoDialog(`Hồ sơ · ${employee.fullName}`, `<div class="employee-detail-grid"><span>Mã nhân viên<strong>${escapeHTML(employee.employeeCode)}</strong></span><span>Trạng thái<strong>${escapeHTML(employmentLabels[employee.status] || employee.status)}</strong></span><span>Số điện thoại<strong>${escapeHTML(employee.phoneNumber)}</strong></span><span>Vai trò<strong>${escapeHTML(workforceLabels[employee.position] || employee.position)}</strong></span><span>Ngày bắt đầu<strong>${escapeHTML(formatWorkforceDate(employee.startDate))}</strong></span><span>Lương hiện tại<strong>${formatNumber(employee.monthlySalary)}đ/tháng</strong></span><span class="wide">Ghi chú<strong>${escapeHTML(employee.note || "Không có ghi chú")}</strong></span></div>${termination}`);
}

function openWorkforceInfoDialog(title, body) {
    openWorkforceDialog(title, body, "Đóng", async () => {});
    const form = document.querySelector(".workforce-dialog form");
    const submit = form.querySelector('button[type="submit"]');
    submit.type = "button";
    submit.addEventListener("click", () => document.querySelector(".workforce-dialog")?.remove());
}

function openWorkforceDialog(title, body, submitLabel, onSubmit) {
    document.querySelector(".workforce-dialog")?.remove();
    const wrapper = document.createElement("div"); wrapper.className = "workforce-dialog";
    wrapper.innerHTML = `<button class="workforce-dialog-backdrop" aria-label="Đóng"></button><form class="workforce-dialog-card"><header><h3>${escapeHTML(title)}</h3><button type="button" data-dialog-close>×</button></header><div class="workforce-dialog-body">${body}</div><p class="workforce-dialog-error" hidden></p><footer><button type="button" data-dialog-close>Hủy</button><button class="btn-primary" type="submit">${escapeHTML(submitLabel)}</button></footer></form>`;
    document.body.appendChild(wrapper); const close = () => wrapper.remove();
    wrapper.querySelectorAll("[data-dialog-close],.workforce-dialog-backdrop").forEach(button => button.addEventListener("click", close));
    wrapper.querySelector("form").addEventListener("submit", async event => { event.preventDefault(); const submit=event.submitter; submit.disabled=true; submit.textContent="Đang xử lý…"; try { await onSubmit(new FormData(event.currentTarget)); close(); await loadEmployees(); } catch(error){const box=wrapper.querySelector(".workforce-dialog-error");box.hidden=false;box.textContent=error.message;submit.disabled=false;submit.textContent=submitLabel;} });
}

function openEmployeeForm(employee = null) {
    const value = key => escapeHTML(employee?.[key] ?? "");
    const positions = Object.entries(workforceLabels).map(([key,label]) => `<option value="${key}" ${employee?.position===key?"selected":""}>${label}</option>`).join("");
    openWorkforceDialog(employee ? "Chỉnh sửa nhân viên" : "Thêm nhân viên", `<label>Họ và tên<input name="fullName" required value="${value("fullName")}"></label><label>Số điện thoại<input name="phoneNumber" required value="${value("phoneNumber")}"></label><label>Chức vụ<select name="position" required>${positions}</select></label><label>Ngày bắt đầu<input name="startDate" type="date" required value="${value("startDate")}"></label><label>Lương tháng<input name="monthlySalary" type="number" min="0" required value="${value("monthlySalary")}"></label><label class="wide">Ghi chú<textarea name="note">${value("note")}</textarea></label>`, "Lưu", async form => { const payload=Object.fromEntries(form); payload.monthlySalary=Number(payload.monthlySalary); await apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees${employee?`/${employee.id}`:""}`, {method:employee?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); });
}

function openSalaryForm(employee) {
    const today = new Date().toISOString().slice(0, 10);
    openWorkforceDialog(`Cập nhật lương · ${employee.fullName}`, `<div class="salary-current"><span>Lương hiện tại</span><strong>${formatNumber(employee.monthlySalary)}đ/tháng</strong></div><label>Mức lương mới<input name="salary" type="number" min="0" required value="${escapeHTML(employee.monthlySalary)}"></label><label>Ngày hiệu lực<input name="effectiveFrom" type="date" required value="${today}"></label>`, "Cập nhật lương", async form => apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees/${employee.id}/salary`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({salary:Number(form.get("salary")),effectiveFrom:form.get("effectiveFrom")})}));
}

function openTermination(employee) {
    openWorkforceDialog("Chấm dứt hợp đồng", `<p>Nhân viên sẽ chuyển sang trạng thái chờ và chấm dứt chính thức sau 3 ngày.</p><label>Lý do<textarea name="reason" required minlength="3"></textarea></label>`, "Xác nhận chấm dứt", async form => apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees/${employee.id}/termination`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:form.get("reason")})}));
}

function openCancelTermination(employee) {
    openWorkforceDialog("Hủy yêu cầu chấm dứt hợp đồng", `<p>Xác nhận đưa <strong>${escapeHTML(employee.fullName)}</strong> trở lại trạng thái đang làm việc. Lịch sử yêu cầu trước đó vẫn được giữ.</p>`, "Xác nhận hủy yêu cầu", async () => apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees/${employee.id}/termination/cancel`, {method:"POST"}));
}

async function openEmployeeHistory(employee) {
    try {
        const base=`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees/${employee.id}`;
        const [salaryResponse,terminationResponse]=await Promise.all([apiRequest(`${base}/salary-history`),apiRequest(`${base}/termination-history`)]);
        const salary=responseData(salaryResponse)||[],termination=responseData(terminationResponse)||[];
        openWorkforceInfoDialog(`Lịch sử · ${employee.fullName}`, `<section class="history-block"><h4>Lịch sử thay đổi lương</h4>${salary.length?salary.map(item=>`<p><span>${escapeHTML(formatWorkforceDate(item.effectiveFrom))}</span><span>${formatNumber(item.oldSalary)}đ → <strong>${formatNumber(item.newSalary)}đ</strong></span></p>`).join(""):"<p>Chưa có lịch sử thay đổi lương.</p>"}</section><section class="history-block"><h4>Lịch sử hợp đồng</h4>${termination.length?termination.map(item=>`<p><span><strong>${escapeHTML(item.action)}</strong></span><span>${escapeHTML(item.reason)}${item.effectiveAt?` · hiệu lực ${escapeHTML(formatWorkforceDate(item.effectiveAt, true))}`:""}</span></p>`).join(""):"<p>Chưa có lịch sử nghỉ việc.</p>"}</section>`);
    } catch(error){showMessage(error.message,"error");}
}

async function loadCostReport() {
    const restaurantId = state.selectedBranchId;
    const [year,month] = $("cost-period").value.split("-"); if(!year||!month){showMessage("Hãy chọn tháng báo cáo.","error");return;}
    const report = $("cost-report");
    const button = $("load-cost-report-btn");
    report.innerHTML = '<div class="empty-state">Đang tải báo cáo chi phí…</div>';
    button.disabled = true;
    try { const data=responseData(await apiRequest(`${API_ENDPOINTS.workforce(restaurantId)}/cost-report?year=${year}&month=${Number(month)}`)); if(String(state.selectedBranchId)!==String(restaurantId))return; $("rent-amount").value=data.rentCost||0; $("rent-current-value").textContent=`${formatNumber(data.rentCost)}đ / tháng`; const roles=Object.entries(data.salaryByPosition||{}).map(([role,salary])=>`<li>${escapeHTML(workforceLabels[role]||role)}: ${data.employeeCountByPosition?.[role]||0} người · <strong>${formatNumber(salary)}đ</strong></li>`).join(""); const people=(data.includedEmployees||[]).map(item=>`<li>${escapeHTML(item.employeeCode)} · ${escapeHTML(item.fullName)} · ${escapeHTML(workforceLabels[item.position]||item.position)}</li>`).join(""); report.innerHTML=`<div class="cost-grid"><span>Nhân viên trong kỳ<strong>${data.activeEmployees}</strong></span><span>Shipper<strong>${data.activeShippers}</strong></span><span>Tổng lương<strong>${formatNumber(data.totalSalary)}đ</strong></span><span>Tiền thuê<strong>${formatNumber(data.rentCost)}đ</strong></span><span class="cost-total">Tổng chi phí vận hành<strong>${formatNumber(data.totalManagedOperatingCost)}đ</strong></span></div><div class="cost-details"><div><h4>Chi tiết theo chức vụ</h4><ul>${roles||"<li>Không có dữ liệu.</li>"}</ul></div><div><h4>Nhân viên được tính trong kỳ</h4><ul>${people||"<li>Không có dữ liệu.</li>"}</ul></div></div>`; } catch(error){if(String(state.selectedBranchId)===String(restaurantId)){report.innerHTML=`<div class="empty-state error">${escapeHTML(error.message)}</div>`;$("rent-current-value").textContent="Không tải được dữ liệu";}} finally { if(String(state.selectedBranchId)===String(restaurantId))button.disabled = false; }
}

async function loadRentHistory() {
    const container = $("rent-history");
    const restaurantId = state.selectedBranchId;
    container.innerHTML = '<div class="empty-state compact">Đang tải lịch sử tiền thuê…</div>';
    try {
        const history = responseData(await apiRequest(`${API_ENDPOINTS.workforce(restaurantId)}/rent-history`)) || [];
        if (String(state.selectedBranchId) !== String(restaurantId)) return;
        container.innerHTML = history.length ? `<div class="rent-history-table-wrap"><table class="rent-history-table"><thead><tr><th>Kỳ áp dụng</th><th>Mức thuê cũ</th><th>Mức thuê mới</th><th>Thời điểm thay đổi</th><th>Người thực hiện</th></tr></thead><tbody>${history.map(item=>`<tr><td>${String(item.month).padStart(2,"0")}/${item.year}</td><td>${item.oldAmount===null||item.oldAmount===undefined?"Chưa thiết lập":`${formatNumber(item.oldAmount)}đ`}</td><td><strong>${formatNumber(item.newAmount)}đ</strong></td><td>${escapeHTML(formatWorkforceDate(item.changedAt,true))}</td><td>${String(item.performedByRole||"").toUpperCase()==="ADMIN"?"Admin":item.performedByAccountId?`Tài khoản #${escapeHTML(item.performedByAccountId)}`:"—"}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state compact">Chi nhánh chưa có lịch sử thay đổi tiền thuê.</div>';
    } catch (error) {
        if (String(state.selectedBranchId) === String(restaurantId)) container.innerHTML = `<div class="empty-state compact error">${escapeHTML(error.message)}</div>`;
    }
}

function setDetailTab(tab) {
    document.querySelectorAll("[data-detail-tab]").forEach(button =>
        button.classList.toggle("active", button.dataset.detailTab === tab));
    document.querySelectorAll("[data-detail-panel]").forEach(panel =>
        panel.classList.toggle("active", panel.dataset.detailPanel === tab));
    if (tab === "menu" && state.selectedBranchId !== null) loadBranchMenu(state.selectedBranchId);
    if (tab === "workforce" && state.selectedBranchId !== null) {
        loadEmployees();
        loadCostReport();
        loadRentHistory();
    }
}

function closeBranchDetail() {
    $("branch-detail-modal").classList.add("hidden");
    state.menuLoadingFor = null;
    document.body.classList.remove("branch-detail-open");
}

/* =========================================
   RENDER ALL
========================================= */

function renderBranchListAndPagination() {

    renderBranchList();
    renderPagination();
}

function renderAll() {

    renderStatistics();

    applyFilters();

    renderBranchDetail();
}

/* =========================================
   MODAL
========================================= */

function openBranchModal(branch = null) {

    $("branch-form").reset();

    state.editingBranchId = branch
        ? branch.id
        : null;

    $("branch-id").value =
        branch?.id ?? "";

    $("modal-title").textContent = branch
        ? "Chỉnh sửa chi nhánh"
        : "Thêm chi nhánh mới";

    $("branch-category").disabled = false;
    $("branch-image-url-2").disabled = Boolean(branch);
    $("branch-image-url-3").disabled = Boolean(branch);
    $("branch-status").disabled = !branch;

    if (!branch) {
        $("branch-status").value = "ACTIVE";
        $("branch-confirmation-mode").value = "MANUAL";
    }

    if (branch) {

        $("branch-name").value =
            branch.name || "";

        $("branch-status").value =
            branch.status || "ACTIVE";

        $("branch-address").value =
            branch.address || "";

        $("branch-phone").value =
            branch.phone || "";

        $("branch-opening-time").value = branch.openingTime || "";
        $("branch-closing-time").value = branch.closingTime || "";
        $("branch-delivery-fee").value = branch.deliveryFee ?? "";
        $("branch-delivery-radius").value = branch.deliveryRadiusKm ?? "";
        $("branch-latitude").value = branch.latitude ?? "";
        $("branch-longitude").value = branch.longitude ?? "";
        $("branch-base-distance").value = branch.baseDistanceKm ?? "";
        $("branch-additional-fee").value = branch.additionalFeePerKm ?? "";
        $("branch-category").value = branch.categoryStatus || "RESTAURANT";
        $("branch-confirmation-mode").value = branch.orderConfirmationMode || "MANUAL";
        $("branch-image-url").value = branch.imageUrl || "";
        $("branch-image-url-2").value = branch.imageUrl2 || "";
        $("branch-image-url-3").value = branch.imageUrl3 || "";

    }

    updateBranchImagePreview();

    $("branch-modal").classList.remove("hidden");
    document.body.classList.add("branch-drawer-open");
}

function closeBranchModal() {

    $("branch-modal").classList.add("hidden");
    document.body.classList.remove("branch-drawer-open");

    $("branch-form").reset();

    state.editingBranchId = null;
}

/* =========================================
   FORM DATA
========================================= */

/*
 * Payload chuẩn hóa.
 * Cần đối chiếu DTO Request thực tế.
 */

function getBranchFormData() {

    return {
        name: $("branch-name").value.trim(),
        address: $("branch-address").value.trim(),
        phoneNumber: $("branch-phone").value.trim(),
        openingTime: $("branch-opening-time").value,
        closingTime: $("branch-closing-time").value,
        deliveryFee: Number($("branch-delivery-fee").value),
        deliveryRadiusKm: Number($("branch-delivery-radius").value),
        latitude: Number($("branch-latitude").value),
        longitude: Number($("branch-longitude").value),
        baseDistanceKm: Number($("branch-base-distance").value),
        additionalFeePerKm: Number($("branch-additional-fee").value),
        imageUrl: $("branch-image-url").value.trim() || null,
        imageUrl2: $("branch-image-url-2").value.trim() || null,
        imageUrl3: $("branch-image-url-3").value.trim() || null,
        categoryStatus: $("branch-category").value,
        active: $("branch-status").value === "ACTIVE"
    };
}

/* =========================================
   VALIDATE
========================================= */

function validateBranch(data) {

    if (!data.name) {
        showMessage("Vui lòng nhập tên chi nhánh.", "error");
        return false;
    }

    if (!data.address) {
        showMessage("Vui lòng nhập địa chỉ chi nhánh.", "error");
        return false;
    }

    if (!/^0\d{9}$/.test(data.phoneNumber)) {
        showMessage("Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.", "error");
        return false;
    }

    if (!data.openingTime || !data.closingTime) {
        showMessage("Vui lòng nhập đầy đủ giờ mở cửa và đóng cửa.", "error");
        return false;
    }

    const nonNegative = [data.deliveryFee, data.baseDistanceKm, data.additionalFeePerKm];
    if (nonNegative.some(value => !Number.isFinite(value) || value < 0)
        || !Number.isFinite(data.deliveryRadiusKm) || data.deliveryRadiusKm <= 0
        || !Number.isFinite(data.latitude) || data.latitude < -90 || data.latitude > 90
        || !Number.isFinite(data.longitude) || data.longitude < -180 || data.longitude > 180) {
        showMessage("Phí, bán kính và tọa độ nhà hàng không hợp lệ.", "error");
        return false;
    }

    return true;
}

/* =========================================
   CREATE / UPDATE
========================================= */

async function saveBranch(event) {

    event.preventDefault();

    hideMessage();

    const data = getBranchFormData();

    if (!validateBranch(data)) {
        return;
    }

    const isEditing =
        state.editingBranchId !== null;

    const endpoint = isEditing
        ? API_ENDPOINTS.update
        : API_ENDPOINTS.create;

    if (!endpoint) {

        showMessage(
            "API thêm hoặc cập nhật chi nhánh chưa được cấu hình. " +
            "Chưa có dữ liệu nào được lưu.",
            "info"
        );

        return;
    }

    const button = $("save-branch-btn");

    button.disabled = true;

    try {

        const url = isEditing
            ? `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(state.editingBranchId)}`
            : endpoint;

        const payload = { ...data };
        const confirmationMode = $("branch-confirmation-mode").value;
        delete payload.active;

        const currentBranch = isEditing
            ? state.branches.find(item => String(item.id) === String(state.editingBranchId))
            : null;

        if (isEditing) {
            delete payload.imageUrl2;
            delete payload.imageUrl3;
        }

        const savedBranch = await apiRequest(url, {

            method: isEditing ? "PUT" : "POST",

            body: JSON.stringify(payload)

        });

        const savedData = responseData(savedBranch);
        const savedBranchId = isEditing ? state.editingBranchId : savedData?.id;
        if (savedBranchId && confirmationMode !== (currentBranch?.orderConfirmationMode || "MANUAL")) {
            await apiRequest(API_ENDPOINTS.confirmationMode(savedBranchId), {
                method: "PATCH",
                body: JSON.stringify({ mode: confirmationMode })
            });
        }

        if (isEditing && currentBranch && currentBranch.active !== data.active) {
            await apiRequest(
                `${API_ENDPOINTS.status}/${encodeURIComponent(state.editingBranchId)}/status?active=${data.active}`,
                { method: "PATCH" }
            );
        }

        closeBranchModal();

        showMessage(
            isEditing
                ? "Cập nhật chi nhánh thành công."
                : "Thêm chi nhánh thành công.",
            "success"
        );

        await loadBranches();

    } catch (error) {

        console.error(error);

        showMessage(error.message, "error");

    } finally {

        button.disabled = false;

    }
}

/* =========================================
   SELECT BRANCH
========================================= */

function selectBranch(id, openDetail = true) {

    state.selectedBranchId = id;

    renderBranchList();
    renderBranchDetail();
    if (openDetail) {
        setDetailTab("information");
        $("branch-detail-modal").classList.remove("hidden");
        document.body.classList.add("branch-detail-open");
    }
}

/* =========================================
   BRANCH EVENTS
========================================= */

function handleBranchAction(event) {

    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    const id = button.dataset.id;

    const branch = state.branches.find(
        item => String(item.id) === String(id)
    );

    if (!branch) return;

    const action = button.dataset.action;

    if (action === "detail") {

        selectBranch(id);

    }

    if (action === "edit") {

        selectBranch(id, false);

        openBranchModal(branch);

    }

    if (action === "delete") {
        deleteBranch(branch);
    }
}

async function deleteBranch(branch) {
    pendingDeleteBranch = branch;
    $("delete-branch-name").textContent = branch.name || `Quán ăn #${branch.id}`;
    $("delete-branch-reason").value = "";
    $("delete-branch-error").hidden = true;
    $("delete-branch-modal").classList.remove("hidden");
    window.setTimeout(() => $("delete-branch-reason").focus(), 0);
}

function closeDeleteBranchModal() {
    if (deleteBranchPending) return;
    $("delete-branch-modal").classList.add("hidden");
    $("delete-branch-form").reset();
    $("delete-branch-error").hidden = true;
    pendingDeleteBranch = null;
}

async function confirmDeleteBranch(event) {
    event.preventDefault();
    if (!pendingDeleteBranch || deleteBranchPending) return;

    const reason = $("delete-branch-reason").value.trim();
    const errorElement = $("delete-branch-error");
    if (!reason) {
        errorElement.textContent = "Vui lòng nhập lý do xóa quán ăn.";
        errorElement.hidden = false;
        $("delete-branch-reason").focus();
        return;
    }

    const branchId = pendingDeleteBranch.id;
    const button = $("submit-delete-branch");
    deleteBranchPending = true;
    button.disabled = true;
    button.textContent = "Đang xóa…";
    errorElement.hidden = true;

    hideMessage();

    try {
        await apiRequest(
            `${API_ENDPOINTS.delete}/${encodeURIComponent(branchId)}`,
            { method: "DELETE" }
        );
        state.selectedBranchId = null;
        showMessage("Xóa nhà hàng thành công.", "success");
        deleteBranchPending = false;
        closeDeleteBranchModal();
        await loadBranches();
    } catch (error) {
        console.error(error);
        errorElement.textContent = error.message;
        errorElement.hidden = false;
    } finally {
        deleteBranchPending = false;
        button.disabled = false;
        if (pendingDeleteBranch) button.textContent = "Xác nhận xóa";
    }
}

/* =========================================
   FILTER EVENTS
========================================= */

function handleSearch(event) {

    state.keyword = event.target.value;

    applyFilters();
}

function handleStatusFilter(event) {

    state.status = event.target.value;

    applyFilters();
}

function clearFilters() {

    $("branch-search").value = "";
    $("status-filter").value = "";

    state.keyword = "";
    state.status = "";

    applyFilters();
}

function handleLogout() {
    showMessage(
        "Chưa cấu hình chức năng đăng xuất theo cơ chế xác thực Backend.",
        "info"
    );
}

/* =========================================
   INITIALIZE
========================================= */

function initializePage() {

    const branchModal = $("branch-modal");
    const isOutsideBranchContent = target =>
        target === branchModal || target.hasAttribute("data-close-modal");
    let pointerStartedOutsideBranchContent = false;
    let pointerEndedOutsideBranchContent = false;

    $("add-branch-btn").addEventListener(
        "click",
        () => openBranchModal()
    );

    $("close-modal-btn").addEventListener(
        "click",
        closeBranchModal
    );

    $("cancel-modal-btn").addEventListener(
        "click",
        closeBranchModal
    );

    $("cancel-delete-branch").addEventListener("click", closeDeleteBranchModal);
    $("delete-branch-form").addEventListener("submit", confirmDeleteBranch);
    $("delete-branch-modal").addEventListener("click", event => {
        if (event.target === $("delete-branch-modal") || event.target.hasAttribute("data-close-delete-modal")) {
            closeDeleteBranchModal();
        }
    });

    $("close-detail-btn").addEventListener("click", closeBranchDetail);
    document.querySelector("[data-close-detail]").addEventListener("click", closeBranchDetail);
    document.querySelectorAll("[data-detail-tab]").forEach(button =>
        button.addEventListener("click", () => setDetailTab(button.dataset.detailTab)));
    $("cost-period").value = new Date().toISOString().slice(0, 7);
    $("add-employee-btn").addEventListener("click", () => openEmployeeForm());
    let employeeSearchTimer;
    $("employee-search").addEventListener("input", () => { clearTimeout(employeeSearchTimer); employeeSearchTimer = setTimeout(filterEmployees, 300); });
    $("employee-position-filter").addEventListener("change", filterEmployees);
    $("employee-status-filter").addEventListener("change", filterEmployees);
    $("workforce-summary").addEventListener("click", event => { const button=event.target.closest("[data-position-summary]"); if(button){$("employee-position-filter").value=button.dataset.positionSummary;filterEmployees();} });
    $("employee-list").addEventListener("click", async event => {
        const view=event.target.closest("[data-employee-view]"), edit=event.target.closest("[data-employee-edit]"), salary=event.target.closest("[data-employee-salary]"), terminate=event.target.closest("[data-employee-terminate]"), cancel=event.target.closest("[data-employee-cancel]"), history=event.target.closest("[data-employee-history]");
        if(view) openEmployeeDetail(state.employees.find(item => String(item.id)===view.dataset.employeeView));
        if(history) openEmployeeHistory(state.employees.find(item => String(item.id)===history.dataset.employeeHistory));
        if(edit) openEmployeeForm(state.employees.find(item => String(item.id)===edit.dataset.employeeEdit));
        if(salary) openSalaryForm(state.employees.find(item => String(item.id)===salary.dataset.employeeSalary));
        if(terminate) openTermination(state.employees.find(item => String(item.id)===terminate.dataset.employeeTerminate));
        if(cancel) openCancelTermination(state.employees.find(item => String(item.id)===cancel.dataset.employeeCancel));
    });
    $("load-cost-report-btn").addEventListener("click", loadCostReport);
    $("save-rent-btn").addEventListener("click", async () => { const button=$("save-rent-btn");const [year,month]=$("cost-period").value.split("-"); if(!year||!month||$("rent-amount").value===""){showMessage("Hãy nhập tháng và tiền thuê.","error");return;} button.disabled=true;const label=button.textContent;button.textContent="Đang lưu…";try{await apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/rent`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({year:Number(year),month:Number(month),amount:Number($("rent-amount").value)})});showMessage("Đã lưu tiền thuê.","success");await Promise.all([loadCostReport(),loadRentHistory()]);}catch(error){showMessage(error.message,"error");}finally{button.disabled=false;button.textContent=label;} });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !$("delete-branch-modal").classList.contains("hidden")) {
            closeDeleteBranchModal();
        }
        if (event.key === "Escape" && !$("branch-detail-modal").classList.contains("hidden")) {
            closeBranchDetail();
        }
    });

    $("branch-form").addEventListener(
        "submit",
        saveBranch
    );
    $("branch-image-url").addEventListener("input", updateBranchImagePreview);
    $("branch-image-preview").querySelector("img").addEventListener("error", () =>
        $("branch-image-preview").classList.add("empty"));

    $("branch-list").addEventListener(
        "click",
        handleBranchAction
    );

    $("branch-list").addEventListener(
        "click",
        event => {

            const card = event.target.closest(
                ".branch-card"
            );

            if (
                !card ||
                event.target.closest("button")
            ) {
                return;
            }

            selectBranch(card.dataset.id, false);

        }
    );

    $("branch-search").addEventListener(
        "input",
        handleSearch
    );

    $("status-filter").addEventListener(
        "change",
        handleStatusFilter
    );

    $("clear-filter-btn").addEventListener(
        "click",
        clearFilters
    );

    $("previous-page").addEventListener(
        "click",
        () => changePage(-1)
    );

    $("next-page").addEventListener(
        "click",
        () => changePage(1)
    );

    $("edit-selected-btn").addEventListener(
        "click",
        () => {

            const branch = state.branches.find(
                item =>
                    String(item.id) ===
                    String(state.selectedBranchId)
            );

            if (branch) {
                closeBranchDetail();
                openBranchModal(branch);
            }

        }
    );

    $("logoutButton")?.addEventListener(
        "click",
        handleLogout
    );

    branchModal.addEventListener(
        "pointerdown",
        event => {
            pointerStartedOutsideBranchContent = isOutsideBranchContent(event.target);
        }
    );

    branchModal.addEventListener(
        "pointerup",
        event => {
            pointerEndedOutsideBranchContent = isOutsideBranchContent(event.target);
        }
    );

    branchModal.addEventListener(
        "click",
        event => {
            if (
                pointerStartedOutsideBranchContent &&
                pointerEndedOutsideBranchContent &&
                isOutsideBranchContent(event.target)
            ) {
                closeBranchModal();
            }

            pointerStartedOutsideBranchContent = false;
            pointerEndedOutsideBranchContent = false;
        }
    );

    renderAll();

    loadBranches();
}

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);
