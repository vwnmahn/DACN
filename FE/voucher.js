
/* ============================================================
   FCA CULINARY - VOUCHER JAVASCRIPT
   Data source: Spring Boot REST API
   Không sử dụng fake data.
   ============================================================ */

(() => {
    "use strict";

    const container = document.getElementById("voucher-cards-container");

    if (!container) return;

    const categoryButtons = document.querySelectorAll(".category-btn");
    const regionSelect = document.getElementById("voucher-region");
    const sortSelect = document.getElementById("voucher-sort");
    const countElement = document.getElementById("voucher-count");
    const retryButton = document.getElementById("voucher-retry");
    const voucherForm = document.getElementById("voucher-form");
    const codeInput = document.getElementById("input-voucher-code");
    const codeMessage = document.getElementById("voucher-code-message");

    // Điền URL API GET voucher thực tế vào data-api-url trong HTML.
    const API_URL = container.dataset.apiUrl?.trim() || "";

    let vouchers = [];
    let currentCategory = "all";
    let currentRegion = "all";
    let toastTimer = null;

    /* ========================================================
       UTILITIES
       ======================================================== */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function showToast(message) {
        const toast = document.getElementById("voucher-toast");
        const toastMessage = document.getElementById("toast-message");

        if (!toast || !toastMessage) return;

        toastMessage.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3200);
    }

    function showStatus(message) {
        container.replaceChildren();

        const paragraph = document.createElement("p");
        paragraph.className =
            "col-span-full text-center text-slate-500 py-12";
        paragraph.setAttribute("role", "status");
        paragraph.textContent = message;

        container.appendChild(paragraph);
    }

    function formatDate(value) {
        if (!value) return "Chưa cập nhật";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Chưa cập nhật";
        }

        return new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).format(date);
    }

    function formatDiscount(value) {
        if (value === null || value === undefined || value === "") {
            return "";
        }

        const number = Number(value);

        if (!Number.isFinite(number)) return "";

        return new Intl.NumberFormat("vi-VN").format(number) + "đ";
    }

    function normalizeText(value) {
        return String(value ?? "").trim().toLowerCase();
    }

    function getVoucherCode(voucher) {
        return String(voucher.code ?? "").trim();
    }

    function isExpired(voucher) {
        if (!voucher.expiresAt) return false;

        const expiry = new Date(voucher.expiresAt);

        if (Number.isNaN(expiry.getTime())) return false;

        // Tránh tự suy diễn ngày hết hạn khi DTO chỉ chứa ngày.
        if (/^\d{4}-\d{2}-\d{2}$/.test(voucher.expiresAt)) {
            return voucher.expiresAt < new Date().toLocaleDateString(
                "en-CA",
                { timeZone: "Asia/Ho_Chi_Minh" }
            );
        }

        return expiry.getTime() < Date.now();
    }

    /* ========================================================
       RENDER VOUCHER CARDS
       ======================================================== */

    function renderVoucherCard(voucher) {
        const code = escapeHTML(getVoucherCode(voucher));
        const title = escapeHTML(voucher.title);
        const description = escapeHTML(voucher.description);
        const brandName = escapeHTML(voucher.brandName || "FCA Culinary");
        const category = escapeHTML(voucher.category || "");
        const region = escapeHTML(voucher.region || "");
        const expiresAt = formatDate(voucher.expiresAt);

        const discount = formatDiscount(voucher.discountValue);

        const expired = isExpired(voucher);

        return `
            <article
                class="voucher-card"
                data-category="${category}"
                data-region="${region}"
            >

                <div class="voucher-card-top">

                    <div class="flex items-start justify-between gap-3">

                        <div class="flex items-center gap-3 min-w-0">

                            <div class="w-10 h-10 shrink-0 rounded-xl
                                        bg-emerald-50 text-emerald-700
                                        flex items-center justify-center">

                                <span class="material-symbols-outlined">
                                    confirmation_number
                                </span>
                            </div>

                            <div class="min-w-0">
                                <p class="text-[11px] uppercase font-bold
                                          tracking-wide text-emerald-700">
                                    ${brandName}
                                </p>

                                <h3 class="font-bold text-base text-slate-900 mt-1">
                                    ${title}
                                </h3>
                            </div>

                        </div>

                        ${category ? `
                            <span class="shrink-0 px-2 py-1 rounded-md
                                         bg-emerald-50 text-emerald-700
                                         text-[10px] font-bold">
                                ${category}
                            </span>
                        ` : ""}

                    </div>

                    <p class="text-sm text-slate-500 mt-5 leading-relaxed">
                        ${description}
                    </p>

                    ${discount ? `
                        <p class="text-sm font-bold text-emerald-700 mt-4">
                            Giá trị ưu đãi: ${discount}
                        </p>
                    ` : ""}

                    ${region ? `
                        <div class="flex items-center gap-1 mt-4
                                    text-xs text-slate-500">
                            <span class="material-symbols-outlined text-[17px]">
                                location_on
                            </span>
                            <span>${region}</span>
                        </div>
                    ` : ""}

                </div>

                <div class="voucher-ticket-divider">
                    <div class="voucher-ticket-line"></div>
                </div>

                <div class="voucher-card-bottom">

                    <div class="flex items-center justify-between gap-3">

                        <div class="min-w-0">
                            <p class="text-[11px] text-slate-500 font-semibold">
                                MÃ ƯU ĐÃI
                            </p>
                            <p class="voucher-code mt-1">
                                ${code || "Chưa có mã"}
                            </p>
                        </div>

                        <button
                            type="button"
                            class="copy-voucher-btn px-3 py-2
                                   rounded-lg bg-slate-100
                                   hover:bg-slate-200
                                   text-xs font-semibold shrink-0"
                            data-code="${code}"
                            ${!code ? "disabled" : ""}
                        >
                            Sao chép
                        </button>

                    </div>

                    <div class="flex items-center justify-between gap-3 mt-5">

                        <span class="text-xs text-slate-500">
                            HSD: ${escapeHTML(expiresAt)}
                        </span>

                        <button
                            type="button"
                            class="voucher-action use-voucher-btn"
                            data-code="${code}"
                            ${expired || !code ? "disabled" : ""}
                        >
                            ${expired ? "Đã hết hạn" : "Dùng ngay"}
                        </button>

                    </div>

                </div>

            </article>
        `;
    }

    /* ========================================================
       FILTER AND SORT
       ======================================================== */

    function getFilteredVouchers() {
        const filtered = vouchers.filter((voucher) => {
            const category = normalizeText(voucher.category);
            const region = normalizeText(voucher.region);

            const categoryMatches =
                currentCategory === "all" ||
                category === currentCategory;

            const regionMatches =
                currentRegion === "all" ||
                region === "all" ||
                region === currentRegion;

            return categoryMatches && regionMatches;
        });

        const sortMode = sortSelect?.value || "newest";

        filtered.sort((a, b) => {
            if (sortMode === "expiring") {
                const aTime = Date.parse(a.expiresAt) || Infinity;
                const bTime = Date.parse(b.expiresAt) || Infinity;

                return aTime - bTime;
            }

            if (sortMode === "discount") {
                return (
                    Number(b.discountValue || 0) -
                    Number(a.discountValue || 0)
                );
            }

            const aTime = Date.parse(a.createdAt) || 0;
            const bTime = Date.parse(b.createdAt) || 0;

            return bTime - aTime;
        });

        return filtered;
    }

    function renderVouchers() {
        const filtered = getFilteredVouchers();

        if (countElement) {
            countElement.textContent =
                `Hiển thị ${filtered.length} / ${vouchers.length} voucher`;
        }

        if (filtered.length === 0) {
            showStatus("Không có voucher phù hợp với bộ lọc.");
            return;
        }

        container.innerHTML = filtered
            .map(renderVoucherCard)
            .join("");
    }

    /* ========================================================
       LOAD DATA FROM SPRING BOOT
       ======================================================== */

    async function loadVouchers() {
        if (!API_URL) {
            showStatus(
                "Chưa cấu hình API voucher. " +
                "Vui lòng kết nối Backend để hiển thị ưu đãi."
            );

            if (countElement) {
                countElement.textContent =
                    "Danh sách voucher chưa được kết nối.";
            }

            if (retryButton) {
                retryButton.classList.add("hidden");
            }

            return;
        }

        showStatus("Đang tải danh sách voucher...");

        if (retryButton) {
            retryButton.classList.add("hidden");
        }

        try {
            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            // Hỗ trợ mảng trực tiếp hoặc ApiResponse.data.
            // Cần chỉnh lại nếu DTO Backend khác cấu trúc này.
            const data = Array.isArray(result)
                ? result
                : result.data;

            if (!Array.isArray(data)) {
                throw new Error(
                    "API không trả về danh sách voucher hợp lệ."
                );
            }

            vouchers = data;

            renderVouchers();

        } catch (error) {
            console.error("[FCA Voucher] Load error:", error);

            showStatus(
                "Không thể tải danh sách voucher. " +
                "Vui lòng thử lại sau."
            );

            if (countElement) {
                countElement.textContent =
                    "Không tải được dữ liệu ưu đãi.";
            }

            if (retryButton) {
                retryButton.classList.remove("hidden");
            }
        }
    }

    /* ========================================================
       COPY VOUCHER CODE
       ======================================================== */

    async function copyCode(code) {
        if (!code) return;

        try {
            await navigator.clipboard.writeText(code);

            showToast(`Đã sao chép mã ${code}`);

        } catch (error) {
            const textarea = document.createElement("textarea");
            textarea.value = code;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";

            document.body.appendChild(textarea);
            textarea.select();

            const copied = document.execCommand("copy");

            textarea.remove();

            showToast(
                copied
                    ? `Đã sao chép mã ${code}`
                    : "Không thể sao chép mã."
            );
        }
    }

    /* ========================================================
       VOUCHER ACTIONS
       ======================================================== */

    function useVoucher(code) {
        if (!code) return;

        // Chưa có API áp dụng voucher và luồng checkout.
        // Không giả lập trạng thái áp dụng thành công.

        if (codeInput) {
            codeInput.value = code;
        }

        showToast(
            "Đã chọn mã voucher. " +
            "Cần xác thực với Backend khi đặt hàng."
        );
    }

    function checkManualCode(event) {
        event.preventDefault();

        const code = codeInput?.value.trim().toUpperCase();

        if (!code) {
            if (codeMessage) {
                codeMessage.textContent =
                    "Vui lòng nhập mã voucher.";
            }
            return;
        }

        const matched = vouchers.find(
            (voucher) =>
                getVoucherCode(voucher).toUpperCase() === code
        );

        if (!matched) {
            if (codeMessage) {
                codeMessage.textContent =
                    "Không tìm thấy mã trong danh sách đã tải. " +
                    "Chưa thể xác thực mã với Backend.";
            }
            return;
        }

        if (isExpired(matched)) {
            if (codeMessage) {
                codeMessage.textContent =
                    "Voucher này đã hết hạn.";
            }
            return;
        }

        if (codeMessage) {
            codeMessage.textContent =
                "Đã tìm thấy voucher trong danh sách. " +
                "Điều kiện sử dụng cần được Backend xác thực khi đặt hàng.";
        }
    }

    /* ========================================================
       EVENTS
       ======================================================== */

    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (button.classList.contains("active")) return;

            document.querySelector(".category-btn.active")
                ?.classList.remove("active");

            button.classList.add("active");

            currentCategory = button.dataset.category || "all";

            renderVouchers();
        });
    });

    regionSelect?.addEventListener("change", () => {
        currentRegion = regionSelect.value;
        renderVouchers();
    });

    sortSelect?.addEventListener("change", renderVouchers);

    retryButton?.addEventListener("click", loadVouchers);

    voucherForm?.addEventListener("submit", checkManualCode);

    container.addEventListener("click", (event) => {
        const copyButton = event.target.closest(".copy-voucher-btn");

        if (copyButton) {
            copyCode(copyButton.dataset.code);
            return;
        }

        const useButton = event.target.closest(".use-voucher-btn");

        if (useButton) {
            useVoucher(useButton.dataset.code);
        }
    });

    /* ========================================================
       INITIALIZE
       ======================================================== */

    loadVouchers();

})();
