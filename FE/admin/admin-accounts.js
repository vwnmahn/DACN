
"use strict";

/* =========================================
   FCA CULINARY - ADMIN ACCOUNT MANAGEMENT
========================================= */

const API_BASE = "http://localhost:8080/api/v1";

const ACCOUNT_API = `${API_BASE}/admin/accounts`;

const AUTH_API = `${API_BASE}/auth`;

const PAGE_SIZE = 20;

const state = {
    accounts: [],
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,

    keyword: "",
    role: "",
    locked: "",

    selectedAccount: null,

    loading: false,
    searchTimer: null
};

const $ = id => document.getElementById(id);

/* =========================================
   AUTHENTICATION
========================================= */

function getAccessToken() {
    return localStorage.getItem("adminAccessToken");
}

function getRefreshToken() {
    return localStorage.getItem("adminRefreshToken");
}

function clearTokens() {
    localStorage.removeItem("adminAccessToken");
    localStorage.removeItem("adminRefreshToken");
    localStorage.removeItem("adminTokenType");
}

/* =========================================
   API REQUEST
========================================= */

async function apiRequest(url, options = {}) {

    const token = getAccessToken();

    if (!token) {
        throw new Error("Không tìm thấy Access Token. Vui lòng đăng nhập lại.");
    }

    const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
    };

    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    let result = null;

    const contentType =
        response.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
        result = await response.json();
    } else {
        const text = await response.text();

        if (text) {
            result = { message: text };
        }
    }

    if (response.status === 401) {
        throw new Error("Phiên đăng nhập hết hạn hoặc không hợp lệ.");
    }

    if (response.status === 403) {
        throw new Error("Bạn không có quyền thực hiện thao tác này.");
    }

    if (!response.ok) {
        throw new Error(
            result?.message ||
            `Lỗi HTTP ${response.status}`
        );
    }

    return result;
}

/* =========================================
   RESPONSE HANDLING
========================================= */

function unwrapResponse(response) {

    if (!response) {
        return null;
    }

    return response.data ?? response;
}

function getPageData(response) {

    const data = unwrapResponse(response);

    if (Array.isArray(data)) {
        return {
            content: data,
            totalElements: data.length,
            totalPages: 1,
            page: 0,
            size: data.length
        };
    }

    if (Array.isArray(data?.content)) {
        return data;
    }

    throw new Error(
        "Cấu trúc dữ liệu danh sách tài khoản không hợp lệ."
    );
}

/* =========================================
   FORMAT
========================================= */

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );
}

