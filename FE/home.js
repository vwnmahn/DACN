/* ============================================================
   FCA CULINARY - HOME SCRIPT
   - Restaurant category switching
   - Search input filter
   - Skeleton render functions (dùng khi bạn nạp DB)
   ============================================================ */

(function () {
  'use strict';
  let allRestaurants = [];
let currentCategory = 'all';
let currentSearchQuery = '';
const API_ORIGIN = 'http://localhost:8080';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function authHeaders() {
  if (typeof window.FCA_SHELL?.authHeaders === 'function') {
    return window.FCA_SHELL.authHeaders();
  }
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function distanceKm(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (value) => value * Math.PI / 180;
  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2))
    * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

  /* ============================================================
     1. RESTAURANT CATEGORY SWITCHING
     ============================================================ */
  const categoryList = document.getElementById('restaurant-category-list');

  if (categoryList) {
    const scrollLeftButton = document.getElementById('category-scroll-left');
    const scrollRightButton = document.getElementById('category-scroll-right');
    let activeCategoryTab = categoryList.querySelector(
      '.restaurant-category-tab.active'
    );
    let draggedWithMouse = false;
    let activePointerId = null;
    let pointerStartX = 0;
    let scrollStartX = 0;

    const updateCategoryScrollButtons = () => {
      const maxScrollLeft = categoryList.scrollWidth - categoryList.clientWidth;
      const canScrollLeft = categoryList.scrollLeft > 1;
      const canScrollRight = maxScrollLeft - categoryList.scrollLeft > 1;

      if (scrollLeftButton) {
        scrollLeftButton.disabled = !canScrollLeft;
        scrollLeftButton.classList.toggle('is-hidden', !canScrollLeft);
      }

      if (scrollRightButton) {
        scrollRightButton.disabled = !canScrollRight;
        scrollRightButton.classList.toggle('is-hidden', !canScrollRight);
      }
    };

    categoryList.addEventListener('click', (event) => {
      const selectedTab = event.target.closest('.restaurant-category-tab');

      if (!selectedTab || !categoryList.contains(selectedTab)) return;
      if (draggedWithMouse) return;
      if (selectedTab === activeCategoryTab) return;

      if (activeCategoryTab) {
        activeCategoryTab.classList.remove('active');
        activeCategoryTab.setAttribute('aria-selected', 'false');
      }

      selectedTab.classList.add('active');
      selectedTab.setAttribute('aria-selected', 'true');
      activeCategoryTab = selectedTab;
      selectedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    currentCategory =
      selectedTab.dataset.categoryStatus ||
      selectedTab.dataset.category ||
      'all';
      applyRestaurantFilters();
    });

    [scrollLeftButton, scrollRightButton].forEach((button, index) => {
      button?.addEventListener('click', () => {
        const direction = index === 0 ? -1 : 1;
        const distance = Math.max(240, categoryList.clientWidth * 0.65);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        categoryList.scrollBy({
          left: direction * distance,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      });
    });

    categoryList.addEventListener('scroll', updateCategoryScrollButtons, {
      passive: true,
    });

    categoryList.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;

      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      scrollStartX = categoryList.scrollLeft;
      draggedWithMouse = false;
    });

    categoryList.addEventListener('pointermove', (event) => {
      if (event.pointerId !== activePointerId) return;

      const distance = event.clientX - pointerStartX;
      if (!draggedWithMouse && Math.abs(distance) > 4) {
        draggedWithMouse = true;
        categoryList.setPointerCapture(event.pointerId);
        categoryList.classList.add('is-dragging');
      }

      if (!draggedWithMouse) return;
      categoryList.scrollLeft = scrollStartX - distance;
    });

    const stopCategoryDrag = (event) => {
      if (event.pointerId !== activePointerId) return;

      categoryList.classList.remove('is-dragging');
      if (categoryList.hasPointerCapture(event.pointerId)) {
        categoryList.releasePointerCapture(event.pointerId);
      }
      activePointerId = null;
      window.setTimeout(() => {
        draggedWithMouse = false;
      }, 0);
    };

    categoryList.addEventListener('pointerup', stopCategoryDrag);
    categoryList.addEventListener('pointercancel', stopCategoryDrag);

    if ('ResizeObserver' in window) {
      new ResizeObserver(updateCategoryScrollButtons).observe(categoryList);
    } else {
      window.addEventListener('resize', updateCategoryScrollButtons);
    }

    window.requestAnimationFrame(updateCategoryScrollButtons);
    window.addEventListener('load', updateCategoryScrollButtons, { once: true });
    document.fonts?.ready.then(updateCategoryScrollButtons);
  }

  /* ============================================================
     2. DYNAMIC SEARCH INPUT FILTER
     ============================================================ */
  const searchInput = document.getElementById('restaurant-search');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      currentSearchQuery = event.target.value.toLowerCase().trim();
      applyRestaurantFilters();
    });
  }

  /* ============================================================
     3. RENDER FUNCTIONS - SẴN SÀNG CHO BẠN NẠP DỮ LIỆU TỪ DB
     ------------------------------------------------------------
     Dùng khi bạn có data từ DB/API, chỉ cần gọi:
       window.FCA.renderRestaurants(restaurantsArray);
       window.FCA.renderNearby(nearbyArray);
     ============================================================ */

  /**
   * Render danh sách chi nhánh vào grid chính.
   * @param {Array} restaurants - Mảng object chi nhánh
   * Mỗi item cần có:
   *   { id, name, address, image, rating, reviewCount,
   *     openHours, distanceKm, deliveryTime, tags[], signatureDish }
   */
  function applyRestaurantFilters() {
  const filteredRestaurants = allRestaurants.filter((restaurant) => {
    const category = String(restaurant.categoryStatus || '')
      .toUpperCase();

    const matchesCategory =
      currentCategory === 'all' ||
      category === currentCategory.toUpperCase();

    const searchText = [
      restaurant.name,
      restaurant.address,
      ...(restaurant.tags || [])
    ].join(' ').toLowerCase();

    const matchesSearch = searchText.includes(currentSearchQuery);

    return matchesCategory && matchesSearch;
  });

  renderRestaurants(filteredRestaurants);
}
  function renderRestaurants(restaurants) {
    const container = document.getElementById('restaurant-cards-container');
    if (!container) return;

    if (!Array.isArray(restaurants) || restaurants.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = restaurants
      .map(
        (r) => `
      <article class="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col group">
        <div class="relative w-full h-56 overflow-hidden bg-slate-100">
          <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${r.image || ''}" alt="${r.name || ''}"/>
          <div class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-amber-800 text-xs font-bold flex items-center gap-1 shadow-xs border border-slate-200/60">
            <span class="material-symbols-outlined text-[16px] text-amber-500" style="font-variation-settings: 'FILL' 1;">star</span>
            <span>${r.rating || '—'}</span>
            <span class="text-slate-400 font-normal">(${r.reviewCount || 0}+)</span>
          </div>
          ${r.openHours ? `
          <div class="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-slate-900/80 backdrop-blur text-white text-xs flex items-center gap-1.5 font-medium">
            <span class="material-symbols-outlined text-[16px] text-emerald-400">schedule</span>
            <span>${r.openHours}</span>
          </div>` : ''}
        </div>
        <div class="p-5 flex flex-col flex-1 gap-3">
          <div class="flex flex-col">
            <h3 class="text-lg text-slate-900 font-bold group-hover:text-emerald-700 transition-colors">${r.name || ''}</h3>
            <span class="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <span class="material-symbols-outlined text-[16px] text-emerald-600">location_on</span>
              <span>${r.address || ''}</span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-0.5">
            ${r.distanceKm != null ? `
            <span class="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 font-semibold flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px] text-emerald-600">near_me</span>
              <span>${r.distanceKm} km${r.deliveryTime ? ' • Giao ' + r.deliveryTime : ''}</span>
            </span>` : ''}
            ${(r.tags || []).map((t) => `
              <span class="px-2.5 py-1 rounded-md bg-slate-100 text-xs text-slate-600 font-medium">${t}</span>
            `).join('')}
          </div>
          <div class="mt-auto pt-2 grid grid-cols-2 gap-2.5">

            <button
              type="button"
              onclick="window.location.href='restaurant.html?id=${encodeURIComponent(r.id)}'"
              class="py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors font-semibold flex items-center justify-center gap-1 cursor-pointer">
              <span class="material-symbols-outlined text-[18px]">restaurant_menu</span>
              <span>Xem menu</span>
            </button>

<button
  type="button"
  onclick="window.location.href='table-reservation.html?restaurantId=${encodeURIComponent(r.id)}'"
  class="py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors font-semibold flex items-center justify-center gap-1 shadow-sm shadow-emerald-600/30 cursor-pointer"
>
  <span class="material-symbols-outlined text-[18px]">table_bar</span>
  <span>Đặt bàn</span>
</button>


          </div>
        </div>
      </article>`
      )
      .join('');
  }

  /**
   * Render danh sách chi nhánh gần bạn ở cột phải (map section).
   * @param {Array} nearby - Mảng object chi nhánh gần
   * Mỗi item cần có:
   *   { index, name, address, distanceKm, deliveryTime, isActive }
   */
  function renderNearby(nearby) {
    const container = document.getElementById('nearby-list-container');
    const counter = document.getElementById('nearby-count');
    if (!container) return;

    if (counter) {
      counter.textContent = `${(nearby || []).length} điểm`;
    }

    if (!Array.isArray(nearby) || nearby.length === 0) {
      container.innerHTML = '<div class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Chưa có chi nhánh có tọa độ hợp lệ.</div>';
      return;
    }

    container.innerHTML = nearby
      .map((item, idx) => {
        const isActive = item.isActive;
        const indexLabel = String(item.index ?? idx + 1).padStart(2, '0');
        return `
        <a href="restaurant.html?id=${encodeURIComponent(item.id)}" class="p-3 rounded-xl bg-white border ${isActive ? 'border-emerald-200/80 hover:border-emerald-500' : 'border-slate-200/80 hover:border-slate-300'} transition-all cursor-pointer flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg ${isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-bold text-xs">
              ${indexLabel}
            </div>
            <div class="flex flex-col">
              <span class="text-sm text-slate-900 font-bold">${escapeHtml(item.name)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(item.address)}</span>
            </div>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-emerald-700 font-bold">${item.distanceKm != null ? item.distanceKm + ' km' : '—'}</span>
            <span class="text-[11px] text-slate-400">${item.deliveryTime ? 'Giao khoảng ' + item.deliveryTime : ''}</span>
          </div>
        </a>`;
      })
      .join('');
  }

  function updateNearbyRestaurants() {
    const locationLabel = document.getElementById('nearby-location-label');
    const nearestName = document.getElementById('nearest-restaurant-name');
    const nearestDistance = document.getElementById('nearest-restaurant-distance');
    const nearestButton = document.getElementById('open-nearest-restaurant');
    let location = null;

    try {
      location = JSON.parse(localStorage.getItem('fca_delivery_location') || 'null');
    } catch (error) {
      console.warn('[FCA] Không đọc được vị trí đã lưu:', error);
    }

    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    const hasGps = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (locationLabel) locationLabel.textContent = location?.address || (hasGps ? 'Vị trí GPS đã chọn' : 'Chưa chọn vị trí giao hàng');

    const branches = allRestaurants
      .filter((restaurant) => Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude))
      .map((restaurant) => ({
        ...restaurant,
        distanceKm: hasGps
          ? distanceKm(latitude, longitude, restaurant.latitude, restaurant.longitude)
          : null
      }))
      .sort((left, right) => hasGps ? left.distanceKm - right.distanceKm : left.name.localeCompare(right.name, 'vi'));

    renderNearby(branches.map((restaurant, index) => ({
      ...restaurant,
      index: index + 1,
      isActive: index === 0,
      distanceKm: restaurant.distanceKm == null ? null : restaurant.distanceKm.toFixed(1),
      deliveryTime: restaurant.distanceKm == null ? '' : `${Math.ceil(restaurant.distanceKm * 4)} phút`
    })));

    const nearest = hasGps ? branches[0] : null;
    if (nearestName) nearestName.textContent = nearest ? nearest.name : (hasGps ? 'Không có dữ liệu chi nhánh' : 'Cần chọn vị trí GPS');
    if (nearestDistance) nearestDistance.textContent = nearest ? `${nearest.distanceKm.toFixed(1)} km · khoảng ${Math.ceil(nearest.distanceKm * 4)} phút` : 'Chọn địa chỉ GPS trên header để tính khoảng cách';
    if (nearestButton) {
      nearestButton.disabled = !nearest;
      nearestButton.onclick = nearest ? () => { window.location.href = `restaurant.html?id=${encodeURIComponent(nearest.id)}`; } : null;
    }
  }

  function voucherDiscountText(voucher) {
    const value = Number(voucher.discountValue);
    if (!Number.isFinite(value)) return 'Xem điều kiện ưu đãi';
    return String(voucher.discountType).toUpperCase().includes('PERCENT')
      ? `Giảm ${value}%`
      : `Giảm ${new Intl.NumberFormat('vi-VN').format(value)}đ`;
  }

  async function loadRegionalVouchers() {
    const container = document.getElementById('regional-voucher-list');
    if (!container) return;

    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/vouchers?size=100`, { headers: authHeaders() });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.code !== 1000) throw new Error(body?.message || `HTTP ${response.status}`);
      const vouchers = (body?.data?.content || []).filter((voucher) => ['SAIGON20', 'HANOISHIP0'].includes(String(voucher.code).toUpperCase()));

      if (!vouchers.length) {
        container.innerHTML = '<div class="md:col-span-2 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Hệ thống chưa cấu hình hai voucher khu vực.</div>';
        return;
      }

      container.innerHTML = vouchers.map((voucher) => {
        const status = String(voucher.customerStatus || '').toUpperCase();
        const usable = status === 'AVAILABLE';
        const statusText = status === 'USED' ? 'Đã sử dụng' : usable ? 'Áp dụng ngay' : status === 'UNAVAILABLE' ? 'Không khả dụng' : 'Chưa được cấp';
        return `<article class="relative bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between gap-5 overflow-hidden">
          <div class="flex items-center justify-between"><span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">${voucher.code === 'SAIGON20' ? 'Khu vực TP.HCM' : 'Khu vực Hà Nội'}</span><span class="material-symbols-outlined text-emerald-600 text-[26px]">local_offer</span></div>
          <div class="flex flex-col gap-1.5 my-1"><h3 class="text-lg text-slate-900 font-bold">${escapeHtml(voucherDiscountText(voucher))}</h3><p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(voucher.description || 'Điều kiện áp dụng theo hệ thống.')}</p></div>
          <div class="flex items-center justify-between gap-4 pt-3 border-t border-slate-100"><div class="flex flex-col"><span class="text-[10px] text-slate-400 uppercase font-medium">Mã ưu đãi</span><span class="text-sm text-emerald-700 font-mono font-bold tracking-wider">${escapeHtml(voucher.code)}</span></div><button type="button" data-apply-voucher="${escapeHtml(voucher.code)}" class="px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors shadow-xs ${usable ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-slate-400 cursor-not-allowed'}" ${usable ? '' : 'disabled'}>${statusText}</button></div>
        </article>`;
      }).join('');
    } catch (error) {
      container.innerHTML = `<div class="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">${escapeHtml(error.message || 'Không tải được ưu đãi.')}</div>`;
    }
  }

  document.getElementById('regional-voucher-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-apply-voucher]');
    if (!button || button.disabled) return;
    window.location.href = `cart.html?voucher=${encodeURIComponent(button.dataset.applyVoucher)}`;
  });

  document.getElementById('open-restaurant-list')?.addEventListener('click', () => {
    document.getElementById('restaurant-cards-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ============================================================
     4. EXPOSE API CHO VIỆC NẠP DỮ LIỆU TỪ DB
     ============================================================ */
  window.FCA = window.FCA || {};
  window.FCA.renderRestaurants = renderRestaurants;
  window.FCA.renderNearby = renderNearby;

  // Tải danh sách nhà hàng từ BE
  async function loadRestaurantsFromApi() {
    const container = document.getElementById('restaurant-cards-container');
    if (!container) {
      console.warn('[FCA] Không tìm thấy #restaurant-cards-container');
      return;
    }

    container.innerHTML = '<p class="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải danh sách chi nhánh...</p>';

    try {
      const response = await fetch(
        'http://localhost:8080/api/v1/restaurants/active'
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.code !== 1000 || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Dữ liệu API không hợp lệ');
      }

      // Chuyển tên trường BE sang cấu trúc mà hàm render đang sử dụng.
      allRestaurants = result.data.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        image: r.imageUrl,
        rating: r.averageRating,
        reviewCount: r.reviewCount,
        categoryStatus: r.categoryStatus,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        openHours: r.openingTime && r.closingTime
          ? `${String(r.openingTime).slice(0, 5)} - ${String(r.closingTime).slice(0, 5)}`
          : '',
        distanceKm: null,
        deliveryTime: '',
        tags: []
      }));

      applyRestaurantFilters();
      updateNearbyRestaurants();

      console.log('[FCA] Đã tải nhà hàng từ BE:', allRestaurants);
    } catch (error) {
      console.error('[FCA] Không tải được danh sách nhà hàng:', error);
      container.innerHTML =
        '<p>Không tải được danh sách nhà hàng. Vui lòng thử lại sau.</p>';
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'fca_delivery_location') updateNearbyRestaurants();
  });

  const selectedDeliveryAddress = document.getElementById('selected-delivery-address');
  if (selectedDeliveryAddress) {
    new MutationObserver(updateNearbyRestaurants).observe(selectedDeliveryAddress, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  loadRegionalVouchers();

  // Chạy sau khi DOM đã sẵn sàng.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRestaurantsFromApi);
  } else {
    loadRestaurantsFromApi();
  }

  /* ============================================================
     5. VÍ DỤ CÁCH NẠP TỪ DB (bỏ comment khi dùng thật)
     ------------------------------------------------------------
     fetch('/api/restaurants?region=hcm')
       .then((res) => res.json())
       .then((data) => {
         window.FCA.renderRestaurants(data.restaurants);
         window.FCA.renderNearby(data.nearby);
       })
       .catch((err) => console.error('[FCA] Load failed:', err));
     ============================================================ */


     
})();
