
"use strict";

/* =====================================================
   FCA CULINARY - MENU MANAGEMENT
   Backend: Spring Boot
   API base: http://localhost:8080/api/v1

   Tích hợp theo MenuItemController và AdminRestaurantController.
===================================================== */

/* ================= CONFIG ================= */

const CONFIG = {
    API_BASE: "http://localhost:8080/api/v1",

    // Sửa lại nếu tên key lưu JWT trong login.js khác.
    TOKEN_KEY: "adminAccessToken",

    ENDPOINTS: {
        dishes: "/menu-items",
        dishDetail: "/menu-items",
        branches: "/admin/restaurants?size=100",
        createDish: "/menu-items",
        updateDish: "/menu-items"
    }
};

/* ================= STATE ================= */

const state = {
    dishes: [],
    branches: [],

    filteredDishes: [],

    selectedBranchId: "",
    selectedStatus: "",
    searchKeyword: "",

    currentPage: 1,
    pageSize: 10,

    editingDishId: null
};

/* ================= DOM ================= */

const $ = (selector) => document.querySelector(selector);

const DOM = {
    dishTableBody: $("#dishTableBody"),
    dishSearch: $("#dishSearch"),
    branchFilter: $("#branchFilter"),
    statusFilter: $("#statusFilter"),

    totalDishes: $("#totalDishes"),
    activeDishes: $("#activeDishes"),
    inactiveDishes: $("#inactiveDishes"),

    dishResultCount: $("#dishResultCount"),
    paginationInfo: $("#paginationInfo"),
    pagination: $("#pagination"),

    dishModal: $("#dishModal"),
    dishForm: $("#dishForm"),

    dishId: $("#dishId"),
    dishName: $("#dishName"),
    dishDescription: $("#dishDescription"),
    dishPrice: $("#dishPrice"),
    dishImage: $("#dishImage"),
    dishImagePreview: $("#dishImagePreview"),
    dishBranch: $("#dishBranch"),
    dishActive: $("#dishActive"),
    dishAvailable: $("#dishAvailable"),

    toastContainer: $("#toastContainer")
};

/* ================= API ================= */

function getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
}