function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function formatNumber(value) {

    return new Intl.NumberFormat("vi-VN").format(
        Number(value) || 0
    );
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

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function hideMessage() {
    $("page-message").classList.add("hidden");
}

/* =========================================
   LOADING
========================================= */

function setLoading(value) {

    state.loading = value;

    $("refresh-btn").disabled = value;

    $("refresh-btn")
        .querySelector(".material-symbols-outlined")
        .classList.toggle("spinning", value);

    $("account-table-body").classList.toggle(
        "loading",
        value
    );
}

/* =========================================
   LOAD ACCOUNT LIST
========================================= */

async function loadAccounts() {

    if (state.loading) return;

    hideMessage();

    setLoading(true);

    try {

        const params = new URLSearchParams();

        if (state.keyword.trim()) {
            params.set("keyword", state.keyword.trim());
        }

        if (state.role) {
            params.set("role", state.role);
        }

        if (state.locked !== "") {
            params.set("locked", state.locked);
        }

        params.set("page", state.currentPage);
        params.set("size", PAGE_SIZE);
        params.set("sortBy", "username");
        params.set("sortDirection", "asc");

        const response = await apiRequest(
            `${ACCOUNT_API}?${params.toString()}`
        );

        const pageData = getPageData(response);

        state.accounts = pageData.content || [];

        state.totalElements =
            Number(pageData.totalElements ?? state.accounts.length);

        state.totalPages =
            Number(pageData.totalPages ?? 1);

        state.currentPage =
            Number(pageData.page ?? state.currentPage);

        renderAll();

    } catch (error) {

        console.error("Load accounts error:", error);

        state.accounts = [];
        state.totalElements = 0;
        state.totalPages = 0;

        renderAll();

        showMessage(error.message, "error");

    } finally {

        setLoading(false);

    }
}

/* =========================================
   STATISTICS
========================================= */

function renderStatistics() {

    const accounts = state.accounts;

    const adminCount = accounts.filter(
        account => account.role === "ADMIN"
    ).length;

    const userCount = accounts.filter(
        account => account.role === "USER"
    ).length;

    const lockedCount = accounts.filter(
        account => account.locked === true
    ).length;

    $("total-accounts").textContent =
        formatNumber(state.totalElements);

    $("admin-count").textContent =
        formatNumber(adminCount);

    $("user-count").textContent =
        formatNumber(userCount);

    $("locked-count").textContent =
        formatNumber(lockedCount);
}

/* =========================================
   ROLE BADGE
========================================= */

function renderRoleBadge(role) {

    if (role === "ADMIN") {

        return `
            <span class="role-badge admin">
                <span class="material-symbols-outlined">
                    shield_person
                </span>
                ADMIN
            </span>
        `;
    }

    if (role === "USER") {

        return `
            <span class="role-badge user">
                <span class="material-symbols-outlined">
                    person
                </span>
                USER
            </span>
        `;
    }

    return escapeHTML(role || "—");
}

/* =========================================
   STATUS BADGE
========================================= */

function renderStatusBadge(locked) {

    if (locked === true) {

        return `
            <span class="status-badge locked">
                <span class="material-symbols-outlined">
                    lock
                </span>
                Đã khóa
            </span>
        `;
    }

    return `
        <span class="status-badge active">
            <span class="material-symbols-outlined">
                check_circle
            </span>
            Đang hoạt động
        </span>
    `;
}

/* =========================================
   ACCOUNT TABLE
========================================= */

function renderAccounts() {

    const tbody = $("account-table-body");

    if (!state.accounts.length) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <span class="material-symbols-outlined">
                            person_search
                        </span>
                        Không tìm thấy tài khoản phù hợp.
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    tbody.innerHTML = state.accounts.map(account => {

        const id = escapeHTML(account.id);

        const username = escapeHTML(
            account.username || "Chưa có username"
        );

        const email = escapeHTML(account.email || "—");

        const phone = escapeHTML(
            account.phoneNumber || "—"
        );

        const avatarUrl = account.avatarUrl
            ? escapeHTML(account.avatarUrl)
            : "";

        const avatar = avatarUrl
            ? `
                <img
                    src="${avatarUrl}"
                    alt="Avatar"
                    onerror="this.style.display='none'"
                >
            `
            : `
                <span class="material-symbols-outlined">
                    person
                </span>
            `;

        const actionIcon = account.locked
            ? "lock_open"
            : "lock";

        const actionTitle = account.locked
            ? "Mở khóa tài khoản"
            : "Khóa tài khoản";

        const actionClass = account.locked
            ? ""
            : "danger";

        return `
            <tr data-account-id="${id}">

                <td>
                    <div class="account-user">

                        <div class="account-avatar">
                            ${avatar}
                        </div>

                        <div>
                            <span class="account-name">
                                ${username}
                            </span>

                            <span class="account-id">
                                ID: ${id}
                            </span>
                        </div>

                    </div>
                </td>

                <td>
                    <div class="contact-info">
                        <span>${email}</span>
                        <small>${phone}</small>
                    </div>
                </td>

                <td>
                    ${renderRoleBadge(account.role)}
                </td>

                <td>
                    ${renderStatusBadge(account.locked)}
                </td>

                <td>
                    <span class="date-text">
                        ${formatDate(account.createdAt)}
                    </span>
                </td>

                <td>
                    <div class="account-actions">

                        <button
                            class="action-btn"
                            type="button"
                            data-action="detail"
                            data-id="${id}"
                            title="Xem chi tiết"
                        >
                            <span class="material-symbols-outlined">
                                visibility
                            </span>
                        </button>

                        <button
                            class="action-btn"
                            type="button"
                            data-action="role"
                            data-id="${id}"
                            title="Thay đổi quyền"
                        >
                            <span class="material-symbols-outlined">
                                admin_panel_settings
                            </span>
                        </button>

                        <button
                            class="action-btn ${actionClass}"
                            type="button"
                            data-action="lock"
                            data-id="${id}"
                            title="${actionTitle}"
                        >
                            <span class="material-symbols-outlined">
                                ${actionIcon}
                            </span>
                        </button>

                    </div>
                </td>

            </tr>
        `;

    }).join("");

}

/* =========================================
   PAGINATION
========================================= */

function renderPagination() {

    const total = state.totalElements;

    const totalPages = state.totalPages;

    const start = total === 0
        ? 0
        : state.currentPage * PAGE_SIZE + 1;

    const end = Math.min(
        (state.currentPage + 1) * PAGE_SIZE,
        total
    );

    $("pagination-info").textContent =
        `Hiển thị ${formatNumber(start)} - ${formatNumber(end)} trong tổng số ${formatNumber(total)} tài khoản`;

    $("page-info").textContent =
        totalPages > 0
            ? `Trang ${state.currentPage + 1}/${totalPages}`
            : "Chưa có trang";

    $("previous-page").disabled =
        state.currentPage <= 0;

    $("next-page").disabled =
        totalPages === 0 ||
        state.currentPage >= totalPages - 1;

    $("result-count").textContent =
        `${formatNumber(total)} tài khoản phù hợp`;
}

async function changePage(direction) {

    const nextPage =
        state.currentPage + direction;

    if (
        nextPage < 0 ||
        nextPage >= state.totalPages
    ) {
        return;
    }

    state.currentPage = nextPage;

    await loadAccounts();
}

/* =========================================
   RENDER ALL
========================================= */

function renderAll() {

    renderStatistics();

    renderAccounts();

    renderPagination();

}

/* =========================================
   FILTER
========================================= */

function handleSearch(event) {

    state.keyword = event.target.value;

    clearTimeout(state.searchTimer);

    state.searchTimer = setTimeout(() => {

        state.currentPage = 0;

        loadAccounts();

    }, 400);

}

function handleRoleFilter(event) {

    state.role = event.target.value;

    state.currentPage = 0;

    loadAccounts();
}

function handleLockedFilter(event) {

    state.locked = event.target.value;

    state.currentPage = 0;

    loadAccounts();
}

function clearFilters() {

    $("account-search").value = "";
    $("role-filter").value = "";
    $("locked-filter").value = "";

    state.keyword = "";
    state.role = "";
    state.locked = "";

    state.currentPage = 0;

    loadAccounts();
}

/* =========================================
   ACCOUNT DETAIL
========================================= */

async function showAccountDetail(id) {

    hideMessage();

    const account = state.accounts.find(
        item => String(item.id) === String(id)
    );

    if (!account) return;

    state.selectedAccount = account;

    $("account-modal").classList.remove("hidden");

    $("account-detail").innerHTML = `
        <div class="empty-state">
            Đang tải thông tin tài khoản...
        </div>
    `;

    try {

        const response = await apiRequest(
            `${ACCOUNT_API}/${encodeURIComponent(id)}`
        );

        const detail = unwrapResponse(response);

        if (!detail) {
            throw new Error("Không tìm thấy thông tin tài khoản.");
        }

        state.selectedAccount = detail;

        renderAccountDetail(detail);

    } catch (error) {

        console.error(error);

        $("account-detail").innerHTML = `
            <div class="empty-state">
                ${escapeHTML(error.message)}
            </div>
        `;

    }
}

function renderAccountDetail(account) {

    $("account-detail").innerHTML = `

        <div class="detail-grid">

            <div class="detail-item">
                <span>ID tài khoản</span>
                <strong>${escapeHTML(account.id)}</strong>
            </div>

            <div class="detail-item">
                <span>Username</span>
                <strong>${escapeHTML(account.username)}</strong>
            </div>

            <div class="detail-item">
                <span>Email</span>
                <strong>${escapeHTML(account.email || "—")}</strong>
            </div>

            <div class="detail-item">
                <span>Số điện thoại</span>
                <strong>${escapeHTML(account.phoneNumber || "—")}</strong>
            </div>

            <div class="detail-item">
                <span>Quyền tài khoản</span>
                <strong>${escapeHTML(account.role || "—")}</strong>
            </div>

            <div class="detail-item">
                <span>Trạng thái</span>
                <strong>
                    ${account.locked ? "Đã khóa" : "Đang hoạt động"}
                </strong>
            </div>

            <div class="detail-item full">
                <span>Địa chỉ</span>
                <strong>${escapeHTML(account.address || "—")}</strong>
            </div>

            <div class="detail-item">
                <span>Ngày tạo</span>
                <strong>${formatDate(account.createdAt)}</strong>
            </div>

            <div class="detail-item">
                <span>Cập nhật lần cuối</span>
                <strong>${formatDate(account.updatedAt)}</strong>
            </div>

        </div>

    `;

}

function closeAccountDetail() {
    $("account-modal").classList.add("hidden");
    state.selectedAccount = null;
}

/* =========================================
   CHANGE ROLE
========================================= */

function openRoleModal(id) {

    const account = state.accounts.find(
        item => String(item.id) === String(id)
    );

    if (!account) return;

    state.selectedAccount = account;

    $("role-account-id").value = account.id;

    $("role-account-name").textContent =
        account.username || account.email || `ID ${account.id}`;

    $("new-role").value = account.role;

    $("role-modal").classList.remove("hidden");
}

function closeRoleModal() {

    $("role-modal").classList.add("hidden");

    $("role-form").reset();

    state.selectedAccount = null;
}

async function updateAccountRole(event) {

    event.preventDefault();

    const id = $("role-account-id").value;

    const newRole = $("new-role").value;

    const account = state.selectedAccount;

    if (!account) return;

    if (!["ADMIN", "USER"].includes(newRole)) {
        showMessage("Quyền tài khoản không hợp lệ.", "error");
        return;
    }

    if (account.role === newRole) {
        closeRoleModal();
        return;
    }

    const confirmed = confirm(
        `Bạn có chắc chắn muốn đổi quyền tài khoản "${account.username}" thành ${newRole}?`
    );

    if (!confirmed) return;

    const button = $("save-role");

    button.disabled = true;

    try {

        await apiRequest(
            `${ACCOUNT_API}/${encodeURIComponent(id)}/role`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    role: newRole
                })
            }
        );

        closeRoleModal();

        showMessage(
            "Cập nhật quyền tài khoản thành công.",
            "success"
        );

        await loadAccounts();

    } catch (error) {

        console.error("Update role error:", error);

        showMessage(error.message, "error");

    } finally {

        button.disabled = false;

    }
}

