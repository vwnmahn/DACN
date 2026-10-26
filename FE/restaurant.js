
(() => {
  "use strict";

  // =====================================================
  // CONFIG
  // =====================================================

  const API_BASE_URL = "http://localhost:8080";
  const CART_STORAGE_KEY = "fca_cart";

  const API = {
    restaurant: id =>
      `${API_BASE_URL}/api/v1/restaurants/${encodeURIComponent(id)}`,

    menu: id =>
      `${API_BASE_URL}/api/v1/menu-items/restaurant/${encodeURIComponent(id)}?availableOnly=true`
  };

  const $ = id => document.getElementById(id);

  let currentRestaurant = null;
  let allDishes = [];
  let activeCategory = "Tất cả";
  let searchKeyword = "";
  let showAvailableOnly = true;

  // =====================================================
  // CART STORAGE
  // =====================================================

  function getCart() {
    try {
      const data = JSON.parse(
        localStorage.getItem(CART_STORAGE_KEY) || "[]"
      );

      if (!Array.isArray(data)) return [];

      return data.filter(item =>
        item &&
        item.id != null &&
        item.restaurantId != null &&
        Number(item.quantity) > 0
      );
    } catch (error) {
      console.error("Không đọc được giỏ hàng:", error);
      return [];
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(items)
      );
      updateCartBadge(items);
      return true;
    } catch (error) {
      console.error("Không lưu được giỏ hàng:", error);
      showToast("Không thể lưu giỏ hàng. Hãy kiểm tra trình duyệt.");
      return false;
    }
  }

  function updateCartBadge(items = getCart()) {
    const badge = $("cart-count-badge");
    if (!badge) return;

    const count = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.toggle("hidden", count === 0);
    badge.classList.toggle("flex", count > 0);
    badge.dataset.count = String(count);
  }

  // =====================================================
  // API HELPERS
  // =====================================================

  async function fetchJson(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const contentType =
      response.headers.get("content-type") || "";

    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      result = text ? { message: text } : null;
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        `Lỗi HTTP ${response.status} khi gọi API`
      );
    }

    if (
      result &&
      typeof result === "object" &&
      Object.prototype.hasOwnProperty.call(result, "data")
    ) {
      return result.data;
    }

    return result;
  }

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function getFirstValue(object, keys, fallback = "") {
    for (const key of keys) {
      const value = object?.[key];

      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        return value;
      }
    }

    return fallback;
  }

  function normalizeRestaurant(raw) {
    if (Array.isArray(raw)) {
      return raw[0] || null;
    }

    if (raw && typeof raw === "object") {
      return raw.restaurant ?? raw;
    }

    return null;
  }

  function normalizeMenu(raw) {
    let items = raw;

    if (!Array.isArray(items)) {
      if (Array.isArray(items?.content)) {
        items = items.content;
      } else if (Array.isArray(items?.items)) {
        items = items.items;
      } else if (Array.isArray(items?.menuItems)) {
        items = items.menuItems;
      } else if (Array.isArray(items?.dishes)) {
        items = items.dishes;
      } else if (Array.isArray(items?.data)) {
        items = items.data;
      } else {
        items = [];
      }
    }

    return items.map(item => {
      const categoryValue = getFirstValue(
        item,
        ["categoryName", "category", "menuCategory"],
        ""
      );

      return {
        id: item.id ?? item.menuItemId ?? item.dishId,

        name: normalizeText(
          getFirstValue(
            item,
            ["name", "menuItemName", "dishName"]
          )
        ),

        description: normalizeText(
          getFirstValue(item, ["description", "detail"])
        ),

        price: Number(item.price ?? item.unitPrice ?? 0),

        image: normalizeText(
          getFirstValue(item, [
            "imageUrl",
            "imageURL",
            "image",
            "thumbnail"
          ])
        ),

        category:
          typeof categoryValue === "object"
            ? normalizeText(categoryValue?.name)
            : normalizeText(categoryValue),

        available:
          item.available ??
          item.isAvailable ??
          item.active ??
          true,

        active: item.active ?? true,

        restaurantId:
          item.restaurantId ??
          item.restaurant?.id ??
          item.restaurant?.restaurantId ??
          null,

        original: item
      };
    });
  }

  // =====================================================
  // STATUS / TOAST
  // =====================================================

  function setStatus(message, isError = false) {
    const element = $("restaurant-status");
    if (!element) return;

    element.textContent = message;

    element.classList.remove(
      "hidden",
      "text-red-600",
      "text-emerald-700"
    );

    element.classList.add(
      isError ? "text-red-600" : "text-emerald-700"
    );
  }

  function hideStatus() {
    const element = $("restaurant-status");
    if (element) element.classList.add("hidden");
  }

  function showToast(message) {
    const toast = $("restaurant-toast");

    if (!toast) {
      console.info(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // =====================================================
  // GENERAL DOM HELPERS
  // =====================================================

  function setText(id, value, fallback = "") {
    const element = $(id);
    if (!element) return;

    element.textContent =
      normalizeText(value) || fallback;
  }

  function setVisible(id, visible, displayClass = "flex") {
    const element = $(id);
    if (!element) return;

    element.classList.toggle("hidden", !visible);

    if (visible && displayClass) {
      element.classList.add(displayClass);
    } else if (displayClass) {
      element.classList.remove(displayClass);
    }
  }

  function setImageBackground(id, url) {
    const element = $(id);
    if (!element) return;

    element.style.backgroundImage = "";

    if (url) {
      const safeUrl = String(url).replace(/"/g, '\\"');

      element.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,0.02), rgba(0,0,0,0.02)), url("${safeUrl}")`;
    }
  }

  function formatPrice(price) {
    const value = Number(price);

    if (!Number.isFinite(value)) return "Liên hệ";

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0
    }).format(value);
  }

  function appendIconText(container, iconName, text) {
    const wrapper = document.createElement("span");
    wrapper.className = "inline-flex items-center gap-1";

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined text-[18px]";
    icon.textContent = iconName;

    const label = document.createElement("span");
    label.textContent = text;

    wrapper.append(icon, label);
    container.appendChild(wrapper);
  }

  // =====================================================
  // RENDER RESTAURANT
  // =====================================================

  function renderRestaurant(restaurant) {
    if (!restaurant) {
      throw new Error("API không trả về thông tin nhà hàng.");
    }

    currentRestaurant = restaurant;

    const name = getFirstValue(
      restaurant,
      ["name", "restaurantName", "title"],
      "Nhà hàng"
    );

    const description = getFirstValue(
      restaurant,
      ["description", "introduction", "detail"],
      ""
    );

    const address = getFirstValue(
      restaurant,
      ["address", "fullAddress", "location"],
      ""
    );

    const phone = getFirstValue(
      restaurant,
      ["phone", "phoneNumber", "hotline"],
      ""
    );

    const cuisine = getFirstValue(
      restaurant,
      ["cuisineType", "cuisine", "categoryName", "restaurantType"],
      ""
    );

    const rating = getFirstValue(
      restaurant,
      ["rating", "averageRating", "avgRating"],
      null
    );

    const priceRange = getFirstValue(
      restaurant,
      ["priceRange", "averagePrice", "priceDescription"],
      ""
    );

    const preparationTime = getFirstValue(
      restaurant,
      [
        "preparationTime",
        "averagePreparationTime",
        "estimatedPreparationTime"
      ],
      null
    );

    const mainImage = getFirstValue(
      restaurant,
      [
        "imageUrl",
        "imageURL",
        "coverImage",
        "thumbnail",
        "image"
      ],
      ""
    );

    const sideImage1 = getFirstValue(
      restaurant,
      ["imageUrl2", "image2", "galleryImage1"],
      mainImage
    );

    const sideImage2 = getFirstValue(
      restaurant,
      ["imageUrl3", "image3", "galleryImage2"],
      mainImage
    );

    setText("restaurant-name", name);
    setText("breadcrumb-name", name);

    const breadcrumbRegion = $("breadcrumb-region");

    if (breadcrumbRegion) {
      breadcrumbRegion.textContent = getFirstValue(
        restaurant,
        ["city", "province", "region"],
        ""
      );
    }

    setImageBackground("restaurant-main-image", mainImage);
    setImageBackground("restaurant-side-image-1", sideImage1);
    setImageBackground("restaurant-side-image-2", sideImage2);

    const meta = $("restaurant-meta");

    if (meta) {
      meta.replaceChildren();

      if (rating !== null && rating !== "") {
        appendIconText(meta, "star", `Đánh giá: ${rating}`);
      }

      if (cuisine) {
        appendIconText(meta, "restaurant", String(cuisine));
      }

      if (priceRange) {
        appendIconText(meta, "payments", String(priceRange));
      }
    }

    setText("restaurant-address", address);
    setVisible("restaurant-address-row", Boolean(address));

    const phoneLink = $("restaurant-phone");

    if (phoneLink) {
      phoneLink.textContent = phone || "";
      phoneLink.href = phone ? `tel:${phone}` : "#";
    }

    setVisible("restaurant-phone-row", Boolean(phone));

    if (preparationTime !== null && preparationTime !== "") {
      setText(
        "restaurant-preparation",
        typeof preparationTime === "number"
          ? `${preparationTime} phút`
          : preparationTime
      );

      setVisible("restaurant-preparation-row", true);
    } else {
      setVisible("restaurant-preparation-row", false);
    }

    const facilities = $("restaurant-facilities");

    if (facilities) {
      facilities.replaceChildren();

      if (description) {
        const descriptionElement = document.createElement("p");
        descriptionElement.className = "text-sm";
        descriptionElement.textContent = description;
        facilities.appendChild(descriptionElement);
      }
    }

    const overview = $("restaurant-overview");
    if (overview) overview.classList.remove("hidden");

    const separator = $("breadcrumb-separator");

    if (separator && breadcrumbRegion?.textContent) {
      separator.classList.remove("hidden");
    }
  }

  // =====================================================
  // MENU CATEGORIES
  // =====================================================

  function getCategories() {
    const categories = [
      ...new Set(
        allDishes
          .map(dish => dish.category)
          .filter(Boolean)
      )
    ];

    return ["Tất cả", ...categories];
  }

  function renderCategories() {
    const navigation = $("menu-category-navigation");
    if (!navigation) return;

    navigation.replaceChildren();

    getCategories().forEach(category => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = category;

      button.className =
        "px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-colors " +
        (
          activeCategory === category
            ? "bg-primary text-white"
            : "bg-surface-container-low text-on-surface hover:bg-surface-container"
        );

      button.addEventListener("click", () => {
        activeCategory = category;
        renderCategories();
        renderMenu();
      });

      navigation.appendChild(button);
    });
  }

  // =====================================================
  // MENU FILTERING
  // =====================================================

  function getFilteredDishes() {
    const keyword = searchKeyword.toLocaleLowerCase("vi");

    return allDishes.filter(dish => {
      if (
        showAvailableOnly &&
        (!dish.available || !dish.active)
      ) {
        return false;
      }

      if (
        activeCategory !== "Tất cả" &&
        dish.category !== activeCategory
      ) {
        return false;
      }

      if (!keyword) return true;

      return (
        dish.name.toLocaleLowerCase("vi").includes(keyword) ||
        dish.description.toLocaleLowerCase("vi").includes(keyword) ||
        dish.category.toLocaleLowerCase("vi").includes(keyword)
      );
    });
  }

  // =====================================================
  // ADD DISH TO CART
  // =====================================================

  function addToCart(dish, quantityInput) {
    if (!dish || dish.id == null) {
      showToast("Không xác định được món ăn.");
      return;
    }

    if (!dish.active || !dish.available) {
      showToast("Món ăn hiện không khả dụng.");
      return;
    }

    const quantity = Number(quantityInput?.value);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      showToast("Vui lòng nhập số lượng từ 1 đến 100.");
      quantityInput?.focus();
      return;
    }

    const restaurantId =
      currentRestaurant?.id ??
      currentRestaurant?.restaurantId ??
      dish.restaurantId;

    if (restaurantId == null) {
      showToast("Không xác định được ID nhà hàng.");
      return;
    }

    let items = getCart();

    // Không trộn món từ hai nhà hàng.
    if (
      items.length > 0 &&
      items.some(
        item => String(item.restaurantId) !== String(restaurantId)
      )
    ) {
      const confirmed = window.confirm(
        "Giỏ hàng đang có món của nhà hàng khác.\n\n" +
        "Bạn có muốn xóa giỏ cũ và thêm món của nhà hàng này không?"
      );

      if (!confirmed) return;

      items = [];
    }

    const existing = items.find(
      item =>
        String(item.id) === String(dish.id) &&
        String(item.restaurantId) === String(restaurantId)
    );

    if (existing) {
      if (Number(existing.quantity) + quantity > 100) {
        showToast("Mỗi món chỉ được thêm tối đa 100 phần.");
        return;
      }

      existing.quantity = Number(existing.quantity) + quantity;
    } else {
      items.push({
        id: dish.id,
        restaurantId,
        restaurantName: getFirstValue(
          currentRestaurant,
          ["name", "restaurantName", "title"],
          "Nhà hàng"
        ),
        name: dish.name,
        price: Number(dish.price) || 0,
        image: dish.image,
        quantity
      });
    }

    if (!saveCart(items)) return;

    // Reset số lượng về 0 sau khi thêm thành công.
    if (quantityInput) {
      quantityInput.value = "0";
    }

    showToast(
      `Đã thêm ${quantity} phần "${dish.name}" vào giỏ hàng.`
    );
  }

  // =====================================================
  // CREATE DISH CARD
  // =====================================================

  function createDishCard(dish) {
    const card = document.createElement("article");

card.className =
  "w-full sm:w-fit sm:max-w-full bg-white border border-slate-200 " +
  "rounded-xl overflow-hidden shadow-sm flex flex-col sm:flex-row " +
  "gap-4 p-4";
    // Dish image
    const imageContainer = document.createElement("div");

    imageContainer.className =
      "w-full sm:w-40 h-40 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100";

    function showImagePlaceholder() {
      imageContainer.replaceChildren();

      const placeholder = document.createElement("div");
      placeholder.className =
        "w-full h-full flex flex-col items-center justify-center text-slate-400";

      const icon = document.createElement("span");
      icon.className = "material-symbols-outlined text-4xl";
      icon.textContent = "restaurant";

      const text = document.createElement("span");
      text.className = "text-xs";
      text.textContent = "Chưa có ảnh";

      placeholder.append(icon, text);
      imageContainer.appendChild(placeholder);
    }

    if (dish.image) {
      const image = document.createElement("img");

      image.src = dish.image;
      image.alt = dish.name;
      image.loading = "lazy";
      image.className = "w-full h-full object-cover";

      image.onerror = showImagePlaceholder;

      imageContainer.appendChild(image);
    } else {
      showImagePlaceholder();
    }

    // Dish content
    const content = document.createElement("div");
    content.className = "flex-1 min-w-0 flex flex-col";

    const title = document.createElement("h3");
    title.className = "text-lg font-semibold text-slate-900";
    title.textContent = dish.name || "Chưa có tên món";

    const description = document.createElement("p");
    description.className = "mt-1 text-sm text-slate-600";
    description.textContent =
      dish.description || "Chưa có mô tả món ăn.";

    const bottom = document.createElement("div");

    bottom.className =
      "mt-auto pt-4 flex items-center justify-start gap-6 flex-wrap";

    const price = document.createElement("span");
    price.className = "text-base font-bold text-emerald-700";
    price.textContent = formatPrice(dish.price);

    const status = document.createElement("span");

    status.className =
      "text-xs font-semibold px-3 py-1 rounded-full " +
      (
        dish.available && dish.active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      );

    status.textContent =
      dish.available && dish.active
        ? "Đang phục vụ"
        : "Tạm hết";

    bottom.append(price, status);

// Quantity input - compact
    const quantityLabel = document.createElement("label");

    quantityLabel.className =
    "menu-item-quantity flex flex-col gap-1 text-xs font-medium text-slate-600";

    quantityLabel.textContent = "Số lượng";

    const quantityInput = document.createElement("input");

    quantityInput.type = "number";
    quantityInput.min = "0";
    quantityInput.max = "100";
    quantityInput.step = "1";
    quantityInput.value = "0";
    quantityInput.inputMode = "numeric";

    quantityInput.setAttribute(
    "aria-label",
    `Số lượng ${dish.name}`
    );

    quantityInput.className =
    "w-16 h-9 px-2 rounded-lg border border-slate-300 " +
    "bg-white text-slate-900 text-sm " +
    "focus:outline-none focus:ring-2 focus:ring-emerald-500";

    quantityInput.disabled = !dish.active || !dish.available;

    quantityLabel.appendChild(quantityInput);

    // Add to cart - compact layout
    const addButton = document.createElement("button");

    addButton.type = "button";
    addButton.className =
    "h-9 px-3 rounded-lg bg-primary text-white " +
    "font-semibold text-xs whitespace-nowrap " +
    "hover:opacity-90 transition-opacity " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

    addButton.textContent = "Thêm vào giỏ";
    addButton.disabled = !dish.active || !dish.available;

    addButton.addEventListener("click", () => {
    addToCart(dish, quantityInput);
    });

    // Quantity + button on the same row
    const actions = document.createElement("div");
    actions.className =
    "menu-item-actions flex items-end gap-2 mt-3";

    actions.append(quantityLabel, addButton);

    content.append(
    title,
    description,
    bottom,
    actions
    );

    card.append(imageContainer, content);

    return card;
  }

  // =====================================================
  // RENDER MENU
  // =====================================================

  function renderMenu() {
    const container = $("menu-items-container");
    if (!container) return;

    container.replaceChildren();

    const dishes = getFilteredDishes();

    if (dishes.length === 0) {
      const empty = document.createElement("div");

      empty.className =
        "p-8 text-center bg-white border border-slate-200 rounded-xl";

      const heading = document.createElement("h3");

      heading.className = "font-semibold text-slate-800";

      heading.textContent = allDishes.length
        ? "Không tìm thấy món phù hợp"
        : "Nhà hàng chưa có món ăn khả dụng";

      const description = document.createElement("p");

      description.className = "text-sm text-slate-500 mt-2";

      description.textContent = allDishes.length
        ? "Hãy thử từ khóa hoặc danh mục khác."
        : "Danh sách món ăn hiện chưa có dữ liệu để hiển thị.";

      empty.append(heading, description);
      container.appendChild(empty);
      return;
    }

    const groups = new Map();

    dishes.forEach(dish => {
      const category = dish.category || "Món ăn";

      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(dish);
    });

    groups.forEach((items, category) => {
      const section = document.createElement("section");
      section.className = "flex flex-col gap-4";

      const heading = document.createElement("h2");
      heading.className = "text-xl font-bold text-slate-900";
      heading.textContent = category;

      const cards = document.createElement("div");
      cards.className = "grid grid-cols-1 xl:grid-cols-2 gap-4";

      items.forEach(dish => {
        cards.appendChild(createDishCard(dish));
      });

      section.append(heading, cards);
      container.appendChild(section);
    });
  }

  // =====================================================
  // FILTER CHIPS
  // =====================================================

  function renderFilterChips() {
    const chips = $("menu-filter-chips");
    if (!chips) return;

    chips.replaceChildren();

    const label = document.createElement("span");

    label.className =
      "font-label-caps text-label-caps text-on-surface-variant mr-1";

    label.textContent = "Bộ lọc nhanh:";

    const button = document.createElement("button");

    button.type = "button";

    button.className =
      "px-3 py-1 rounded-full text-sm border border-slate-200 " +
      "hover:bg-slate-100";

    button.textContent = showAvailableOnly
      ? "Chỉ món đang phục vụ ✓"
      : "Hiện tất cả món";

    button.addEventListener("click", () => {
      showAvailableOnly = !showAvailableOnly;
      renderFilterChips();
      renderMenu();
    });

    chips.append(label, button);
    chips.classList.remove("hidden");
  }

  function renderMenuPage() {
    renderCategories();
    renderFilterChips();
    renderMenu();

    const toolbar = $("menu-toolbar");
    const section = $("menu-section");

    if (toolbar) toolbar.classList.remove("hidden");
    if (section) section.classList.remove("hidden");
  }

  // =====================================================
  // EVENTS
  // =====================================================

  function bindEvents() {
    // Menu search
    const searchInput = $("menu-search");

    if (searchInput) {
      searchInput.addEventListener("input", event => {
        searchKeyword = event.target.value.trim();
        renderMenu();
      });
    }

    // Menu filter
    const filterButton = $("menu-filter-button");

    if (filterButton) {
      filterButton.addEventListener("click", () => {
        showAvailableOnly = !showAvailableOnly;

        renderFilterChips();
        renderMenu();

        showToast(
          showAvailableOnly
            ? "Đang chỉ hiển thị món đang phục vụ."
            : "Đang hiển thị tất cả món."
        );
      });
    }

    // Cart button in the header
    const cartButton = $("cart-button");

    if (cartButton) {
      cartButton.addEventListener("click", event => {
        event.preventDefault();
        window.location.href = "cart.html";
      });
    }

    // Booking button
    const bookingButton = $("book-table-button");

    if (bookingButton) {
      bookingButton.addEventListener("click", () => {
        const restaurantId = getRestaurantIdFromUrl();

        if (!restaurantId) {
          showToast("Không xác định được nhà hàng để đặt bàn.");
          return;
        }

        window.location.href =
          "table-reservation.html?restaurantId=" +
          encodeURIComponent(restaurantId);
      });
    }
  }

  // =====================================================
  // LOAD RESTAURANT
  // =====================================================

  function getRestaurantIdFromUrl() {
    const params = new URLSearchParams(
      window.location.search
    );

    return (
      params.get("restaurantId") ||
      params.get("id") ||
      params.get("restaurant_id")
    );
  }

  async function loadRestaurantDetail(restaurantId) {
    if (!restaurantId) {
      throw new Error(
        "Không tìm thấy ID nhà hàng trên URL. " +
        "Hãy mở trang bằng ?id=1 hoặc ?restaurantId=1."
      );
    }

    const [restaurantRaw, menuRaw] = await Promise.all([
      fetchJson(API.restaurant(restaurantId)),
      fetchJson(API.menu(restaurantId))
    ]);

    const restaurant = normalizeRestaurant(restaurantRaw);

    if (!restaurant) {
      throw new Error(
        "API không trả về dữ liệu nhà hàng hợp lệ."
      );
    }

    allDishes = normalizeMenu(menuRaw);

    renderRestaurant(restaurant);
    renderMenuPage();
    hideStatus();

    updateCartBadge();

    console.log("Thông tin nhà hàng:", restaurant);
    console.log("Danh sách món ăn:", allDishes);

    return {
      restaurant,
      dishes: allDishes
    };
  }

  // =====================================================
  // INITIALIZE
  // =====================================================

  async function init() {
    bindEvents();
    updateCartBadge();

    const restaurantId = getRestaurantIdFromUrl();

    try {
      setStatus("Đang tải thông tin nhà hàng...");

      await loadRestaurantDetail(restaurantId);
    } catch (error) {
      console.error("Lỗi tải trang nhà hàng:", error);

      setStatus(
        `Không thể tải thông tin nhà hàng. ${error.message}`,
        true
      );

      const toolbar = $("menu-toolbar");
      if (toolbar) toolbar.classList.remove("hidden");

      const section = $("menu-section");

      if (section) {
        section.classList.remove("hidden");

        const container = $("menu-items-container");

        if (container) {
          container.replaceChildren();

          const message = document.createElement("p");

          message.className =
            "p-6 bg-white border border-red-200 rounded-xl text-red-600";

          message.textContent = error.message;

          container.appendChild(message);
        }
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
