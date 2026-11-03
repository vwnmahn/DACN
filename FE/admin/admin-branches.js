
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
    employees: []
};

const $ = id => document.getElementById(id);

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

function resolveImageUrl(value) {
    const url = String(value ?? "").trim();
    if (!url) return "";

    try {
        const parsed = new URL(url, window.location.href);
        if (parsed.origin === window.location.origin && /^\/images\//i.test(parsed.pathname)) {
            const prefix = window.location.pathname.startsWith("/FE/") ? "/FE" : "";
            return `${prefix}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch (_error) {
        return url;
    }

    return url;
}

function updateBranchImagePreview() {
    const preview = $("branch-image-preview");
    const image = preview.querySelector("img");
    const value = $("branch-image-url").value.trim();
    preview.classList.toggle("empty", !value);
    image.removeAttribute("src");
    if (value) image.src = value;
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

    $("refresh-btn").disabled = loading;
    $("add-branch-btn").disabled = loading;

    $("refresh-btn").querySelector(
        ".material-symbols-outlined"
    ).classList.toggle("spinning", loading);
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
        imageUrl: resolveImageUrl(raw.imageUrl),
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

                        ${branch.imageUrl ? `<img class="branch-image" src="${escapeHTML(branch.imageUrl)}" alt="${escapeHTML(branch.name || "Nhà hàng")}">` : `
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

        ${branch.imageUrl ? `<img class="branch-detail-image" src="${escapeHTML(branch.imageUrl)}" alt="${escapeHTML(branch.name || "Nhà hàng")}">` : ""}

        <span class="status ${status.className}">
            ${escapeHTML(status.label)}
        </span>

        <h3 class="detail-name">
            ${escapeHTML(branch.name || "Chưa có tên")}
        </h3>

        <div class="detail-item">
            <span>Địa chỉ</span>
            <strong>
                ${escapeHTML(branch.address || "—")}
            </strong>
        </div>

        <div class="detail-item">
            <span>Danh mục</span>
            <strong>
                ${escapeHTML(branch.categoryStatus || "—")}
            </strong>
        </div>

        <div class="detail-item">
            <span>Giờ hoạt động</span>
            <strong>
                ${escapeHTML(branch.openingTime || "—")} – ${escapeHTML(branch.closingTime || "—")}
            </strong>
        </div>

        <div class="detail-item">
            <span>Số điện thoại</span>
            <strong>
                ${escapeHTML(branch.phone || "—")}
            </strong>
        </div>

        <div class="detail-item">
            <span>Phí giao hàng</span>
            <strong>
                ${branch.deliveryFee !== null ? formatNumber(branch.deliveryFee) + "đ" : "—"}
            </strong>
        </div>

        <div class="detail-item">
            <span>Bán kính giao hàng</span>
            <strong>
                ${branch.deliveryRadiusKm !== null ? formatNumber(branch.deliveryRadiusKm) + " km" : "—"}
            </strong>
        </div>

        <div class="detail-item">
            <span>Tọa độ</span>
            <strong>${escapeHTML(branch.latitude ?? "—")}, ${escapeHTML(branch.longitude ?? "—")}</strong>
        </div>

        <div class="detail-item">
            <span>Xác nhận đơn</span>
            <strong>${escapeHTML(branch.orderConfirmationMode || "—")}</strong>
        </div>

    `;

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
    container.innerHTML = '<div class="empty-state">Đang tải nhân sự…</div>';
    const params = new URLSearchParams();
    const keyword = $("employee-search").value.trim();
    if (keyword) params.set("keyword", keyword);
    if ($("employee-position-filter").value) params.set("position", $("employee-position-filter").value);
    if ($("employee-status-filter").value) params.set("status", $("employee-status-filter").value);
    try {
        const response = await apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/employees?${params}`);
        state.employees = responseData(response) || [];
        renderEmployees();
    } catch (error) {
        container.innerHTML = `<div class="empty-state error">${escapeHTML(error.message)}</div>`;
    }
}