/* =========================================
   LOCK / UNLOCK ACCOUNT
========================================= */

async function toggleAccountLock(id) {

    const account = state.accounts.find(
        item => String(item.id) === String(id)
    );

    if (!account) return;

    const newLockedStatus = !account.locked;

    const action = newLockedStatus
        ? "khóa"
        : "mở khóa";

    const confirmed = confirm(
        `Bạn có chắc chắn muốn ${action} tài khoản "${account.username}"?`
    );

    if (!confirmed) return;

    try {

        await apiRequest(
            `${ACCOUNT_API}/${encodeURIComponent(id)}/lock`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    locked: newLockedStatus
                })
            }
        );

        showMessage(
            newLockedStatus
                ? "Đã khóa tài khoản thành công."
                : "Đã mở khóa tài khoản thành công.",
            "success"
        );

        await loadAccounts();

    } catch (error) {

        console.error("Lock account error:", error);

        showMessage(error.message, "error");

    }
}

/* =========================================
   TABLE ACTIONS
========================================= */

function handleTableAction(event) {

    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    const action = button.dataset.action;

    const id = button.dataset.id;

    if (action === "detail") {
        showAccountDetail(id);
    }

    if (action === "role") {
        openRoleModal(id);
    }

    if (action === "lock") {
        toggleAccountLock(id);
    }

}

