
(() => {
    "use strict";

    /* ==========================================
       1. API CONFIGURATION

       THAY 2 ENDPOINT BẰNG API BACKEND THỰC TẾ.
       Không sử dụng fake data.
    ========================================== */

    const API_BASE_URL = "http://localhost:8080";

    const API = {
        restaurant: (id) =>
            `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(id)}`,

        menu: (id) =>
            `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(id)}/menu`
    };

    const params = new URLSearchParams(window.location.search);
    const restaurantId = params.get("id");

    let currentRestaurant = null;
    let allDishes = [];
    let currentCategory = "all";
    let currentSearch = "";
    let toastTimeout = null;

    /* ==========================================
       2. DOM HELPERS
    ========================================== */

    const $ = (selector) => document.querySelector(selector);

    function setText(selector, value) {
        const element = $(selector);

        if (!element) return;

        element.textContent = value ?? "";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function unwrapResponse(response) {
        if (response && typeof response === "object" && "data" in response) {
            return response.data;
        }

        return response;
    }

    function showStatus(message, isError = false) {
        const status = $("#restaurant-status");

        if (!status) return;

        status.textContent = message;
        status.classList.remove("hidden");
        status.classList.toggle("restaurant-error", isError);
    }

    function hideStatus() {
        $("#restaurant-status")?.classList.add("hidden");
    }

    function showToast(message) {
        const toast = $("#restaurant-toast");

        if (!toast) return;

        clearTimeout(toastTimeout);

        toast.textContent = message;
        toast.classList.add("show");

        toastTimeout = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function setVisible(selector, visible, displayClass = "flex") {
        const element = $(selector);

        if (!element) return;

        element.classList.toggle("hidden", !visible);

        if (visible) {
            element.classList.add(displayClass);
        } else {
            element.classList.remove(displayClass);
        }
    }

    function setImage(selector, imageUrl) {
        const element = $(selector);

        if (!element) return;

        element.style.backgroundImage = "";

        if (typeof imageUrl === "string" && imageUrl.trim()) {
            const url = resolveImageUrl(imageUrl);

            if (url) {
                // Avoid interpolating untrusted values into CSS.
                const image = new Image();

                image.onload = () => {
                    element.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
                };

                image.src = url;
            }
        }
    }

    function resolveImageUrl(value) {
        if (!value || typeof value !== "string") return "";

        try {
            const url = new URL(value, API_BASE_URL);

            if (!["http:", "https:"].includes(url.protocol)) {
                return "";
            }

            return url.href;
        } catch {
            return "";
        }
    }

    function formatPrice(price) {
        if (price === null || price === undefined || price === "") {
            return "";
        }

        const number = Number(price);

        if (!Number.isFinite(number)) return "";

        return `${number.toLocaleString("vi-VN")}đ`;
    }

    /* ==========================================
       3. FETCH API
    ========================================== */

    async function fetchJson(url) {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return unwrapResponse(await response.json());
    }

    /* ==========================================
       4. NORMALIZE RESTAURANT DATA
    ========================================== */

    function normalizeRestaurant(raw) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error("Dữ liệu nhà hàng không hợp lệ.");
        }

        return {
            id: raw.id ?? raw.restaurantId,
            name: raw.name ?? raw.restaurantName ?? "",
            address: raw.address ?? "",
            phone: raw.phone ?? raw.phoneNumber ?? "",
            region: raw.regionName ?? raw.city ?? "",
            rating: raw.rating ?? raw.averageRating ?? null,
            reviewCount: raw.reviewCount ?? null,
            cuisine: raw.cuisine ?? raw.categoryName ?? "",
            priceRange: raw.priceRange ?? "",
            openingHours: raw.openingHours ?? "",
            isOpen: raw.isOpen ?? null,
            preparationTime: raw.preparationTime ?? "",
            imageUrl: raw.imageUrl ?? raw.image ?? "",
            images: Array.isArray(raw.images) ? raw.images : [],
            facilities: Array.isArray(raw.facilities)
                ? raw.facilities
                : [],
            certifications: Array.isArray(raw.certifications)
                ? raw.certifications
                : []
        };
    }

    /* ==========================================
       5. RENDER RESTAURANT OVERVIEW
    ========================================== */

    function renderRestaurant(restaurant) {
        currentRestaurant = restaurant;

        setText("#restaurant-name", restaurant.name);
        setText("#breadcrumb-name", restaurant.name);
        setText("#breadcrumb-region", restaurant.region);

        setVisible(
            "#breadcrumb-separator",
            Boolean(restaurant.region),
            "inline"
        );

        document.title = restaurant.name
            ? `${restaurant.name} - FCA Culinary Arts`
            : "FCA Culinary Arts";

        renderGallery(restaurant);
        renderBadges(restaurant);
        renderMeta(restaurant);
        renderContact(restaurant);
        renderFacilities(restaurant);

        $("#restaurant-overview")?.classList.remove("hidden");

        hideStatus();
    }

    /* ==========================================
       6. GALLERY - ORIGINAL 8/4 LAYOUT
    ========================================== */

    function getGalleryImages(restaurant) {
        const images = [];

        if (restaurant.imageUrl) {
            images.push({
                url: restaurant.imageUrl,
                label: ""
            });
        }

        restaurant.images.forEach((item) => {
            const url = typeof item === "string"
                ? item
                : item.url ?? item.imageUrl ?? "";

            const label = typeof item === "string"
                ? ""
                : item.label ?? "";

            if (url && !images.some((image) => image.url === url)) {
                images.push({ url, label });
            }
        });

        return images;
    }

    function renderGallery(restaurant) {
        const images = getGalleryImages(restaurant);

        setImage("#restaurant-main-image", images[0]?.url);
        setImage("#restaurant-side-image-1", images[1]?.url);
        setImage("#restaurant-side-image-2", images[2]?.url);

        [1, 2].forEach((index) => {
            const label = images[index]?.label ?? "";

            setText(`#restaurant-side-label-${index}`, label);

            $(`#restaurant-side-label-${index}`)
                ?.classList.toggle("hidden", !label);
        });
    }

    /* ==========================================
       7. STATUS AND CERTIFICATIONS
    ========================================== */

    function renderBadges(restaurant) {
        const container = $("#restaurant-badges");

        if (!container) return;

        const badges = [];

        if (restaurant.isOpen !== null) {
            badges.push(`
                <span class="px-space-sm py-space-xs rounded-full bg-primary text-on-primary font-label-caps text-label-caps flex items-center gap-1">
                    ${restaurant.isOpen ? "Đang mở cửa" : "Đã đóng cửa"}
                    ${restaurant.openingHours
                        ? `: ${escapeHtml(restaurant.openingHours)}`
                        : ""}
                </span>
            `);
        }

        restaurant.certifications.forEach((item) => {
            const name = typeof item === "string"
                ? item
                : item.name ?? "";

            if (!name) return;

            badges.push(`
                <span class="px-space-sm py-space-xs rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface font-label-caps text-label-caps flex items-center gap-1">
                    <span class="material-symbols-outlined text-primary text-[14px]">
                        verified
                    </span>
                    ${escapeHtml(name)}
                </span>
            `);
        });

        container.innerHTML = badges.join("");
    }

    /* ==========================================
       8. RESTAURANT META
    ========================================== */

    function renderMeta(restaurant) {
        const container = $("#restaurant-meta");

        if (!container) return;

        const items = [];

        if (restaurant.rating !== null) {
            const rating = Number(restaurant.rating);

            if (Number.isFinite(rating)) {
                items.push(`
                    <div class="flex items-center gap-1 text-on-surface font-semibold">
                        <span class="material-symbols-outlined text-primary text-[18px]">
                            star
                        </span>
                        <span>${rating.toFixed(1)}</span>
                        ${restaurant.reviewCount !== null
                            ? `<span class="text-on-surface-variant font-normal">
                                (${escapeHtml(restaurant.reviewCount)} đánh giá)
                               </span>`
                            : ""}
                    </div>
                `);
            }
        }

        if (restaurant.cuisine) {
            items.push(`
                <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-primary text-[18px]">
                        restaurant
                    </span>
                    <span>${escapeHtml(restaurant.cuisine)}</span>
                </div>
            `);
        }

        if (restaurant.priceRange) {
            items.push(`
                <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-primary text-[18px]">
                        payments
                    </span>
                    <span>${escapeHtml(restaurant.priceRange)}</span>
                </div>
            `);
        }

        container.innerHTML = items.join(`
            <span class="text-outline-variant">•</span>
        `);
    }

    /* ==========================================
       9. CONTACT
    ========================================== */

    function renderContact(restaurant) {
        setText("#restaurant-address", restaurant.address);

        setVisible(
            "#restaurant-address-row",
            Boolean(restaurant.address)
        );

        if (restaurant.phone) {
            const phone = $("#restaurant-phone");

            phone.textContent = restaurant.phone;

            phone.href = `tel:${String(restaurant.phone).replace(/[^\d+]/g, "")}`;
        }

        setVisible(
            "#restaurant-phone-row",
            Boolean(restaurant.phone)
        );

        setText(
            "#restaurant-preparation",
            restaurant.preparationTime
        );

        setVisible(
            "#restaurant-preparation-row",
            Boolean(restaurant.preparationTime)
        );
    }

    /* ==========================================
       10. FACILITIES
    ========================================== */

    function renderFacilities(restaurant) {
        const container = $("#restaurant-facilities");

        if (!container) return;

        container.innerHTML = restaurant.facilities.map((item) => {
            const name = typeof item === "string"
                ? item
                : item.name ?? "";

            const icon = typeof item === "string"
                ? "check_circle"
                : item.icon ?? "check_circle";

            if (!name) return "";

            return `
                <div class="flex items-center gap-1.5 px-space-sm py-1 rounded bg-surface-container-low text-on-surface font-label-md text-label-md">
                    <span class="material-symbols-outlined text-primary text-[16px]">
                        ${escapeHtml(icon)}
                    </span>
                    ${escapeHtml(name)}
                </div>
            `;
        }).join("");
    }

    /* ==========================================
       11. NORMALIZE MENU DATA
    ========================================== */

    function normalizeMenu(raw) {
        let items = [];

        if (Array.isArray(raw)) {
            items = raw;
        } else if (Array.isArray(raw?.content)) {
            items = raw.content;
        } else if (Array.isArray(raw?.items)) {
            items = raw.items;
        } else if (Array.isArray(raw?.dishes)) {
            items = raw.dishes;
        } else if (Array.isArray(raw?.categories)) {
            items = raw.categories.flatMap((category) => {
                const dishes = category.dishes ?? category.items ?? [];

                return dishes.map((dish) => ({
                    ...dish,
                    categoryId: category.id,
                    categoryName: category.name
                }));
            });
        }

        return items.map((item) => ({
            id: item.id ?? item.dishId ?? item.menuItemId,
            name: item.name ?? item.dishName ?? "",
            description: item.description ?? "",
            price: item.price ?? null,
            originalPrice: item.originalPrice ?? null,
            imageUrl: item.imageUrl ?? item.image ?? "",
            categoryId: item.categoryId ?? item.category?.id ?? "",
            categoryName:
                item.categoryName ??
                item.category?.name ??
                "",
            available: item.available ?? item.isAvailable ?? true,
            badge: item.badge ?? "",
            preparationTime: item.preparationTime ?? ""
        })).filter((dish) => dish.id != null && dish.name);
    }

    /* ==========================================
       12. CATEGORY NAVIGATION
    ========================================== */

    function getCategories(dishes) {
        const categories = new Map();

        dishes.forEach((dish) => {
            const key = String(dish.categoryId || dish.categoryName || "other");

            if (!categories.has(key)) {
                categories.set(key, {
                    id: key,
                    name: dish.categoryName || "Danh mục khác"
                });
            }
        });

        return [...categories.values()];
    }

    function renderCategoryNavigation(dishes) {
        const container = $("#menu-category-navigation");

        if (!container) return;

        const categories = getCategories(dishes);

        container.innerHTML = categories.map((category, index) => `
            <button
                type="button"
                class="menu-category-button px-space-md py-space-xs rounded-full ${index === 0
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low text-on-surface hover:bg-surface-container"} font-label-md text-label-md whitespace-nowrap transition-colors"
                data-category="${escapeHtml(category.id)}"
            >
                ${escapeHtml(category.name)}
            </button>
        `).join("");

        container.querySelectorAll(".menu-category-button").forEach((button) => {
            button.addEventListener("click", () => {
                const categoryId = button.dataset.category;

                const section = document.getElementById(
                    `category-${CSS.escape(categoryId)}`
                );

                section?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                container.querySelectorAll(".menu-category-button").forEach((tab) => {
                    tab.classList.remove(
                        "bg-primary",
                        "text-on-primary",
                        "shadow-sm"
                    );

                    tab.classList.add(
                        "bg-surface-container-low",
                        "text-on-surface"
                    );
                });

                button.classList.remove(
                    "bg-surface-container-low",
                    "text-on-surface"
                );

                button.classList.add(
                    "bg-primary",
                    "text-on-primary",
                    "shadow-sm"
                );
            });
        });
    }

    /* ==========================================
       13. DISH CARD

       Preserve original card styling.
    ========================================== */

    function renderDishCard(dish) {
        const imageUrl = resolveImageUrl(dish.imageUrl);

        return `
            <article
                class="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
                data-dish-id="${escapeHtml(dish.id)}"
            >

                <div class="relative h-48 w-full overflow-hidden bg-surface-container-low">

                    ${imageUrl
                        ? `<img
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            src="${escapeHtml(imageUrl)}"
                            alt="${escapeHtml(dish.name)}"
                            loading="lazy"
                           >`
                        : ""}

                    ${dish.badge
                        ? `<span class="absolute top-3 left-3 px-space-xs py-0.5 rounded-full bg-primary text-on-primary font-label-caps text-label-caps font-bold shadow-sm">
                            ${escapeHtml(dish.badge)}
                           </span>`
                        : ""}

                    ${dish.preparationTime
                        ? `<span class="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white font-label-caps text-label-caps">
                            ${escapeHtml(dish.preparationTime)}
                           </span>`
                        : ""}

                </div>

                <div class="p-space-md flex flex-col flex-1 justify-between gap-space-sm">

                    <div>

                        <div class="flex items-start justify-between gap-2 mb-1">

                            <h3 class="font-title-md text-title-md text-on-surface group-hover:text-primary transition-colors">
                                ${escapeHtml(dish.name)}
                            </h3>

                        </div>

                        ${dish.description
                            ? `<p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                                ${escapeHtml(dish.description)}
                               </p>`
                            : ""}

                    </div>

                    <div class="flex items-center justify-between pt-space-xs mt-auto">

                        <div class="flex flex-col">

                            <span class="font-title-lg text-title-lg text-on-surface font-bold text-primary">
                                ${formatPrice(dish.price)}
                            </span>

                            ${dish.originalPrice !== null
                                ? `<span class="font-body-sm text-body-sm text-on-surface-variant line-through text-[11px]">
                                    ${formatPrice(dish.originalPrice)}
                                   </span>`
                                : ""}

                        </div>

                        <button
                            type="button"
                            class="add-to-cart-button h-9 px-space-md rounded-lg bg-primary hover:bg-secondary text-on-primary font-label-md text-label-md shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-dish-id="${escapeHtml(dish.id)}"
                            ${dish.available ? "" : "disabled"}
                        >

                            <span class="material-symbols-outlined text-[18px]">
                                add
                            </span>

                            <span>
                                ${dish.available ? "Thêm" : "Hết món"}
                            </span>

                        </button>

                    </div>

                </div>

            </article>
        `;
    }

    /* ==========================================
       14. RENDER MENU
    ========================================== */

    function renderMenu(dishes) {
        const container = $("#menu-items-container");

        if (!container) return;

        const filtered = dishes.filter((dish) => {
            const text = `${dish.name} ${dish.description}`.toLowerCase();

            return text.includes(currentSearch);
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="restaurant-empty">
                    Không tìm thấy món ăn phù hợp.
                </div>
            `;

            return;
        }

        const categories = getCategories(filtered);

        container.innerHTML = categories.map((category) => {
            const categoryDishes = filtered.filter((dish) => {
                const key = String(
                    dish.categoryId || dish.categoryName || "other"
                );

                return key === category.id;
            });

            return `
                <div
                    class="flex flex-col gap-space-md scroll-mt-36"
                    id="category-${escapeHtml(category.id)}"
                >

                    <div class="flex items-center justify-between pb-space-xs">

                        <div class="flex items-center gap-space-xs">

                            <span class="w-2.5 h-6 rounded-full bg-primary"></span>

                            <h2 class="font-headline-sm text-headline-sm text-on-surface">
                                ${escapeHtml(category.name)}
                            </h2>

                        </div>

                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-space-md lg:grid-cols-3 2xl:grid-cols-4">

                        ${categoryDishes.map(renderDishCard).join("")}

                    </div>

                </div>
            `;
        }).join("");
    }

    /* ==========================================
       15. LOAD RESTAURANT
    ========================================== */

    async function loadRestaurant() {
        if (!restaurantId) {
            showStatus(
                "Thiếu mã nhà hàng. Vui lòng chọn nhà hàng từ trang chủ.",
                true
            );
            return;
        }

        showStatus("Đang tải thông tin nhà hàng...");

        try {
            const raw = await fetchJson(API.restaurant(restaurantId));

            const restaurant = normalizeRestaurant(raw);

            renderRestaurant(restaurant);
        } catch (error) {
            console.error("[FCA] Restaurant API error:", error);

            showStatus(
                "Không thể tải thông tin nhà hàng. Vui lòng thử lại.",
                true
            );
        }
    }

    /* ==========================================
       16. LOAD MENU
    ========================================== */

    async function loadMenu() {
        if (!restaurantId) return;

        try {
            const raw = await fetchJson(API.menu(restaurantId));

            allDishes = normalizeMenu(raw);

            if (allDishes.length === 0) {
                $("#menu-toolbar")?.classList.add("hidden");
                $("#menu-section")?.classList.remove("hidden");

                $("#menu-items-container").innerHTML = `
                    <div class="restaurant-empty">
                        Nhà hàng hiện chưa có món ăn.
                    </div>
                `;

                return;
            }

            $("#menu-toolbar")?.classList.remove("hidden");
            $("#menu-section")?.classList.remove("hidden");

            renderCategoryNavigation(allDishes);
            renderMenu(allDishes);

        } catch (error) {
            console.error("[FCA] Menu API error:", error);

            $("#menu-section")?.classList.remove("hidden");

            $("#menu-items-container").innerHTML = `
                <div class="restaurant-empty restaurant-error">
                    Không thể tải thực đơn từ hệ thống.
                </div>
            `;
        }
    }

    /* ==========================================
       17. SEARCH
    ========================================== */

    function setupSearch() {
        const menuSearch = $("#menu-search");

        menuSearch?.addEventListener("input", (event) => {
            currentSearch = event.target.value
                .trim()
                .toLowerCase();

            renderMenu(allDishes);
        });

        $("#header-search")?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;

            const value = event.target.value.trim();

            if (!value) return;

            if (menuSearch) {
                menuSearch.value = value;
                currentSearch = value.toLowerCase();

                renderMenu(allDishes);

                $("#menu-section")?.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });
    }

    /* ==========================================
       18. CART / BOOKING

       Do not fake successful actions.
    ========================================== */

    function setupActions() {
        $("#menu-items-container")?.addEventListener("click", (event) => {
            const button = event.target.closest(".add-to-cart-button");

            if (!button) return;

            const dishId = button.dataset.dishId;

            const dish = allDishes.find(
                (item) => String(item.id) === dishId
            );

            if (!dish || !dish.available) return;

            // Chưa có API giỏ hàng thực tế.
            // Không tự tăng cart-count hoặc báo thêm thành công.
            showToast("Chức năng giỏ hàng chưa được kết nối.");
        });

        $("#book-table-button")?.addEventListener("click", () => {
            showToast("Chức năng đặt bàn chưa được kết nối.");
        });

        $("#menu-filter-button")?.addEventListener("click", () => {
            showToast("Bộ lọc nâng cao chưa được kết nối.");
        });
    }

    /* ==========================================
       19. INITIALIZATION
    ========================================== */

    async function init() {
        setupSearch();
        setupActions();

        if (!restaurantId) {
            showStatus(
                "Không tìm thấy mã nhà hàng trên đường dẫn.",
                true
            );
            return;
        }

        await Promise.all([
            loadRestaurant(),
            loadMenu()
        ]);
    }

    document.addEventListener("DOMContentLoaded", init);

})();