function renderEmployees() {
    const active = state.employees.filter(employee => employee.status === "ACTIVE");
    const groups = active.reduce((result, employee) => ((result[employee.position] = (result[employee.position] || 0) + 1), result), {});
    $("workforce-summary").innerHTML = Object.entries(workforceLabels).map(([key,label]) => `<button type="button" data-position-summary="${key}"><strong>${groups[key] || 0}</strong><span>${label}</span></button>`).join("");
    $("employee-list").innerHTML = state.employees.length ? state.employees.map(employee => {
        const remaining = employee.status === "PENDING_TERMINATION" ? Math.max(0, Math.ceil((new Date(employee.terminationEffectiveAt) - Date.now()) / 86400000)) : null;
        return `<article class="employee-card"><div><strong>${escapeHTML(employee.fullName)}</strong><small>${escapeHTML(employee.employeeCode)} · ${escapeHTML(workforceLabels[employee.position] || employee.position)}</small><span class="employee-status ${employee.status.toLowerCase()}">${escapeHTML(employmentLabels[employee.status] || employee.status)}</span>${remaining !== null ? `<small>Còn khoảng ${remaining} ngày · ${escapeHTML(employee.terminationReason || "")}</small>` : ""}</div><div><b>${formatNumber(employee.monthlySalary)}đ/tháng</b><small>${escapeHTML(employee.phoneNumber)}</small></div><div class="employee-actions"><button data-employee-history="${employee.id}">Lịch sử</button>${employee.status !== "TERMINATED" ? `<button data-employee-edit="${employee.id}">Chỉnh sửa</button>` : ""}${employee.status === "ACTIVE" ? `<button class="danger" data-employee-terminate="${employee.id}">Chấm dứt hợp đồng</button>` : ""}${employee.status === "PENDING_TERMINATION" ? `<button data-employee-cancel="${employee.id}">Hủy yêu cầu</button>` : ""}</div></article>`;
    }).join("") : '<div class="empty-state">Quán chưa có hồ sơ nhân viên phù hợp.</div>';
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
        openWorkforceDialog(`Lịch sử · ${employee.fullName}`, `<section class="history-block"><h4>Lương</h4>${salary.length?salary.map(item=>`<p>${escapeHTML(item.effectiveFrom)}: ${formatNumber(item.oldSalary)}đ → <strong>${formatNumber(item.newSalary)}đ</strong></p>`).join(""):"<p>Chưa có lịch sử.</p>"}</section><section class="history-block"><h4>Hợp đồng</h4>${termination.length?termination.map(item=>`<p><strong>${escapeHTML(item.action)}</strong> · ${escapeHTML(item.reason)}${item.effectiveAt?` · hiệu lực ${escapeHTML(item.effectiveAt)}`:""}</p>`).join(""):"<p>Chưa có lịch sử.</p>"}</section>`, "Đóng", async()=>{});
        const form=document.querySelector(".workforce-dialog form"),submit=form.querySelector('button[type="submit"]'); submit.type="button"; submit.addEventListener("click",()=>document.querySelector(".workforce-dialog")?.remove());
    } catch(error){showMessage(error.message,"error");}
}

