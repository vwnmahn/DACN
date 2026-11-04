(function () {
    "use strict";

    const pages = [
        { file: "dashboard.html", icon: "dashboard", label: "Tổng quan" },
        { file: "admin-branches.html", icon: "store", label: "Nhà hàng & Chi nhánh" },
        { file: "menu-management.html", icon: "restaurant", label: "Thực đơn & Món ăn" },
        { file: "reservations-orders.html", icon: "event_note", label: "Đặt bàn & Đơn hàng" },
        { file: "admin-revenue.html", icon: "monitoring", label: "Doanh thu & Báo cáo" },
        { file: "admin-accounts.html", icon: "manage_accounts", label: "Tài khoản & Phân quyền" }
    ];
    const API_ORIGIN = "http://localhost:8080";
    const ADMIN_REFRESH_LOCK_KEY = "fca_admin_refresh_lock";
    const adminRefreshOwner = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let adminRefreshTimer = null;

    const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

    function tokenExpiration(token) {
        try {
            const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
            return Number(JSON.parse(atob(padded)).exp) * 1000;
        } catch {
            return NaN;
        }
    }

    function clearAdminSession() {
        localStorage.removeItem("adminAccessToken");
        localStorage.removeItem("adminRefreshToken");
    }

    function scheduleAdminRefresh() {
        window.clearTimeout(adminRefreshTimer);
        const expiration = tokenExpiration(localStorage.getItem("adminAccessToken") || "");
        if (!Number.isFinite(expiration) || !localStorage.getItem("adminRefreshToken")) return;
        adminRefreshTimer = window.setTimeout(() => {
            refreshAdminSession().catch(() => {});
        }, Math.max(0, expiration - Date.now() - 60000));
    }

    async function performAdminRefresh() {
        const currentExpiration = tokenExpiration(localStorage.getItem("adminAccessToken") || "");
        if (Number.isFinite(currentExpiration) && currentExpiration > Date.now() + 60000) {
            scheduleAdminRefresh();
            return localStorage.getItem("adminAccessToken");
        }

        const refreshToken = localStorage.getItem("adminRefreshToken");
        if (!refreshToken) throw new Error("Không có refresh token ADMIN.");
        let response;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        try {
            response = await fetch(`${API_ORIGIN}/api/v1/auth/refresh`, {
                method: "POST",
                headers: { Accept: "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
                signal: controller.signal
            });
        } catch (error) {
            adminRefreshTimer = window.setTimeout(scheduleAdminRefresh, 30000);
            throw error;
        } finally {
            window.clearTimeout(timeout);
        }

        const payload = await response.json().catch(() => ({}));
        const data = payload.data ?? payload;
        if (localStorage.getItem("adminRefreshToken") !== refreshToken) {
            scheduleAdminRefresh();
            return localStorage.getItem("adminAccessToken");
        }
        if (!response.ok || !data?.accessToken) {
            if ([400, 401, 403].includes(response.status)) {
                clearAdminSession();
                window.location.replace("../login.html");
            } else {
                adminRefreshTimer = window.setTimeout(() => refreshAdminSession().catch(() => {}), 30000);
            }
            throw new Error(payload.message || "Không thể làm mới phiên đăng nhập ADMIN.");
        }

        localStorage.setItem("adminAccessToken", data.accessToken);
        if (data.refreshToken) localStorage.setItem("adminRefreshToken", data.refreshToken);
        scheduleAdminRefresh();
        return data.accessToken;
    }

    function refreshAdminSession() {
        if (navigator.locks?.request) {
            return navigator.locks.request("fca-admin-auth-refresh", performAdminRefresh);
        }
        return refreshAdminSessionWithLease();
    }

    async function refreshAdminSessionWithLease() {
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline) {
            let lock = null;
            try { lock = JSON.parse(localStorage.getItem(ADMIN_REFRESH_LOCK_KEY) || "null"); } catch {}
            if (lock?.owner !== adminRefreshOwner && Number(lock?.expiresAt) > Date.now()) {
                await wait(100);
                continue;
            }

            localStorage.setItem(ADMIN_REFRESH_LOCK_KEY, JSON.stringify({
                owner: adminRefreshOwner,
                expiresAt: Date.now() + 20000
            }));
            await wait(25);
            let confirmed = null;
            try { confirmed = JSON.parse(localStorage.getItem(ADMIN_REFRESH_LOCK_KEY) || "null"); } catch {}
            if (confirmed?.owner !== adminRefreshOwner) continue;

            try {
                return await performAdminRefresh();
            } finally {
                let current = null;
                try { current = JSON.parse(localStorage.getItem(ADMIN_REFRESH_LOCK_KEY) || "null"); } catch {}
                if (current?.owner === adminRefreshOwner) localStorage.removeItem(ADMIN_REFRESH_LOCK_KEY);
            }
        }
        throw new Error("Không thể khóa thao tác làm mới phiên ADMIN.");
    }

    function currentFile() {
        return window.location.pathname.split("/").pop() || "dashboard.html";
    }

    function sidebarMarkup(activeFile) {
        const links = pages.map(page => `
            <a href="${page.file}" class="nav-link${page.file === activeFile ? " active" : ""}"
               ${page.file === activeFile ? 'aria-current="page"' : ""}>
                <span class="material-symbols-outlined">${page.icon}</span>
                <span>${page.label}</span>
            </a>`).join("");

        return `
            <div>
                <div class="brand">
                    <div class="brand-logo"><span class="material-symbols-outlined">restaurant_menu</span></div>
                    <div>
                        <div class="brand-name">FCA Culinary</div>
                        <div class="brand-subtitle">ADMIN PORTAL</div>
                    </div>
                </div>
                <div class="sidebar-section">
                    <p class="sidebar-heading">QUẢN TRỊ HỆ THỐNG</p>
                    <nav class="sidebar-nav" aria-label="Điều hướng quản trị">${links}</nav>
                </div>
            </div>
            <div class="sidebar-bottom">
                <div class="sidebar-user">
                    <div class="avatar"><span class="material-symbols-outlined">person</span></div>
                    <div class="user-info">
                        <strong id="sidebarAdminName">Quản trị viên</strong>
                        <span id="sidebarAdminEmail">Đang tải thông tin...</span>
                    </div>
                    <button class="icon-button logout-button" id="logoutButton" type="button" title="Đăng xuất">
                        <span class="material-symbols-outlined">logout</span>
                    </button>
                </div>
            </div>`;
    }

    function topbarMarkup() {
        return `
            <button class="icon-button mobile-menu-button" id="mobileMenuButton" type="button" aria-label="Mở menu">
                <span class="material-symbols-outlined">menu</span>
            </button>
            <div class="search-box">
                <span class="material-symbols-outlined">search</span>
                <input type="search" id="globalSearch" placeholder="Tìm kiếm trong trang quản trị...">
            </div>
            <div class="topbar-actions">
                <div class="language-label"><span class="material-symbols-outlined">language</span><span>VN (Tiếng Việt)</span></div>
                <button class="icon-button notification-button" id="notificationButton" type="button" aria-label="Thông báo">
                    <span class="material-symbols-outlined">notifications</span>
                </button>
                <div class="topbar-divider"></div>
                <div class="topbar-user">
                    <div class="avatar"><span class="material-symbols-outlined">person</span></div>
                    <span id="topbarAdminName">Quản trị viên</span>
                </div>
            </div>`;
    }

    function initializeShell() {
        if (!localStorage.getItem("adminAccessToken")) {
            window.location.replace("../login.html");
            return;
        }
        scheduleAdminRefresh();

        const layout = document.querySelector("body > .admin-layout, body > .app-layout");
        const sidebar = layout?.querySelector(":scope > .sidebar");
        const topbar = layout?.querySelector(".topbar");
        const main = layout?.querySelector(":scope > .main-wrapper, :scope > .main-area, :scope > .main-content");

        if (!sidebar || !topbar || !main) return;

        sidebar.id = "sidebar";
        sidebar.className = "sidebar admin-shell-sidebar";
        sidebar.innerHTML = sidebarMarkup(currentFile());

        topbar.className = "topbar admin-shell-topbar";
        topbar.innerHTML = topbarMarkup();
        main.classList.add("admin-shell-main");

        const openButton = document.getElementById("mobileMenuButton");
        const close = () => sidebar.classList.remove("open");

        openButton.addEventListener("click", () => sidebar.classList.toggle("open"));
        sidebar.querySelectorAll(".sidebar-nav a").forEach(link => link.addEventListener("click", close));

        document.getElementById("logoutButton")?.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            localStorage.removeItem("adminAccessToken");
            localStorage.removeItem("adminRefreshToken");
            window.location.replace("../login.html");
        }, { capture: true });
    }

    window.addEventListener("pageshow", () => {
        if (!localStorage.getItem("adminAccessToken")) window.location.replace("../login.html");
    });

    window.addEventListener("storage", event => {
        if (event.key === "adminAccessToken" || event.key === "adminRefreshToken") {
            scheduleAdminRefresh();
        }
        if (event.key === "adminAccessToken" && !event.newValue) {
            window.location.replace("../login.html");
        }
    });

    window.FCA_ADMIN_AUTH = {
        refreshAccessToken: refreshAdminSession
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeShell, { once: true });
    } else {
        initializeShell();
    }
})();