function buildApiUrl(endpoint) {
    if (!endpoint) {
        throw new Error("API endpoint chưa được cấu hình.");
    }

    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }

    return `${CONFIG.API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

async function apiRequest(endpoint, options = {}) {
    const url = buildApiUrl(endpoint);
    const token = getToken();

    const headers = {
        ...(options.headers || {})
    };

    if (!(options.body instanceof FormData) && options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 204) {
        return null;
    }

    const responseText = await response.text();

    let result = null;

    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            result = responseText;
        }
    }

    if (!response.ok) {
        const message =
            result?.message ||
            result?.error ||
            `Yêu cầu thất bại (${response.status})`;

        throw new Error(message);
    }

    if (result && typeof result === "object" && result.code !== undefined && result.code !== 1000) {
        throw new Error(result.message || "Backend không xử lý được yêu cầu.");
    }

    // Hỗ trợ kiểu response phổ biến:
    // { data: [...] }
    // { data: { ... } }
    // [...]
    if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        Object.prototype.hasOwnProperty.call(result, "data")
    ) {
        return result.data;
    }

    return result;
}

function isEndpointConfigured(endpoint) {
    return typeof endpoint === "string" && endpoint.trim() !== "";
}

/* ================= UTILITIES ================= */

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return map[char];
    });
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

function formatCurrency(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(amount);
}

function updateDishImagePreview() {
    const image = DOM.dishImagePreview.querySelector("img");
    const value = DOM.dishImage.value.trim();
    DOM.dishImagePreview.classList.toggle("empty", !value);
    image.removeAttribute("src");
    if (value) image.src = resolveImageUrl(value);
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");

    toast.className = `toast ${type === "error" ? "error" : ""}`;
    toast.textContent = message;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

function getItemId(item) {
    return item?.id ?? null;
}

function getBranchId(item) {
    return item?.restaurantId ?? "";
}

function getBranchName(item) {
    return item?.restaurantName ?? "Chưa xác định";
}

function getDishActive(item) {
    if (typeof item?.active !== "boolean") {
        return null;
    }

    return item.active;
}

function normalizeList(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.content)) {
        return response.content;
    }

    return [];
}

/* ================= SUMMARY ================= */

function renderSummary() {
    const total = state.dishes.length;

    const active = state.dishes.filter(
        dish => getDishActive(dish) === true
    ).length;

    const inactive = state.dishes.filter(
        dish => getDishActive(dish) === false
    ).length;

    DOM.totalDishes.textContent = total;
    DOM.activeDishes.textContent = active;
    DOM.inactiveDishes.textContent = inactive;
}

function renderBranchOptions() {
    const options = state.branches.map(branch => {
        const id = getItemId(branch);
        const name = branch.name ?? "";

        return `
            <option value="${escapeHtml(id)}">
                ${escapeHtml(name)}
            </option>
        `;
    }).join("");

    DOM.branchFilter.innerHTML =
        `<option value="">Tất cả chi nhánh</option>${options}`;

    DOM.dishBranch.innerHTML =
        `<option value="">Chọn chi nhánh</option>${options}`;
}

/* ================= FILTER ================= */

function applyFilters() {
    const keyword = state.searchKeyword.trim().toLowerCase();

    state.filteredDishes = state.dishes.filter(dish => {
        const name = String(dish.name ?? "").toLowerCase();
        const description = String(dish.description ?? "").toLowerCase();
        const matchesKeyword =
            !keyword ||
            name.includes(keyword) ||
            description.includes(keyword) ||
            getBranchName(dish).toLowerCase().includes(keyword);

        const matchesBranch =
            !state.selectedBranchId ||
            String(getBranchId(dish)) === String(state.selectedBranchId);

        const active = getDishActive(dish);

        const matchesStatus =
            state.selectedStatus === "" ||
            String(active) === state.selectedStatus;

        return (
            matchesKeyword &&
            matchesBranch &&
            matchesStatus
        );
    });

    state.currentPage = 1;

    renderDishTable();
}

/* ================= DISH TABLE ================= */

function renderDishTable() {
    const total = state.filteredDishes.length;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, total);

    const pageItems = state.filteredDishes.slice(startIndex, endIndex);

    DOM.dishResultCount.textContent = `${total} món ăn`;

    if (total === 0) {
        DOM.dishTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <span class="material-symbols-outlined">search_off</span>
                        <strong>Không tìm thấy món ăn</strong>
                        <p>Chưa có dữ liệu phù hợp với bộ lọc hiện tại.</p>
                    </div>
                </td>
            </tr>
        `;

        DOM.paginationInfo.textContent = "Không có dữ liệu";
        renderPagination(0);
        return;
    }

    DOM.dishTableBody.innerHTML = pageItems.map(dish => {
        const id = getItemId(dish);
        const name = dish.name ?? "Chưa có tên";
        const description = dish.description ?? "";
        const image = resolveImageUrl(dish.imageUrl);
        const price = dish.price;
        const active = getDishActive(dish);
        const available = dish.available === true;

        const activeStatusHtml = active === true
            ? `<span class="status-badge status-active">Đang kích hoạt</span>`
            : active === false
                ? `<span class="status-badge status-inactive">Ngừng kích hoạt</span>`
                : `<span class="status-badge">Chưa xác định</span>`;

        const availabilityStatusHtml = available
            ? `<span class="status-badge status-active">Có thể phục vụ</span>`
            : `<span class="status-badge status-unavailable">Tạm hết món</span>`;

        const imageHtml = image
            ? `
                <img
                    class="dish-image"
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(name)}"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
                <div class="dish-placeholder" style="display:none">
                    <span class="material-symbols-outlined">restaurant</span>
                </div>
            `
            : `
                <div class="dish-placeholder">
                    <span class="material-symbols-outlined">restaurant</span>
                </div>
            `;

        return `
            <tr>
                <td>
                    <div class="dish-info">
                        ${imageHtml}

                        <div>
                            <div class="dish-name" title="${escapeHtml(name)}">
                                ${escapeHtml(name)}
                            </div>

                            <div class="dish-description">
                                ${escapeHtml(description || "Không có mô tả")}
                            </div>
                        </div>
                    </div>
                </td>

                <td class="text-right">
                    <span class="price-value">
                        ${formatCurrency(price)}
                    </span>
                </td>

                <td>
                    ${escapeHtml(getBranchName(dish))}
                </td>

                <td class="text-center">
                    <div class="status-stack">
                        ${activeStatusHtml}
                        ${availabilityStatusHtml}
                    </div>
                </td>

                <td>
                    <div class="table-actions">
                        <button class="icon-button"
                                type="button"
                                title="Xem chi tiết"
                                data-action="view"
                                data-id="${escapeHtml(id)}">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>

                        <button class="icon-button"
                                type="button"
                                title="Chỉnh sửa"
                                data-action="edit"
                                data-id="${escapeHtml(id)}">
                            <span class="material-symbols-outlined">edit</span>
                        </button>

                        <button class="icon-button"
                                type="button"
                                title="Đổi trạng thái kích hoạt"
                                data-action="toggle-status"
                                data-id="${escapeHtml(id)}">
                            <span class="material-symbols-outlined">power_settings_new</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    DOM.paginationInfo.textContent =
        `Hiển thị ${startIndex + 1} - ${endIndex} trong tổng số ${total} món ăn`;

    renderPagination(total);
}

/* ================= PAGINATION ================= */

function renderPagination(total) {
    const totalPages = Math.ceil(total / state.pageSize);

    if (totalPages <= 1) {
        DOM.pagination.innerHTML = `
            <button class="page-button" type="button" disabled>
                <span class="material-symbols-outlined">chevron_left</span>
            </button>
            <button class="page-button" type="button" disabled>
                <span class="material-symbols-outlined">chevron_right</span>
            </button>
        `;
        return;
    }

    DOM.pagination.innerHTML = `
        <button class="page-button"
                type="button"
                data-page="${state.currentPage - 1}"
                ${state.currentPage === 1 ? "disabled" : ""}>
            <span class="material-symbols-outlined">chevron_left</span>
        </button>

        ${Array.from({ length: totalPages }, (_, index) => index + 1)
            .filter(page =>
                page === 1 ||
                page === totalPages ||
                Math.abs(page - state.currentPage) <= 1
            )
            .map(page => `
                <button class="page-button ${page === state.currentPage ? "active" : ""}"
                        type="button"
                        data-page="${page}">
                    ${page}
                </button>
            `).join("")}

        <button class="page-button"
                type="button"
                data-page="${state.currentPage + 1}"
                ${state.currentPage === totalPages ? "disabled" : ""}>
            <span class="material-symbols-outlined">chevron_right</span>
        </button>
    `;
}

/* ================= LOAD DATA ================= */

async function loadDishes() {
    if (!isEndpointConfigured(CONFIG.ENDPOINTS.dishes)) {
        state.dishes = [];
        state.filteredDishes = [];

        renderSummary();
        renderDishTable();

        return;
    }

    try {
        DOM.dishTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <strong>Đang tải dữ liệu...</strong>
                    </div>
                </td>
            </tr>
        `;

        const response = await apiRequest(CONFIG.ENDPOINTS.dishes);

        state.dishes = normalizeList(response);
        applyFilters();
        renderSummary();

    } catch (error) {
        console.error("Load dishes error:", error);

        DOM.dishTableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <span class="material-symbols-outlined">error_outline</span>
                        <strong>Không thể tải danh sách món ăn</strong>
                        <p>${escapeHtml(error.message)}</p>
                    </div>
                </td>
            </tr>
        `;

        showToast(error.message, "error");
    }
}

async function loadBranches() {
    if (!isEndpointConfigured(CONFIG.ENDPOINTS.branches)) {
        state.branches = [];
        renderBranchOptions();
        return;
    }

    try {
        const response = await apiRequest(CONFIG.ENDPOINTS.branches);

        state.branches = normalizeList(response);

        renderBranchOptions();

    } catch (error) {
        console.error("Load branches error:", error);
        showToast("Không thể tải danh sách chi nhánh.", "error");
    }
}

/* ================= MODAL ================= */

function openDishModal(dish = null, readOnly = false) {
    state.editingDishId = dish ? getItemId(dish) : null;

    DOM.dishForm.reset();

    DOM.dishId.value = state.editingDishId ?? "";
    DOM.dishModal.classList.add("show");
    DOM.dishModal.setAttribute("aria-hidden", "false");

    $("#dishModalTitle").textContent =
        readOnly ? "Chi tiết món ăn" : dish ? "Chỉnh sửa món ăn" : "Thêm món ăn";

    if (dish) {
        DOM.dishName.value = dish.name ?? "";
        DOM.dishDescription.value = dish.description ?? "";
        DOM.dishPrice.value = dish.price ?? "";
        DOM.dishImage.value = dish.imageUrl ?? "";
        DOM.dishBranch.value = getBranchId(dish);

        DOM.dishActive.checked = dish.active !== false;
        DOM.dishAvailable.checked = dish.available !== false;
    } else {
        DOM.dishActive.checked = true;
        DOM.dishAvailable.checked = true;
    }
    updateDishImagePreview();

    DOM.dishBranch.disabled = Boolean(dish);
    Array.from(DOM.dishForm.elements).forEach(element => {
        if (element.id !== "cancelDishModal" && element.id !== "closeDishModal") {
            element.disabled = readOnly || element === DOM.dishBranch && Boolean(dish);
        }
    });
    $("#saveDishButton").hidden = readOnly;
    $("#cancelDishModal").textContent = readOnly ? "Đóng" : "Hủy";
}

function closeDishModal() {
    DOM.dishModal.classList.remove("show");
    DOM.dishModal.setAttribute("aria-hidden", "true");

    state.editingDishId = null;
    $("#saveDishButton").hidden = false;
    $("#cancelDishModal").textContent = "Hủy";
}

function findDishById(id) {
    return state.dishes.find(
        dish => String(getItemId(dish)) === String(id)
    );
}

/* ================= CREATE / UPDATE ================= */

async function handleDishSubmit(event) {
    event.preventDefault();

    const isEditing = state.editingDishId !== null;

    const endpoint = isEditing
        ? CONFIG.ENDPOINTS.updateDish
        : CONFIG.ENDPOINTS.createDish;

    if (!isEndpointConfigured(endpoint)) {
        showToast(
            "Chưa cấu hình API thêm hoặc cập nhật món ăn.",
            "error"
        );
        return;
    }

    const payload = {
        name: DOM.dishName.value.trim(),
        description: DOM.dishDescription.value.trim(),
        price: Number(DOM.dishPrice.value),
        imageUrl: DOM.dishImage.value.trim() || null,
        active: DOM.dishActive.checked,
        available: DOM.dishAvailable.checked
    };

    if (!isEditing) {
        payload.restaurantId = Number(DOM.dishBranch.value);
    }

    if (!payload.name) {
        showToast("Vui lòng nhập tên món ăn.", "error");
        return;
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
        showToast("Giá bán không hợp lệ.", "error");
        return;
    }

    if (!isEditing && (!Number.isInteger(payload.restaurantId) || payload.restaurantId <= 0)) {
        showToast("Vui lòng chọn chi nhánh.", "error");
        return;
    }

    try {
        const button = $("#saveDishButton");
        button.disabled = true;
        button.textContent = "Đang lưu...";

        const url = isEditing
            ? `${endpoint.replace(/\/$/, "")}/${encodeURIComponent(state.editingDishId)}`
            : endpoint;

        await apiRequest(url, {
            method: isEditing ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });

        closeDishModal();

        showToast(
            isEditing
                ? "Cập nhật món ăn thành công."
                : "Thêm món ăn thành công."
        );

        await loadDishes();

    } catch (error) {
        console.error("Save dish error:", error);
        showToast(error.message, "error");
    } finally {
        const button = $("#saveDishButton");
        button.disabled = false;
        button.textContent = "Lưu món ăn";
    }
}

/* ================= TABLE ACTIONS ================= */

async function handleTableAction(event) {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!id) return;

    if (action === "view" || action === "edit") {
        try {
            const dish = await apiRequest(
                `${CONFIG.ENDPOINTS.dishDetail}/${encodeURIComponent(id)}`
            );
            openDishModal(dish, action === "view");
        } catch (error) {
            showToast(error.message, "error");
        }
        return;
    }

    if (action === "toggle-status") {
        const dish = findDishById(id);
        if (!dish) return;
        const nextActive = dish.active !== true;

        try {
            await apiRequest(`${CONFIG.ENDPOINTS.updateDish}/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify({
                    name: dish.name,
                    description: dish.description || "",
                    price: Number(dish.price),
                    imageUrl: dish.imageUrl || null,
                    active: nextActive,
                    available: dish.available === true
                })
            });
            showToast("Cập nhật trạng thái món ăn thành công.");
            await loadDishes();
        } catch (error) {
            showToast(error.message, "error");
        }
    }
}