async function loadCostReport() {
    const [year,month] = $("cost-period").value.split("-"); if(!year||!month){showMessage("Hãy chọn tháng báo cáo.","error");return;}
    try { const data=responseData(await apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/cost-report?year=${year}&month=${Number(month)}`)); $("rent-amount").value=data.rentCost||0; const roles=Object.entries(data.salaryByPosition||{}).map(([role,salary])=>`<li>${escapeHTML(workforceLabels[role]||role)}: ${data.employeeCountByPosition?.[role]||0} người · <strong>${formatNumber(salary)}đ</strong></li>`).join(""); const people=(data.includedEmployees||[]).map(item=>`<li>${escapeHTML(item.employeeCode)} · ${escapeHTML(item.fullName)} · ${escapeHTML(workforceLabels[item.position]||item.position)}</li>`).join(""); $("cost-report").innerHTML=`<div class="cost-grid"><span>Nhân viên trong kỳ<strong>${data.activeEmployees}</strong></span><span>Shipper<strong>${data.activeShippers}</strong></span><span>Tổng lương<strong>${formatNumber(data.totalSalary)}đ</strong></span><span>Tiền thuê<strong>${formatNumber(data.rentCost)}đ</strong></span><span>Tổng chi phí vận hành<strong>${formatNumber(data.totalManagedOperatingCost)}đ</strong></span></div><div class="cost-details"><h4>Chi tiết theo chức vụ</h4><ul>${roles||"<li>Không có dữ liệu.</li>"}</ul><h4>Nhân viên được tính trong kỳ</h4><ul>${people||"<li>Không có dữ liệu.</li>"}</ul></div>`; } catch(error){$("cost-report").innerHTML=`<div class="empty-state error">${escapeHTML(error.message)}</div>`;}
}

function setDetailTab(tab) {
    document.querySelectorAll("[data-detail-tab]").forEach(button =>
        button.classList.toggle("active", button.dataset.detailTab === tab));
    document.querySelectorAll("[data-detail-panel]").forEach(panel =>
        panel.classList.toggle("active", panel.dataset.detailPanel === tab));
    if (tab === "menu" && state.selectedBranchId !== null) loadBranchMenu(state.selectedBranchId);
    if (tab === "workforce" && state.selectedBranchId !== null) loadEmployees();
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

    $("branch-category").disabled = Boolean(branch);
    $("branch-image-url-2").disabled = Boolean(branch);
    $("branch-image-url-3").disabled = Boolean(branch);
    $("branch-status").disabled = !branch;

    if (!branch) {
        $("branch-status").value = "ACTIVE";
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
        delete payload.active;

        if (isEditing) {
            delete payload.categoryStatus;
            delete payload.imageUrl2;
            delete payload.imageUrl3;
        }

        await apiRequest(url, {

            method: isEditing ? "PUT" : "POST",

            body: JSON.stringify(payload)

        });

        const currentBranch = isEditing
            ? state.branches.find(item => String(item.id) === String(state.editingBranchId))
            : null;

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
    if (!window.confirm(`Xóa nhà hàng "${branch.name}"?`)) return;

    hideMessage();

    try {
        await apiRequest(
            `${API_ENDPOINTS.delete}/${encodeURIComponent(branch.id)}`,
            { method: "DELETE" }
        );
        state.selectedBranchId = null;
        showMessage("Xóa nhà hàng thành công.", "success");
        await loadBranches();
    } catch (error) {
        console.error(error);
        showMessage(error.message, "error");
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

    $("refresh-btn").addEventListener(
        "click",
        loadBranches
    );

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

    $("close-detail-btn").addEventListener("click", closeBranchDetail);
    document.querySelector("[data-close-detail]").addEventListener("click", closeBranchDetail);
    document.querySelectorAll("[data-detail-tab]").forEach(button =>
        button.addEventListener("click", () => setDetailTab(button.dataset.detailTab)));
    $("cost-period").value = new Date().toISOString().slice(0, 7);
    $("add-employee-btn").addEventListener("click", () => openEmployeeForm());
    $("employee-search").addEventListener("change", loadEmployees);
    $("employee-position-filter").addEventListener("change", loadEmployees);
    $("employee-status-filter").addEventListener("change", loadEmployees);
    $("workforce-summary").addEventListener("click", event => { const button=event.target.closest("[data-position-summary]"); if(button){$("employee-position-filter").value=button.dataset.positionSummary;loadEmployees();} });
    $("employee-list").addEventListener("click", async event => {
        const edit=event.target.closest("[data-employee-edit]"), terminate=event.target.closest("[data-employee-terminate]"), cancel=event.target.closest("[data-employee-cancel]"), history=event.target.closest("[data-employee-history]");
        if(history) openEmployeeHistory(state.employees.find(item => String(item.id)===history.dataset.employeeHistory));
        if(edit) openEmployeeForm(state.employees.find(item => String(item.id)===edit.dataset.employeeEdit));
        if(terminate) openTermination(state.employees.find(item => String(item.id)===terminate.dataset.employeeTerminate));
        if(cancel) openCancelTermination(state.employees.find(item => String(item.id)===cancel.dataset.employeeCancel));
    });
    $("load-cost-report-btn").addEventListener("click", loadCostReport);
    $("save-rent-btn").addEventListener("click", async () => { const [year,month]=$("cost-period").value.split("-"); if(!year||!month||$("rent-amount").value===""){showMessage("Hãy nhập tháng và tiền thuê.","error");return;} try{await apiRequest(`${API_ENDPOINTS.workforce(state.selectedBranchId)}/rent`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({year:Number(year),month:Number(month),amount:Number($("rent-amount").value)})});showMessage("Đã lưu tiền thuê.","success");await loadCostReport();}catch(error){showMessage(error.message,"error");} });
    document.addEventListener("keydown", event => {
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

            selectBranch(card.dataset.id);

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
