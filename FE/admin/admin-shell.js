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
        if (event.key === "adminAccessToken" && !event.newValue) {
            window.location.replace("../login.html");
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeShell, { once: true });
    } else {
        initializeShell();
    }
})();