/* ================= FILTER EVENTS ================= */

function handleSearch(event) {
    state.searchKeyword = event.target.value;
    applyFilters();
}

function handleBranchFilter(event) {
    state.selectedBranchId = event.target.value;
    applyFilters();
}

function handleStatusFilter(event) {
    state.selectedStatus = event.target.value;
    applyFilters();
}

function resetFilters() {
    state.searchKeyword = "";
    state.selectedBranchId = "";
    state.selectedStatus = "";

    DOM.dishSearch.value = "";
    DOM.branchFilter.value = "";
    DOM.statusFilter.value = "";

    applyFilters();
}

/* ================= PAGINATION EVENTS ================= */

function handlePaginationClick(event) {
    const button = event.target.closest("[data-page]");

    if (!button || button.disabled) return;

    const page = Number(button.dataset.page);
    const totalPages = Math.ceil(
        state.filteredDishes.length / state.pageSize
    );

    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
        return;
    }

    state.currentPage = page;
    renderDishTable();
}

/* ================= USER / LOGOUT ================= */

function renderAdminInfo() {
    // Thay đổi các key này theo cấu trúc lưu thông tin
    // tài khoản thực tế của chức năng đăng nhập.
    const userName =
        localStorage.getItem("userName") ||
        localStorage.getItem("fullName") ||
        "Quản trị viên";

    const userEmail =
        localStorage.getItem("userEmail") ||
        localStorage.getItem("email") ||
        "Tài khoản quản trị";

    $("#sidebarAdminName").textContent = userName;
    $("#topbarAdminName").textContent = userName;
    $("#sidebarAdminEmail").textContent = userEmail;
}

