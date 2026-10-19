/* ============================================================
   FCA CULINARY - HOME SCRIPT
   - Restaurant category switching
   - Search input filter
   - Skeleton render functions (dùng khi bạn nạp DB)
   ============================================================ */

(function () {
  'use strict';

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

      // Dữ liệu nhà hàng hiện chưa có trường phân loại đáng tin cậy.
      // Chỉ cập nhật giao diện; không suy diễn hoặc tạo kết quả lọc giả.
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
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll(
        '#restaurant-cards-container article'
      );

      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        if (!query || text.includes(query)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });

      // TODO: có thể gọi API/DB với query
      console.log('[FCA] Search query:', query);
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
            <button class="py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors font-semibold flex items-center justify-center gap-1 cursor-pointer">
              <span class="material-symbols-outlined text-[18px]">restaurant_menu</span>
              <span>Xem menu</span>
            </button>
            <button class="py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors font-semibold flex items-center justify-center gap-1 shadow-sm shadow-emerald-600/30 cursor-pointer">
              <span class="material-symbols-outlined text-[18px]">table_bar</span>
              <span>Đặt bàn / Giao ngay</span>
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
      container.innerHTML = '';
      return;
    }

    container.innerHTML = nearby
      .map((item, idx) => {
        const isActive = item.isActive;
        const indexLabel = String(item.index ?? idx + 1).padStart(2, '0');
        return `
        <div class="p-3 rounded-xl bg-white border ${isActive ? 'border-emerald-200/80 hover:border-emerald-500' : 'border-slate-200/80 hover:border-slate-300'} transition-all cursor-pointer flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg ${isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-bold text-xs">
              ${indexLabel}
            </div>
            <div class="flex flex-col">
              <span class="text-sm text-slate-900 font-bold">${item.name || ''}</span>
              <span class="text-xs text-slate-500">${item.address || ''}</span>
            </div>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-emerald-700 font-bold">${item.distanceKm != null ? item.distanceKm + ' km' : '—'}</span>
            <span class="text-[11px] text-slate-400">${item.deliveryTime ? item.deliveryTime + ' giao' : ''}</span>
          </div>
        </div>`;
      })
      .join('');
  }

  /* ============================================================
     4. EXPOSE API CHO VIỆC NẠP DỮ LIỆU TỪ DB
     ============================================================ */
  window.FCA = window.FCA || {};
  window.FCA.renderRestaurants = renderRestaurants;
  window.FCA.renderNearby = renderNearby;

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
