
/* ============================================================
   FCA CULINARY - CART PAGE
   - Giỏ hàng: tăng/giảm số lượng, xóa món, xóa toàn bộ
   - Tính tổng tiền và đồng bộ badge
   - Tải / áp dụng / bỏ voucher qua Spring Boot API
   - Refresh access token khi nhận HTTP 401
   - Món gợi ý, popup xác nhận xóa
   - Không yêu cầu GPS khi áp dụng voucher
   - Giữ giao diện voucher ổn định trong lúc validate
   ============================================================ */

(() => {
  "use strict";

  /* ========================== CONFIG ========================== */

  const CART_STORAGE_KEY = "fca_cart";
  const API_BASE_URL = "http://localhost:8080";
  const AUTH_REFRESH_URL = `${API_BASE_URL}/api/v1/auth/refresh`;

  const API = {
    voucherList: `${API_BASE_URL}/api/v1/vouchers/mine`,
    validateVoucher: `${API_BASE_URL}/api/v1/vouchers/validate`,
    deliveryAvailability: `${API_BASE_URL}/api/v1/checkout/delivery-availability`,
    updateCart: null,
    removeCartItem: null,
    clearCart: null,
    upsells: null
  };

  const VOUCHER_VALIDATE_DEBOUNCE_MS = 400;
  const $ = id => document.getElementById(id);

  const state = {
    items: [],
    upsells: [],
    subtotal: 0,
    shipping: 0,
    shippingCalculated: false,
    discount: 0,
    couponCode: null,
    activeBranch: null,
    estimatedTime: null,
    loyalty: null,
    originalShipping: 0,
    deliveryLatitude: null,
    deliveryLongitude: null,
    voucherOriginalShipping: null,
    freeShipping: false
  };

  let refreshPromise = null;
  let voucherRequestId = 0;
  let voucherRevalidateTimer = null;

  let availableVouchers = [];
  let selectedVoucherCode = null;
  let voucherListLoaded = false;
  let voucherListLoading = false;
  let voucherValidationPending = false;
  let voucherValidationError = false;

  /* ========================== HELPERS ========================== */

  function formatCurrency(amount) {
    const value = Number(amount);
    return new Intl.NumberFormat("vi-VN").format(
      Number.isFinite(value) ? value : 0
    ) + "đ";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getItemId(item) {
    return String(item?.id ?? "");
  }

  function getRestaurantId(item) {
    return item?.restaurantId ??
      item?.restaurant?.id ??
      item?.restaurant?.restaurantId ??
      null;
  }

  function getItemQuantity(item) {
    const value = Number(item?.quantity);
    return Number.isInteger(value) && value > 0
      ? Math.min(value, 100)
      : 1;
  }

  function getItemPrice(item) {
    const value = Number(item?.price);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function normalizeCartItems(items) {
    if (!Array.isArray(items)) return [];

    return items
      .filter(item => item && item.id != null && getRestaurantId(item) != null)
      .map(item => ({
        ...item,
        id: item.id,
        restaurantId: getRestaurantId(item),
        name: String(item.name ?? item.menuItemName ?? "Món ăn"),
        price: getItemPrice(item),
        image: String(item.image ?? item.imageUrl ?? ""),
        quantity: getItemQuantity(item)
      }));
  }

  function showToast(message) {
    const toast = $("cart-toast") || $("voucher-toast");
    const messageElement = $("toast-message");

    if (!toast) {
      console.info("[FCA Cart]", message);
      return;
    }

    if (messageElement) messageElement.textContent = message;
    else toast.textContent = message;

    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  async function readResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json().catch(() => null);
    }

    const text = await response.text().catch(() => "");
    return text ? { message: text } : null;
  }

  function unwrapResponse(result) {
    return result?.data ?? result;
  }

  /* ========================== AUTH / TOKEN REFRESH ========================== */

  async function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        throw new Error("Không tìm thấy refreshToken. Vui lòng đăng nhập lại.");
      }

      const response = await fetch(AUTH_REFRESH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      const body = await readResponse(response);
      const data = unwrapResponse(body);

      if (!response.ok || !data?.accessToken) {
        throw new Error(
          body?.message ||
          data?.message ||
          "Không thể làm mới phiên đăng nhập. Vui lòng đăng nhập lại."
        );
      }

      localStorage.setItem("accessToken", data.accessToken);

      if (data.refreshToken) {
        localStorage.setItem("refreshToken", data.refreshToken);
      }

      return data.accessToken;
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function fetchWithAuth(url, options = {}) {
    async function send(token) {
      const headers = new Headers(options.headers || {});
      headers.set("Accept", "application/json");

      if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      if (token) headers.set("Authorization", `Bearer ${token}`);
      else headers.delete("Authorization");

      return fetch(url, { ...options, headers });
    }

    let response = await send(localStorage.getItem("accessToken"));

    if (response.status !== 401) return response;

    const newAccessToken = await refreshAccessToken();
    return send(newAccessToken);
  }

  async function fetchJson(url, options = {}) {
    const response = await fetchWithAuth(url, options);
    const body = await readResponse(response);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
      }

      throw new Error(
        body?.message ||
        body?.error ||
        `API trả về HTTP ${response.status}`
      );
    }

    return unwrapResponse(body);
  }

  /* ========================== CART STORAGE ========================== */

  function getCart() {
    try {
      return normalizeCartItems(
        JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]")
      );
    } catch (error) {
      console.error("Không đọc được giỏ hàng:", error);
      return [];
    }
  }

  function saveCart(items) {
    try {
      const normalized = normalizeCartItems(items);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
      state.items = normalized;
      updateCartBadge(normalized);
      return true;
    } catch (error) {
      console.error("Không lưu được giỏ hàng:", error);
      showToast("Không thể lưu giỏ hàng trên trình duyệt.");
      return false;
    }
  }

  function updateCartBadge(items = getCart()) {
    const count = items.reduce(
      (sum, item) => sum + getItemQuantity(item), 0
    );

    const badge = $("cart-count-badge");

    if (badge) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.dataset.count = String(count);
      badge.classList.toggle("hidden", count === 0);
      badge.classList.toggle("flex", count > 0);
    }

    if ($("summary-item-count")) {
      $("summary-item-count").textContent = count;
    }

    if ($("cart-total-count")) {
      $("cart-total-count").textContent = count;
    }
  }

  /* ========================== CART CALCULATION ========================== */

  function recalculateCart(renderItems = true) {
    const items = getCart();
    state.items = items;

    const subtotal = items.reduce(
      (sum, item) => sum + getItemPrice(item) * getItemQuantity(item),
      0
    );

    state.subtotal = subtotal;

    state.discount = Math.min(
      Math.max(0, Number(state.discount) || 0),
      subtotal + state.shipping
    );

    const total = Math.max(
      0,
      subtotal + state.shipping - state.discount
    );

    const count = items.reduce(
      (sum, item) => sum + getItemQuantity(item), 0
    );

    if ($("summary-subtotal")) {
      $("summary-subtotal").textContent = formatCurrency(subtotal);
    }

    if ($("shipping-final")) {
      $("shipping-final").textContent = items.length && state.shippingCalculated
        ? formatCurrency(state.shipping)
        : "Chưa tính";
    }

    if ($("summary-discount")) {
      $("summary-discount").textContent =
        "-" + formatCurrency(state.discount);
    }

    if ($("discount-row")) {
      const showDiscount =
        Boolean(state.couponCode) && state.discount > 0;

      $("discount-row").classList.toggle("hidden", !showDiscount);
      $("discount-row").classList.toggle("flex", showDiscount);
    }

    if ($("discount-code-label")) {
      $("discount-code-label").textContent = state.couponCode
        ? `(${state.couponCode})`
        : "";
    }

    if ($("summary-grand-total")) {
      $("summary-grand-total").textContent = formatCurrency(total);
    }

    if ($("cta-button-price")) {
      $("cta-button-price").textContent = formatCurrency(total);
    }

    if ($("summary-item-count")) {
      $("summary-item-count").textContent = count;
    }

    if ($("cart-total-count")) {
      $("cart-total-count").textContent = count;
    }

    const checkout = $("checkout-cta");

    if (checkout) {
      const disabled = count === 0 ||
        voucherValidationPending ||
        voucherValidationError;

      checkout.setAttribute("aria-disabled", String(disabled));
      checkout.classList.toggle("opacity-50", disabled);
      checkout.classList.toggle("cursor-not-allowed", disabled);
    }

    updateCartBadge(items);

    if (renderItems) {
      if (items.length === 0) renderEmptyCart();
      else renderCartItems(items);
    }

    return {
      items,
      subtotal,
      shipping: state.shipping,
      discount: state.discount,
      total,
      count
    };
  }

  function renderEmptyCart() {
    const list = $("cart-item-list");
    if (!list) return;

    list.innerHTML = `
      <div class="empty-cart-state p-8 text-center">
        <span class="material-symbols-outlined text-5xl text-outline">shopping_basket</span>
        <p class="font-title-md mt-3">Giỏ hàng của bạn đang trống</p>
        <a href="Home.html" class="inline-flex mt-4 px-4 py-2 rounded-lg bg-primary text-white">
          Khám phá món ăn
        </a>
      </div>`;
  }

  function renderCartItems(items = getCart()) {
    const container = $("cart-item-list");
    if (!container) return;

    state.items = normalizeCartItems(items);

    if (!state.items.length) {
      renderEmptyCart();
      return;
    }

    container.innerHTML = state.items.map(item => {
      const id = escapeHtml(item.id);
      const name = escapeHtml(item.name);
      const image = escapeHtml(item.image);

      const note = item.note
        ? `<p class="font-body-sm mt-1">${escapeHtml(item.note)}</p>`
        : "";

      const badge = item.badge
        ? `<span class="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-xs">${escapeHtml(item.badge)}</span>`
        : "";

      const itemTotal = formatCurrency(
        getItemPrice(item) * getItemQuantity(item)
      );

      return `
        <article class="cart-item bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md transition-all duration-200"
          data-id="${id}"
          data-restaurant-id="${escapeHtml(item.restaurantId)}"
          data-price="${getItemPrice(item)}">
          <div class="flex items-center gap-space-md w-full sm:w-auto min-w-0">
            <div class="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container">
              ${image
                ? `<img class="w-full h-full object-cover" src="${image}" alt="${name}" loading="lazy">`
                : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-[32px]">restaurant</span></div>`}
              ${badge}
            </div>
            <div class="flex flex-col min-w-0">
              <h3 class="font-title-md text-on-surface font-semibold break-words">${name}</h3>
              ${note}
              <p class="sm:hidden mt-2 font-bold text-primary">${formatCurrency(item.price)}</p>
            </div>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0">
            <div class="hidden sm:block text-right">
              <span class="font-title-md font-bold text-on-surface item-total">${itemTotal}</span>
              <div class="text-[11px] text-outline">${formatCurrency(item.price)} / phần</div>
            </div>

            <div class="flex items-center bg-white rounded-lg p-1">
              <button type="button" aria-label="Giảm số lượng"
                class="qty-btn-minus w-8 h-8 rounded flex items-center justify-center"
                data-id="${id}">
                <span class="material-symbols-outlined">remove</span>
              </button>

              <span class="qty-count w-9 text-center font-bold">${item.quantity}</span>

              <button type="button" aria-label="Tăng số lượng"
                class="qty-btn-plus w-8 h-8 rounded flex items-center justify-center"
                data-id="${id}">
                <span class="material-symbols-outlined">add</span>
              </button>
            </div>

            <button type="button" class="btn-remove p-2 rounded-lg"
              data-id="${id}" aria-label="Xóa ${name}" title="Xóa món">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>

          <div class="sm:hidden w-full text-right font-semibold item-total">${itemTotal}</div>
        </article>`;
    }).join("");

    updateCartBadge(state.items);
  }

  // Chỉ cập nhật dòng món thay đổi, không dựng lại toàn bộ danh sách.
  function updateCartItemRow(item) {
    const row = Array.from(
      document.querySelectorAll(".cart-item")
    ).find(element => element.dataset.id === String(item.id));

    if (!row) {
      renderCartItems(getCart());
      return;
    }

    const quantityElement = row.querySelector(".qty-count");

    if (quantityElement) {
      quantityElement.textContent = String(item.quantity);
    }

    const totalText = formatCurrency(
      getItemPrice(item) * getItemQuantity(item)
    );

    row.querySelectorAll(".item-total").forEach(element => {
      element.textContent = totalText;
    });

    row.dataset.price = String(getItemPrice(item));
  }

  /* ========================== DELETE MODAL ========================== */

  const deleteModal = $("delete-confirm-modal");
  const deleteModalMessage = $("delete-modal-message");
  const confirmDeleteBtn = $("confirm-delete-btn");
  const cancelDeleteBtn = $("cancel-delete-btn");

  let pendingDelete = null;
  let previousFocusedElement = null;

  function openDeleteModal(action) {
    if (!deleteModal) {
      showToast("Không tìm thấy popup xác nhận xóa.");
      return;
    }

    pendingDelete = action;
    previousFocusedElement = document.activeElement;

    if (deleteModalMessage) {
      deleteModalMessage.textContent = action.type === "all"
        ? "Bạn có chắc chắn muốn xóa toàn bộ món ăn trong giỏ hàng không?"
        : `Bạn có chắc chắn muốn xóa "${action.name || "món ăn này"}" khỏi giỏ hàng không?`;
    }

    if (confirmDeleteBtn) {
      confirmDeleteBtn.textContent =
        action.type === "all" ? "Xóa tất cả" : "Xóa";
    }

    deleteModal.classList.add("is-open");
    deleteModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("delete-modal-open");
    cancelDeleteBtn?.focus();
  }

  function closeDeleteModal() {
    if (!deleteModal) return;

    deleteModal.classList.remove("is-open");
    deleteModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("delete-modal-open");

    pendingDelete = null;
    previousFocusedElement?.focus?.();
  }

  /* ========================== VOUCHER UI ========================== */

  const applyVoucherBtn = $("apply-voucher-btn");
  const voucherInput = $("voucher-code");
  const voucherTag = $("voucher-applied-tag");
  const voucherTagText = $("voucher-applied-text");
  const voucherRemoveBtn = $("voucher-remove-btn");
  const discountRow = $("discount-row");
  const discountCodeLabel = $("discount-code-label");
  const openVoucherMenuBtn = $("open-voucher-menu-btn");
  const closeVoucherMenuBtn = $("close-voucher-menu-btn");
  const voucherMenu = $("voucher-menu");
  const voucherListContainer = $("cart-voucher-list");
  const confirmSelectedVoucherBtn = $("confirm-selected-voucher-btn");

  function hideAppliedVoucher() {
    voucherTag?.classList.add("hidden");
    voucherTag?.classList.remove("flex");
  }

  function renderAppliedVoucher() {
    if (!state.couponCode) {
      hideAppliedVoucher();
      return;
    }

    voucherTag?.classList.remove("hidden");
    voucherTag?.classList.add("flex");

    if (voucherTagText) {
      voucherTagText.textContent = state.discount > 0
        ? `${state.couponCode} (-${formatCurrency(state.discount)})`
        : `${state.couponCode} (${formatCurrency(0)})`;
    }

    const hasDiscount = state.discount > 0;

    discountRow?.classList.toggle("hidden", !hasDiscount);
    discountRow?.classList.toggle("flex", hasDiscount);

    if (discountCodeLabel) {
      discountCodeLabel.textContent =
        hasDiscount ? `(${state.couponCode})` : "";
    }
  }

  // Giữ nguyên mức giảm hiện tại trong lúc validate.
  function invalidateVoucherIfCartChanged() {
    const code = state.couponCode;
    if (!code) return null;

    clearTimeout(voucherRevalidateTimer);
    voucherRevalidateTimer = null;

    // Vô hiệu hóa mọi phản hồi validate cũ.
    voucherRequestId++;

    voucherValidationPending = true;
    voucherValidationError = false;

    // Không đặt discount = 0 và không gọi renderAppliedVoucher().
    // Nhờ vậy dòng giảm giá không bị ẩn rồi hiện lại.
    if (voucherTag) {
      voucherTag.classList.remove("hidden");
      voucherTag.classList.add("flex");
    }

    if (voucherTagText) {
      voucherTagText.textContent = `${code} (đang cập nhật...)`;
    }

    if (voucherInput) {
      voucherInput.value = code;
    }

    recalculateCart(false);
    return code;
  }

  function scheduleVoucherRevalidation(code) {
    if (!code) return;

    clearTimeout(voucherRevalidateTimer);
    const requestId = voucherRequestId;

    voucherRevalidateTimer = setTimeout(() => {
      voucherRevalidateTimer = null;

      if (requestId !== voucherRequestId) return;
      if (state.couponCode !== code) return;

      revalidateAppliedVoucher(code, requestId);
    }, VOUCHER_VALIDATE_DEBOUNCE_MS);
  }

  /* ========================== VOUCHER LIST ========================== */

  function getVoucherCode(voucher) {
    return String(voucher?.code ?? voucher?.voucherCode ?? "")
      .trim().toUpperCase();
  }

  function getVoucherCategory(voucher) {
    const category = String(
      voucher?.categoryVoucher ??
      voucher?.category_voucher ??
      voucher?.category ??
      ""
    ).toUpperCase();

    const labels = {
      FREE_SHIP: "Miễn phí vận chuyển",
      DISH: "Giảm giá món ăn",
      VIP: "Ưu đãi VIP"
    };

    return labels[category] || "Ưu đãi FCA";
  }

  function getVoucherDiscountText(voucher) {
    const type = String(
      voucher?.discountType ??
      voucher?.discount_type ??
      voucher?.type ??
      ""
    ).toUpperCase();

    const value = Number(
      voucher?.discountValue ??
      voucher?.discount_value ??
      voucher?.discountAmount ??
      voucher?.discount_amount ??
      voucher?.value
    );

    if (!Number.isFinite(value)) return "Xem điều kiện ưu đãi";

    if (type === "PERCENTAGE" || type === "PERCENT") {
      const max = Number(
        voucher?.maxDiscountAmount ?? voucher?.max_discount_amount
      );

      const text = `Giảm ${value}%`;

      return Number.isFinite(max) && max > 0
        ? `${text}, tối đa ${formatCurrency(max)}`
        : text;
    }

    if (type === "FIXED_AMOUNT" || type === "FIXED") {
      return `Giảm ${formatCurrency(value)}`;
    }

    return "Ưu đãi FCA";
  }

  function formatVoucherDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function getVoucherDateText(voucher) {
    const start = formatVoucherDate(
      voucher?.startDate ?? voucher?.start_date
    );
    const end = formatVoucherDate(
      voucher?.redemptionExpiresAt ??
      voucher?.endDate ??
      voucher?.end_date
    );

    if (start && end) return `Hiệu lực: ${start} – ${end}`;
    if (end) return `Hạn sử dụng: ${end}`;
    if (start) return `Bắt đầu từ: ${start}`;

    return "Vui lòng kiểm tra điều kiện sử dụng";
  }

  function getVoucherMinOrder(voucher) {
    const value = Number(
      voucher?.minOrderAmount ?? voucher?.min_order_amount
    );

    return Number.isFinite(value) && value > 0
      ? `Đơn tối thiểu ${formatCurrency(value)}`
      : "";
  }

  function normalizeVoucherList(response) {
    const entries = Array.isArray(response)
      ? response
      : Array.isArray(response?.content)
        ? response.content
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.vouchers)
            ? response.vouchers
            : Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response?.content?.content)
                ? response.content.content
                : [];

    return entries.map(entry => {
      if (!entry?.voucher) return entry;

      return {
        ...entry.voucher,
        redemptionExpiresAt: entry.expiresAt ?? null
      };
    });
  }

  function isVoucherActive(voucher) {
    const customerStatus = String(
      voucher?.customerStatus ?? ""
    ).toUpperCase();

    if (customerStatus && customerStatus !== "AVAILABLE") return false;

    if (voucher?.active === false || voucher?.active === 0) return false;

    if (typeof voucher?.active === "string") {
      const active = voucher.active.toLowerCase();
      if (active === "false" || active === "0") return false;
    }

    const now = Date.now();
    const start = voucher?.startDate ?? voucher?.start_date;
    const end = voucher?.redemptionExpiresAt ??
      voucher?.endDate ??
      voucher?.end_date;

    if (start) {
      const time = new Date(start).getTime();
      if (Number.isFinite(time) && now < time) return false;
    }

    if (end) {
      const time = new Date(end).getTime();
      if (Number.isFinite(time) && now > time) return false;
    }

    const limit = Number(voucher?.usageLimit ?? voucher?.usage_limit);
    const used = Number(voucher?.usedCount ?? voucher?.used_count ?? 0);

    if (Number.isFinite(limit) && limit > 0 && used >= limit) return false;

    return true;
  }

  function renderVoucherList(vouchers) {
    if (!voucherListContainer) return;

    const unique = new Map();

    vouchers.forEach(voucher => {
      const code = getVoucherCode(voucher);
      if (code && !unique.has(code)) unique.set(code, voucher);
    });

    availableVouchers = Array.from(unique.values());

    if (!availableVouchers.length) {
      voucherListContainer.innerHTML = `
        <div class="rounded-lg bg-surface-container-low p-4 text-center">
          <span class="material-symbols-outlined text-3xl text-outline">confirmation_number</span>
          <p class="mt-2 text-sm text-on-surface-variant">Bạn chưa có voucher khả dụng cho đơn hàng này</p>
        </div>`;

      if (confirmSelectedVoucherBtn) {
        confirmSelectedVoucherBtn.disabled = true;
      }

      return;
    }

    voucherListContainer.innerHTML = availableVouchers.map(voucher => {
      const code = getVoucherCode(voucher);
      const active = isVoucherActive(voucher);
      const customerStatus = String(voucher?.customerStatus ?? "").toUpperCase();
      const used = customerStatus === "USED";
      const selected = selectedVoucherCode === code;
      const category = getVoucherCategory(voucher);
      const discount = getVoucherDiscountText(voucher);
      const dateText = getVoucherDateText(voucher);
      const minOrder = getVoucherMinOrder(voucher);

      return `
        <button type="button"
          class="w-full text-left rounded-xl border p-3 transition-all
            ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-outline-variant bg-surface-container-lowest"}
            ${!active ? "opacity-60" : "hover:border-primary"}"
          data-voucher-code="${escapeHtml(code)}"
          aria-pressed="${selected}" ${!active ? "disabled" : ""}>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-2xl">confirmation_number</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <span class="font-bold text-on-surface break-words">${escapeHtml(code)}</span>
                <span class="text-xs font-semibold shrink-0 ${active ? "text-primary" : "text-error"}">
                  ${used ? "Đã sử dụng" : customerStatus === "UNOWNED" ? "Chưa được cấp" : active ? "Khả dụng" : "Không khả dụng"}
                </span>
              </div>
              <p class="mt-1 text-sm font-semibold text-primary">${escapeHtml(discount)}</p>
              <p class="mt-1 text-xs text-on-surface-variant">${escapeHtml(category)}</p>
              <p class="mt-1 text-xs text-outline">${escapeHtml(dateText)}</p>
              ${minOrder ? `<p class="mt-1 text-xs text-outline">${escapeHtml(minOrder)}</p>` : ""}
            </div>
            <span class="material-symbols-outlined text-primary">
              ${selected ? "radio_button_checked" : "radio_button_unchecked"}
            </span>
          </div>
        </button>`;
    }).join("");

    if (confirmSelectedVoucherBtn) {
      const selected = availableVouchers.find(
        voucher => getVoucherCode(voucher) === selectedVoucherCode
      );

      confirmSelectedVoucherBtn.disabled =
        !selected || !isVoucherActive(selected);
    }
  }

  async function loadVouchers(forceReload = false) {
    if (voucherListLoading) return;
    if (voucherListLoaded && !forceReload) return;

    voucherListLoading = true;

    if (voucherListContainer) {
      voucherListContainer.innerHTML = `
        <div class="p-4 text-center text-sm text-on-surface-variant">
          Đang tải danh sách voucher...
        </div>`;
    }

    try {
      await refreshDeliveryFee();
      const payload = await fetchJson(API.voucherList, { method: "GET" });
      const cart = getCart();
      const ownedVouchers = normalizeVoucherList(payload)
        .filter(isVoucherActive);

      const checkedVouchers = await Promise.all(
        ownedVouchers.map(async voucher => {
          const code = getVoucherCode(voucher);
          if (!code || !cart.length) return null;

          const result = await validateVoucherCode(code, cart);
          return result?.valid === true ? voucher : null;
        })
      );

      renderVoucherList(checkedVouchers.filter(Boolean));
      voucherListLoaded = true;
    } catch (error) {
      console.error("Không tải được danh sách voucher:", error);

      if (voucherListContainer) {
        voucherListContainer.innerHTML = `
          <div class="rounded-lg bg-error-container p-3 text-sm">
            <p class="font-semibold">Không tải được danh sách voucher.</p>
            <p class="mt-1">${escapeHtml(error.message || "Vui lòng thử lại.")}</p>
            <button type="button" id="retry-load-vouchers-btn" class="mt-3 font-bold underline">
              Thử tải lại
            </button>
          </div>`;
      }
    } finally {
      voucherListLoading = false;
    }
  }

  function openVoucherMenu() {
    if (!voucherMenu) return;

    voucherMenu.classList.remove("hidden");
    openVoucherMenuBtn?.setAttribute("aria-expanded", "true");
    loadVouchers(true);
  }

  function closeVoucherMenu() {
    if (!voucherMenu) return;

    voucherMenu.classList.add("hidden");
    openVoucherMenuBtn?.setAttribute("aria-expanded", "false");
  }

  /* ========================== APPLY / VALIDATE VOUCHER ========================== */

  function getCommonRestaurantId(cart) {
    if (!cart.length) return null;

    const restaurantIds = new Set(
      cart.map(item => String(getRestaurantId(item)))
    );

    return restaurantIds.size === 1 ? getRestaurantId(cart[0]) : null;
  }

  async function refreshDeliveryFee() {
    const cart = getCart();
    const restaurantId = getCommonRestaurantId(cart);
    if (!restaurantId || !cart.length) {
      state.shipping = 0;
      state.shippingCalculated = false;
      state.originalShipping = 0;
      state.deliveryLatitude = null;
      state.deliveryLongitude = null;
      recalculateCart(false);
      return;
    }

    let location = null;
    try {
      location = JSON.parse(localStorage.getItem("fca_delivery_location") || "null");
    } catch (error) {
      console.warn("Dữ liệu địa chỉ giao hàng không hợp lệ:", error);
      state.shipping = 0;
      state.shippingCalculated = false;
      state.originalShipping = 0;
      state.deliveryLatitude = null;
      state.deliveryLongitude = null;
      recalculateCart(false);
      return;
    }

    if (!location?.address && (location?.latitude == null || location?.longitude == null)) {
      state.shipping = 0;
      state.shippingCalculated = false;
      state.originalShipping = 0;
      state.deliveryLatitude = null;
      state.deliveryLongitude = null;
      recalculateCart(false);
      return;
    }

    state.deliveryLatitude = location.latitude ?? null;
    state.deliveryLongitude = location.longitude ?? null;

    try {
      const result = await fetchJson(API.deliveryAvailability, {
        method: "POST",
        body: JSON.stringify({
          restaurantId: Number(restaurantId),
          deliveryLatitude: location.latitude ?? null,
          deliveryLongitude: location.longitude ?? null,
          deliveryAddress: location.address || null
        })
      });
      const deliveryFee = Number(result?.deliveryFee);
      if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
        throw new Error("Backend trả về phí giao hàng không hợp lệ.");
      }
      state.shipping = deliveryFee;
      state.shippingCalculated = true;
      state.originalShipping = deliveryFee;
      state.deliveryLatitude = result?.deliveryLatitude ?? state.deliveryLatitude;
      state.deliveryLongitude = result?.deliveryLongitude ?? state.deliveryLongitude;
      recalculateCart(false);
    } catch (error) {
      console.warn("Không thể tính phí giao hàng:", error);
      state.shipping = 0;
      state.shippingCalculated = false;
      state.originalShipping = 0;
      state.deliveryLatitude = null;
      state.deliveryLongitude = null;
      recalculateCart(false);
    }
  }

  async function validateVoucherCode(code, cart) {
    const restaurantId = getCommonRestaurantId(cart);

    if (restaurantId == null) {
      return {
        valid: false,
        reason: "Voucher chỉ áp dụng cho giỏ hàng thuộc cùng một nhà hàng."
      };
    }

    let location = null;
    try {
      location = JSON.parse(localStorage.getItem("fca_delivery_location") || "null");
    } catch (error) {
      console.warn("Dữ liệu địa chỉ giao hàng không hợp lệ:", error);
    }

    const latitude = state.deliveryLatitude ?? location?.latitude ?? null;
    const longitude = state.deliveryLongitude ?? location?.longitude ?? null;

    return fetchJson(API.validateVoucher, {
      method: "POST",
      body: JSON.stringify({
        voucherCode: code,
        restaurantId: Number(restaurantId),
        deliveryLatitude: latitude,
        deliveryLongitude: longitude,
        items: cart.map(item => ({
          menuItemId: Number(item.id),
          quantity: getItemQuantity(item)
        }))
      })
    });
  }

  function applyVoucherValidationResult(code, result) {
    const discount = Number(result?.discountAmount);

    if (!Number.isFinite(discount) || discount < 0) {
      throw new Error("Backend trả về số tiền giảm không hợp lệ.");
    }

    state.couponCode = code;
    state.discount = discount;

    if (result.deliveryFee != null) {
      const deliveryFee = Number(result.deliveryFee);

      if (Number.isFinite(deliveryFee) && deliveryFee >= 0) {
        state.shipping = deliveryFee;
        state.shippingCalculated = true;
      }
    }

    voucherValidationPending = false;
    voucherValidationError = false;

    renderAppliedVoucher();
    recalculateCart(false);

    return discount;
  }

  async function revalidateAppliedVoucher(code, expectedRequestId = null) {
    const cart = getCart();
    const requestId = expectedRequestId ?? ++voucherRequestId;

    if (requestId !== voucherRequestId) return;
    if (state.couponCode !== code) return;

    if (!cart.length || getCommonRestaurantId(cart) == null) {
      voucherValidationPending = false;
      voucherValidationError = false;
      state.couponCode = null;
      state.discount = 0;
      selectedVoucherCode = null;

      hideAppliedVoucher();
      renderVoucherList(availableVouchers);
      recalculateCart(false);
      return;
    }

    try {
      const result = await validateVoucherCode(code, cart);

      if (requestId !== voucherRequestId) return;
      if (state.couponCode !== code) return;

      if (result?.valid !== true) {
        voucherValidationPending = false;
        voucherValidationError = false;
        state.couponCode = null;
        state.discount = 0;

        if (selectedVoucherCode === code) {
          selectedVoucherCode = null;
        }

        hideAppliedVoucher();
        renderVoucherList(availableVouchers);
        recalculateCart(false);

        showToast(
          result?.reason ||
          result?.message ||
          "Voucher không còn phù hợp với giỏ hàng."
        );

        return;
      }

      // Chỉ cập nhật khi nhận kết quả hợp lệ.
      applyVoucherValidationResult(code, result);

    } catch (error) {
      if (requestId !== voucherRequestId) return;
      if (state.couponCode !== code) return;

      voucherValidationPending = false;
      voucherValidationError = true;
      state.couponCode = null;
      state.discount = 0;

      hideAppliedVoucher();
      recalculateCart(false);

      console.error("Không thể xác thực lại voucher:", error);
      showToast(
        "Chưa thể xác thực voucher. Vui lòng áp dụng lại trước khi thanh toán."
      );
    }
  }

  async function applySelectedVoucher() {
    const code = selectedVoucherCode;

    const voucher = availableVouchers.find(
      item => getVoucherCode(item) === code
    );

    if (!voucher) {
      showToast("Vui lòng chọn một voucher.");
      return;
    }

    if (!isVoucherActive(voucher)) {
      showToast("Voucher này hiện không khả dụng.");
      return;
    }

    const cart = getCart();

    if (!cart.length) {
      showToast("Hãy thêm món vào giỏ trước khi áp dụng voucher.");
      return;
    }

    if (getCommonRestaurantId(cart) == null) {
      showToast("Voucher chỉ áp dụng cho giỏ hàng thuộc cùng một nhà hàng.");
      return;
    }

    const requestId = ++voucherRequestId;
    voucherValidationPending = true;
    voucherValidationError = false;

    if (confirmSelectedVoucherBtn) {
      confirmSelectedVoucherBtn.disabled = true;
      confirmSelectedVoucherBtn.textContent = "Đang xác thực...";
    }

    try {
      const result = await validateVoucherCode(code, cart);

      if (requestId !== voucherRequestId) return;

      if (result?.valid !== true) {
        voucherValidationPending = false;

        if (state.couponCode === code) {
          state.couponCode = null;
          state.discount = 0;
          hideAppliedVoucher();
          recalculateCart(false);
        }

        showToast(
          result?.reason ||
          result?.message ||
          "Voucher không hợp lệ hoặc không áp dụng được."
        );

        return;
      }

      const discount = applyVoucherValidationResult(code, result);
      closeVoucherMenu();

      showToast(
        discount > 0
          ? `Đã áp dụng voucher ${code}.`
          : `Voucher ${code} hợp lệ nhưng chưa có số tiền giảm.`
      );

    } catch (error) {
      if (requestId !== voucherRequestId) return;

      voucherValidationPending = false;
      console.error("Lỗi xác thực voucher:", error);
      showToast(error.message || "Không thể xác thực voucher.");

    } finally {
      if (confirmSelectedVoucherBtn) {
        confirmSelectedVoucherBtn.textContent = "Áp dụng voucher đã chọn";

        const selected = availableVouchers.find(
          item => getVoucherCode(item) === selectedVoucherCode
        );

        confirmSelectedVoucherBtn.disabled =
          !selected || !isVoucherActive(selected);
      }

      recalculateCart(false);
    }
  }

  async function applyVoucherFromInput() {
    const code = String(voucherInput?.value || "").trim().toUpperCase();

    if (!code) {
      showToast("Vui lòng nhập mã voucher.");
      voucherInput?.focus();
      return;
    }

    if (!voucherListLoaded) await loadVouchers();

    const voucher = availableVouchers.find(
      item => getVoucherCode(item) === code
    );

    if (!voucher) {
      const cart = getCart();

      if (!cart.length) {
        showToast("Hãy thêm món vào giỏ trước khi áp dụng voucher.");
        return;
      }

      try {
        const result = await validateVoucherCode(code, cart);
        showToast(
          result?.reason ||
          result?.message ||
          "Voucher này không khả dụng cho đơn hàng hiện tại."
        );
      } catch (error) {
        showToast(error.message || "Không thể xác thực voucher.");
      }
      return;
    }

    selectedVoucherCode = code;
    renderVoucherList(availableVouchers);
    await applySelectedVoucher();
  }

  /* ========================== CART MUTATIONS ========================== */

  function changeQuantity(id, delta) {
    const items = getCart();
    const item = items.find(entry => getItemId(entry) === String(id));

    if (!item) return;

    const quantity = getItemQuantity(item) + delta;

    if (quantity < 1) {
      showToast("Số lượng tối thiểu là 1.");
      return;
    }

    if (quantity > 100) {
      showToast("Mỗi món chỉ được tối đa 100 phần.");
      return;
    }

    item.quantity = quantity;

    if (!saveCart(items)) return;

    const voucherCode = invalidateVoucherIfCartChanged();

    updateCartItemRow(item);
    recalculateCart(false);

    if (voucherCode) {
      scheduleVoucherRevalidation(voucherCode);
    }

    syncCartToApi("quantity", item).catch(error =>
      console.warn("Chưa đồng bộ số lượng lên API:", error)
    );
  }

  function removeItem(id) {
    const items = getCart();
    const item = items.find(entry => getItemId(entry) === String(id));

    if (!item) return;

    if (!saveCart(
      items.filter(entry => getItemId(entry) !== String(id))
    )) return;

    const voucherCode = invalidateVoucherIfCartChanged();

    recalculateCart(false);
    renderCartItems(getCart());

    if (voucherCode) {
      scheduleVoucherRevalidation(voucherCode);
    }

    showToast(`Đã xóa "${item.name}" khỏi giỏ hàng.`);

    syncCartToApi("remove", item).catch(error =>
      console.warn("Chưa đồng bộ xóa món lên API:", error)
    );
  }

  function clearCart() {
    if (!getCart().length) {
      renderEmptyCart();
      return;
    }

    openDeleteModal({ type: "all" });
  }

  async function syncCartToApi(action, item) {
    const endpoint = action === "remove"
      ? API.removeCartItem
      : API.updateCart;

    if (!endpoint) return;

    await fetchJson(endpoint, {
      method: action === "remove" ? "DELETE" : "PUT",
      body: JSON.stringify({
        id: item.id,
        restaurantId: item.restaurantId,
        quantity: item.quantity
      })
    });
  }

  /* ========================== UPSSELLS ========================== */

  function renderUpsells(upsells = []) {
    const container = $("upsell-container");
    if (!container) return;

    state.upsells = Array.isArray(upsells) ? upsells : [];

    if (!state.upsells.length) {
      container.replaceChildren();
      return;
    }

    container.innerHTML = state.upsells.map(item => `
      <article class="bg-surface-container-low rounded-xl p-3 flex flex-col gap-3"
        data-upsell-id="${escapeHtml(item.id)}">
        <div class="flex gap-3 items-center">
          <div class="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-container">
            ${item.image
              ? `<img class="w-full h-full object-cover" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">`
              : `<span class="material-symbols-outlined">restaurant</span>`}
          </div>
          <div class="min-w-0">
            <h4 class="font-bold">${escapeHtml(item.name)}</h4>
            <p class="text-sm text-outline">${escapeHtml(item.description || "")}</p>
            <p class="font-bold text-primary">${formatCurrency(item.price)}</p>
          </div>
        </div>
        <button type="button" class="add-upsell-btn w-full h-9 rounded-lg font-semibold" data-id="${escapeHtml(item.id)}">
          <span class="material-symbols-outlined align-middle">add</span> Thêm ngay
        </button>
      </article>`).join("");
  }

  function addUpsell(id) {
    const upsell = state.upsells.find(
      item => String(item.id) === String(id)
    );

    if (!upsell) {
      showToast("Không tìm thấy món gợi ý.");
      return;
    }

    const cart = getCart();
    const restaurantId = upsell.restaurantId ?? cart[0]?.restaurantId;

    if (restaurantId == null) {
      showToast("Không xác định được nhà hàng của món gợi ý.");
      return;
    }

    if (cart.some(
      item => String(item.restaurantId) !== String(restaurantId)
    )) {
      showToast("Không thể trộn món từ nhiều nhà hàng.");
      return;
    }

    const existing = cart.find(item =>
      String(item.id) === String(upsell.id) &&
      String(item.restaurantId) === String(restaurantId)
    );

    if (existing) {
      if (existing.quantity >= 100) {
        showToast("Mỗi món chỉ được tối đa 100 phần.");
        return;
      }

      existing.quantity++;
    } else {
      cart.push({
        id: upsell.id,
        restaurantId,
        name: upsell.name,
        price: getItemPrice(upsell),
        image: upsell.image || "",
        quantity: 1
      });
    }

    if (!saveCart(cart)) return;

    const voucherCode = invalidateVoucherIfCartChanged();

    recalculateCart(false);
    renderCartItems(getCart());

    if (voucherCode) {
      scheduleVoucherRevalidation(voucherCode);
    }

    showToast(`Đã thêm "${upsell.name}" vào giỏ hàng.`);
  }

  /* ========================== SUMMARY / BRANCH / LOYALTY ========================== */

  function renderActiveBranch(branch) {
    state.activeBranch = branch || null;

    const element = $("active-branch-name");
    if (element) element.textContent = branch?.name || "—";
  }

  function renderSummary(summary = {}) {
    state.shipping = Math.max(0, Number(summary.shipping) || 0);
    state.shippingCalculated = summary.shipping != null;
    state.originalShipping = Math.max(
      0, Number(summary.originalShipping) || 0
    );
    state.freeShipping = Boolean(summary.freeShipping);

    const original = $("shipping-original");
    const freeshipBadge = $("freeship-badge");

    if (original) {
      if (state.freeShipping && state.originalShipping > 0) {
        original.textContent = formatCurrency(state.originalShipping);
        original.classList.remove("hidden");
      } else {
        original.classList.add("hidden");
      }
    }

    freeshipBadge?.classList.toggle("hidden", !state.freeShipping);

    if (
      !voucherValidationPending &&
      !voucherValidationError &&
      summary.couponCode &&
      Number(summary.discount) > 0
    ) {
      state.couponCode = String(summary.couponCode);
      state.discount = Math.max(0, Number(summary.discount) || 0);
      renderAppliedVoucher();

    } else if (
      !voucherValidationPending &&
      !voucherValidationError &&
      !state.couponCode
    ) {
      state.discount = 0;
      hideAppliedVoucher();
    }

    recalculateCart();
  }

  function renderLoyalty(loyalty) {
    state.loyalty = loyalty || null;

    const badge = $("loyalty-badge");
    if (!badge) return;

    if (!loyalty) {
      badge.classList.add("hidden");
      badge.classList.remove("flex");
      return;
    }

    badge.classList.remove("hidden");
    badge.classList.add("flex");

    if ($("loyalty-title")) {
      $("loyalty-title").textContent = "Tích lũy FCA Member";
    }

    if ($("loyalty-subtitle")) {
      $("loyalty-subtitle").textContent =
        loyalty.tier ? `Hạng ${loyalty.tier}` : "";
    }

    if ($("loyalty-points")) {
      $("loyalty-points").textContent = `+${loyalty.points || 0} điểm`;
    }
  }

  function setEstimatedTime(text) {
    state.estimatedTime = text || null;

    const element = $("estimated-time");
    if (!element) return;

    element.replaceChildren();

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined text-[18px]";
    icon.textContent = "timer";

    const label = document.createElement("span");
    label.textContent = `Thời gian dự kiến: ${text || "—"}`;

    element.append(icon, label);
  }

  function renderFooterBranches(branches) {
    const container = $("footer-branches");
    if (!container) return;

    if (!Array.isArray(branches) || !branches.length) {
      container.replaceChildren();
      return;
    }

    container.innerHTML = branches.map(branch => `
      <li class="flex items-start gap-2">
        <span class="material-symbols-outlined text-primary text-[16px]">storefront</span>
        <div><strong>${escapeHtml(branch.city || "")}:</strong> ${escapeHtml(branch.address || "")}</div>
      </li>`).join("");
  }

  /* ========================== EVENTS ========================== */

  function bindEvents() {
    document.addEventListener("click", event => {
      const plus = event.target.closest(".qty-btn-plus");

      if (plus) {
        changeQuantity(plus.dataset.id, 1);
        return;
      }

      const minus = event.target.closest(".qty-btn-minus");

      if (minus) {
        changeQuantity(minus.dataset.id, -1);
        return;
      }

      const remove = event.target.closest(".btn-remove");

      if (remove) {
        event.preventDefault();

        const row = remove.closest(".cart-item");
        const id = remove.dataset.id || row?.dataset.id;
        if (id == null) return;

        const item = getCart().find(
          entry => getItemId(entry) === String(id)
        );

        if (!item) return;

        openDeleteModal({ type: "item", id, name: item.name });
        return;
      }

      const addUpsellButton = event.target.closest(".add-upsell-btn");

      if (addUpsellButton) {
        addUpsell(addUpsellButton.dataset.id);
      }
    });

    $("clear-all-btn")?.addEventListener("click", clearCart);

    $("checkout-cta")?.addEventListener("click", event => {
      if (!getCart().length) {
        event.preventDefault();
        event.stopPropagation();
        showToast("Giỏ hàng đang trống.");
        return;
      }

      if (voucherValidationPending || voucherValidationError) {
        event.preventDefault();
        event.stopPropagation();

        showToast(
          "Voucher chưa được xác thực theo giỏ hàng hiện tại. Vui lòng thử lại hoặc bỏ voucher."
        );
        return;
      }

      sessionStorage.setItem("fca_checkout_context", JSON.stringify({
        voucherCode: state.couponCode,
        discount: state.discount,
        shipping: state.shipping,
        ecoPackaging: true
      }));
    });

    window.addEventListener("storage", event => {
      if (event.key !== CART_STORAGE_KEY) return;

      state.items = getCart();

      const voucherCode = invalidateVoucherIfCartChanged();

      recalculateCart(false);
      renderCartItems(state.items);

      if (voucherCode) {
        scheduleVoucherRevalidation(voucherCode);
      }
    });
  }

  /* ========================== EVENT BINDINGS ========================== */

  confirmDeleteBtn?.addEventListener("click", () => {
    if (!pendingDelete) return;

    const action = pendingDelete;
    closeDeleteModal();

    if (action.type === "item") {
      removeItem(action.id);
      return;
    }

    if (action.type === "all") {
      if (!saveCart([])) return;

      clearTimeout(voucherRevalidateTimer);
      voucherRevalidateTimer = null;

      state.discount = 0;
      state.couponCode = null;
      selectedVoucherCode = null;

      voucherRequestId++;
      voucherValidationPending = false;
      voucherValidationError = false;

      if (voucherInput) voucherInput.value = "";

      hideAppliedVoucher();
      recalculateCart();
      showToast("Đã xóa toàn bộ giỏ hàng.");

      if (API.clearCart) {
        fetchJson(API.clearCart, { method: "DELETE" }).catch(error =>
          console.error("API xóa giỏ hàng thất bại:", error)
        );
      }
    }
  });

  cancelDeleteBtn?.addEventListener("click", closeDeleteModal);

  deleteModal?.querySelectorAll("[data-close-delete-modal]")
    .forEach(element => {
      element.addEventListener("click", closeDeleteModal);
    });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      deleteModal?.classList.contains("is-open")
    ) {
      closeDeleteModal();
    }
  });

  openVoucherMenuBtn?.addEventListener("click", openVoucherMenu);
  closeVoucherMenuBtn?.addEventListener("click", closeVoucherMenu);
  confirmSelectedVoucherBtn?.addEventListener(
    "click", applySelectedVoucher
  );

  voucherListContainer?.addEventListener("click", event => {
    const retry = event.target.closest("#retry-load-vouchers-btn");

    if (retry) {
      voucherListLoaded = false;
      loadVouchers(true);
      return;
    }

    const button = event.target.closest("[data-voucher-code]");
    if (!button || button.disabled) return;

    selectedVoucherCode =
      selectedVoucherCode === button.dataset.voucherCode
        ? null
        : button.dataset.voucherCode;

    renderVoucherList(availableVouchers);
  });

  applyVoucherBtn?.addEventListener("click", event => {
    event.preventDefault();
    applyVoucherFromInput();
  });

  voucherInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyVoucherFromInput();
    }
  });

  voucherRemoveBtn?.addEventListener("click", () => {
    clearTimeout(voucherRevalidateTimer);
    voucherRevalidateTimer = null;

    voucherRequestId++;
    voucherValidationPending = false;
    voucherValidationError = false;

    state.couponCode = null;
    state.discount = 0;
    selectedVoucherCode = null;

    if (voucherInput) voucherInput.value = "";

    hideAppliedVoucher();
    renderVoucherList(availableVouchers);
    recalculateCart(false);

    showToast("Đã bỏ voucher.");
  });

  /* ========================== INITIALIZE ========================== */

  async function applyVoucherFromUrl() {
    const code = String(
      new URLSearchParams(window.location.search).get("voucher") || ""
    ).trim().toUpperCase();

    if (!code || !voucherInput) return;

    voucherInput.value = code;
    await applyVoucherFromInput();
  }

  function init() {
    bindEvents();

    state.items = getCart();
    renderCartItems(state.items);
    updateCartBadge(state.items);
    recalculateCart(false);
    refreshDeliveryFee();
    applyVoucherFromUrl().catch(error => {
      console.error("Không thể áp dụng voucher từ Home:", error);
      showToast(error.message || "Không thể áp dụng voucher đã chọn.");
    });

    const selectedAddress = $("selected-delivery-address");
    if (selectedAddress) {
      new MutationObserver(async () => {
        await refreshDeliveryFee();

        if (state.couponCode) {
          const code = invalidateVoucherIfCartChanged();
          if (code) revalidateAppliedVoucher(code);
        }

        voucherListLoaded = false;
      }).observe(selectedAddress, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    if (API.upsells) {
      fetchJson(API.upsells)
        .then(data => {
          const items = Array.isArray(data)
            ? data
            : data?.items || data?.content || [];

          renderUpsells(items);
        })
        .catch(error => {
          console.error("Không tải được món gợi ý:", error);
        });
    }
  }

  /* ========================== PUBLIC API ========================== */

  window.FCA_CART = {
    renderActiveBranch,
    renderCartItems,
    renderUpsells,
    renderSummary,
    renderLoyalty,
    setEstimatedTime,
    renderFooterBranches,
    recalculateCart,
    formatCurrency,
    getCart,
    saveCart,
    clearCart,
    state,

    setDeliveryLocation(latitude, longitude) {
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (
        !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180
      ) {
        throw new Error("Tọa độ giao hàng không hợp lệ.");
      }

      state.deliveryLatitude = lat;
      state.deliveryLongitude = lng;
    },

    clearDeliveryLocation() {
      state.deliveryLatitude = null;
      state.deliveryLongitude = null;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