function handleLogout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem("adminRefreshToken");
    window.location.replace("../login.html");
}

/* ================= MOBILE MENU ================= */

function handleMobileMenu() {
    $("#sidebar").classList.toggle("open");
}

/* ================= GLOBAL SEARCH ================= */

function handleGlobalSearch(event) {
    DOM.dishSearch.value = event.target.value;
    state.searchKeyword = event.target.value;
    applyFilters();
}

/* ================= EVENT LISTENERS ================= */

function bindEvents() {
    const isOutsideDishContent = target => target === DOM.dishModal;
    let pointerStartedOutsideDishContent = false;
    let pointerEndedOutsideDishContent = false;

    $("#addDishButton").addEventListener("click", () => {
        openDishModal();
    });

    $("#closeDishModal").addEventListener("click", closeDishModal);
    $("#cancelDishModal").addEventListener("click", closeDishModal);

    DOM.dishModal.addEventListener("pointerdown", event => {
        pointerStartedOutsideDishContent = isOutsideDishContent(event.target);
    });

    DOM.dishModal.addEventListener("pointerup", event => {
        pointerEndedOutsideDishContent = isOutsideDishContent(event.target);
    });

    DOM.dishModal.addEventListener("click", event => {
        if (
            pointerStartedOutsideDishContent &&
            pointerEndedOutsideDishContent &&
            isOutsideDishContent(event.target)
        ) {
            closeDishModal();
        }

        pointerStartedOutsideDishContent = false;
        pointerEndedOutsideDishContent = false;
    });

    DOM.dishForm.addEventListener("submit", handleDishSubmit);

    DOM.dishTableBody.addEventListener("click", handleTableAction);

    DOM.dishSearch.addEventListener("input", handleSearch);
    DOM.dishImage.addEventListener("input", updateDishImagePreview);
    DOM.dishImagePreview.querySelector("img").addEventListener("error", () =>
        DOM.dishImagePreview.classList.add("empty"));

    DOM.branchFilter.addEventListener("change", handleBranchFilter);

    DOM.statusFilter.addEventListener("change", handleStatusFilter);

    DOM.pagination.addEventListener("click", handlePaginationClick);

    $("#resetFiltersButton").addEventListener("click", resetFilters);

    $("#refreshDishesButton").addEventListener("click", loadDishes);

    $("#logoutButton").addEventListener("click", handleLogout);

    if (!$("#sidebar").classList.contains("admin-shell-sidebar")) {
        $("#mobileMenuButton").addEventListener("click", handleMobileMenu);
    }

    $("#globalSearch").addEventListener("input", handleGlobalSearch);
}

/* ================= INITIALIZATION ================= */

async function initMenuManagement() {
    bindEvents();
    renderAdminInfo();

    renderSummary();
    renderBranchOptions();
    renderDishTable();

    // Chỉ gọi các API đã được cấu hình.
    await Promise.allSettled([
        loadBranches(),
        loadDishes()
    ]);

    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get("restaurantId");
    const dishId = params.get("dishId");
    const action = params.get("action");
    if (restaurantId) {
        state.selectedBranchId = restaurantId;
        DOM.branchFilter.value = restaurantId;
        state.currentPage = 1;
        applyFilters();
    }
    if (dishId && (action === "view" || action === "edit")) {
        try {
            const dish = await apiRequest(`${CONFIG.ENDPOINTS.dishDetail}/${encodeURIComponent(dishId)}`);
            if (String(getBranchId(dish)) === String(restaurantId)) {
                openDishModal(dish, action === "view");
            } else {
                showToast("Món ăn không thuộc nhà hàng đang chọn.", "error");
            }
        } catch (error) {
            showToast(error.message, "error");
        }
    }
}

document.addEventListener("DOMContentLoaded", initMenuManagement);