/* =========================================
   LOGOUT
========================================= */

async function logout() {

    const refreshToken = getRefreshToken();

    const accessToken = getAccessToken();

    try {

        if (refreshToken && accessToken) {

            await fetch(`${AUTH_API}/logout`, {
                method: "DELETE",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },

                body: JSON.stringify({
                    refreshToken
                })
            });

        }

    } catch (error) {

        console.error("Logout error:", error);

    } finally {

        clearTokens();

        window.location.href = "../login.html";

    }

}

/* =========================================
   MODAL EVENTS
========================================= */

function initializeModals() {

    $("close-modal").addEventListener(
        "click",
        closeAccountDetail
    );

    $("close-detail-btn").addEventListener(
        "click",
        closeAccountDetail
    );

    $("account-modal").addEventListener(
        "click",
        event => {
            if (
                event.target === $("account-modal") ||
                event.target.hasAttribute("data-close-modal")
            ) {
                closeAccountDetail();
            }
        }
    );

    $("close-role-modal").addEventListener(
        "click",
        closeRoleModal
    );

    $("cancel-role").addEventListener(
        "click",
        closeRoleModal
    );

    $("role-modal").addEventListener(
        "click",
        event => {
            if (
                event.target === $("role-modal") ||
                event.target.hasAttribute("data-close-role-modal")
            ) {
                closeRoleModal();
            }
        }
    );

    $("role-form").addEventListener(
        "submit",
        updateAccountRole
    );

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {
                closeAccountDetail();
                closeRoleModal();
            }

        }
    );

}

/* =========================================
   INITIALIZE
========================================= */

function initializePage() {

    $("refresh-btn").addEventListener(
        "click",
        loadAccounts
    );

    $("account-search").addEventListener(
        "input",
        handleSearch
    );

    $("role-filter").addEventListener(
        "change",
        handleRoleFilter
    );

    $("locked-filter").addEventListener(
        "change",
        handleLockedFilter
    );

    $("clear-filter").addEventListener(
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

    $("account-table-body").addEventListener(
        "click",
        handleTableAction
    );

    $("globalSearch").addEventListener(
        "input",
        event => {
            $("account-search").value = event.target.value;

            state.keyword = event.target.value;

            clearTimeout(state.searchTimer);

            state.searchTimer = setTimeout(() => {
                state.currentPage = 0;
                loadAccounts();
            }, 400);
        }
    );

    $("logoutButton").addEventListener(
        "click",
        logout
    );

    initializeModals();

    loadAccounts();

}

document.addEventListener(
    "DOMContentLoaded",
    initializePage
);
