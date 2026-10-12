/* ============================================================
   FCA CULINARY - CART PAGE SCRIPT
   - Quantity +/-, remove item, clear all
   - Recalculate totals
   - Voucher apply/remove
   - Upsell add
   - Render functions (nạp DB)
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    items: [],          // { id, name, image, price, quantity, note, badge }
    upsells: [],        // { id, name, image, price, description }
    subtotal: 0,
    shipping: 0,
    discount: 0,
    couponCode: null,
    activeBranch: null, // { name }
    estimatedTime: null,
    loyalty: null,      // { tier, discountNext, points }
  };

  /* ============================================================
     HELPERS
     ============================================================ */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN').format(amount || 0) + 'đ';
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  /* ============================================================
     CART CALCULATION
     ============================================================ */
  function recalculateCart() {
    const items = document.querySelectorAll('.cart-item');
    let subtotal = 0;
    let totalCount = 0;

    items.forEach((item) => {
      const price = parseInt(item.getAttribute('data-price'), 10) || 0;
      const countSpan = item.querySelector('.qty-count');
      const qty = parseInt(countSpan ? countSpan.textContent : '1', 10) || 1;
      const lineTotal = price * qty;

      const totalSpan = item.querySelector('.item-total');
      if (totalSpan) totalSpan.textContent = formatCurrency(lineTotal);

      subtotal += lineTotal;
      totalCount += qty;
    });

    const discountAmount = state.discount || 0;
    const shippingFee = state.shipping || 0;
    const grandTotal = Math.max(0, subtotal + shippingFee - discountAmount);

    // Update UI
    const subtotalElem = document.getElementById('summary-subtotal');
    const grandTotalElem = document.getElementById('summary-grand-total');
    const ctaPriceElem = document.getElementById('cta-button-price');
    const countElem = document.getElementById('summary-item-count');
    const cartCountBadge = document.getElementById('cart-count-badge');
    const cartTotalCount = document.getElementById('cart-total-count');

    if (subtotalElem) subtotalElem.textContent = formatCurrency(subtotal);
    if (grandTotalElem) grandTotalElem.textContent = formatCurrency(grandTotal);
    if (ctaPriceElem) {
      ctaPriceElem.innerHTML =
        formatCurrency(grandTotal) +
        ' <span class="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>';
    }
    if (countElem) countElem.textContent = totalCount;
    if (cartTotalCount) cartTotalCount.textContent = totalCount;
    if (cartCountBadge) {
      cartCountBadge.textContent = totalCount;
      cartCountBadge.setAttribute('data-count', String(totalCount));
    }

    // Nếu giỏ trống → hiện empty state
    if (items.length === 0) {
      renderEmptyCart();
    }
  }

  function renderEmptyCart() {
    const list = document.getElementById('cart-item-list');
    if (!list) return;
    list.innerHTML = `
      <div class="empty-cart-state">
        <span class="material-symbols-outlined">shopping_basket</span>
        <p class="font-title-md">Giỏ hàng của bạn đang trống</p>
      </div>`;
  }

  /* ============================================================
     EVENT DELEGATION (quantity, remove, upsell)
     ============================================================ */
  document.addEventListener('click', function (e) {
    const plusBtn = e.target.closest('.qty-btn-plus');
    if (plusBtn) {
      const counter = plusBtn.parentElement.querySelector('.qty-count');
      if (counter) {
        let val = parseInt(counter.textContent, 10) || 1;
        counter.textContent = val + 1;
        recalculateCart();
      }
    }

    const minusBtn = e.target.closest('.qty-btn-minus');
    if (minusBtn) {
      const counter = minusBtn.parentElement.querySelector('.qty-count');
      if (counter) {
        let val = parseInt(counter.textContent, 10) || 1;
        if (val > 1) {
          counter.textContent = val - 1;
          recalculateCart();
        }
      }
    }

    const removeBtn = e.target.closest('.btn-remove');
    if (removeBtn) {
      const itemCard = removeBtn.closest('.cart-item');
      if (itemCard) {
        const id = itemCard.getAttribute('data-id');
        itemCard.style.opacity = '0';
        itemCard.style.transform = 'translateX(20px)';
        setTimeout(() => {
          itemCard.remove();
          // TODO: gọi API xóa món khỏi DB
          state.items = state.items.filter((it) => String(it.id) !== String(id));
          recalculateCart();
        }, 200);
      }
    }

    const addUpsellBtn = e.target.closest('.add-upsell-btn');
    if (addUpsellBtn) {
      const id = addUpsellBtn.getAttribute('data-id');
      addUpsellBtn.innerHTML =
        '<span class="material-symbols-outlined text-[18px]">check</span> Đã thêm';
      addUpsellBtn.classList.add('bg-primary', 'text-on-primary');
      // TODO: gọi API thêm upsell vào DB
      setTimeout(() => {
        addUpsellBtn.innerHTML =
          '<span class="material-symbols-outlined text-[18px]">add</span> Thêm ngay';
        addUpsellBtn.classList.remove('bg-primary', 'text-on-primary');
      }, 1500);
    }
  });

  /* ============================================================
     CLEAR ALL
     ============================================================ */
  const clearAll = document.getElementById('clear-all-btn');
  if (clearAll) {
    clearAll.addEventListener('click', function () {
      // TODO: gọi API xóa toàn bộ
      state.items = [];
      renderEmptyCart();
      recalculateCart();
    });
  }

  /* ============================================================
     VOUCHER
     ============================================================ */
  const applyVoucherBtn = document.getElementById('apply-voucher-btn');
  const voucherInput = document.getElementById('voucher-code');
  const voucherTag = document.getElementById('voucher-applied-tag');
  const voucherTagText = document.getElementById('voucher-applied-text');
  const voucherRemoveBtn = document.getElementById('voucher-remove-btn');
  const discountRow = document.getElementById('discount-row');
  const discountCodeLabel = document.getElementById('discount-code-label');

  if (applyVoucherBtn && voucherInput) {
    applyVoucherBtn.addEventListener('click', function () {
      const code = voucherInput.value.trim().toUpperCase();
      if (!code) return;

      // TODO: gọi API kiểm tra voucher
      // Demo feedback UI:
      applyVoucherBtn.textContent = 'Đã áp dụng';
      applyVoucherBtn.classList.add('bg-primary', 'text-on-primary');
      setTimeout(() => {
        applyVoucherBtn.textContent = 'Áp dụng';
        applyVoucherBtn.classList.remove('bg-primary', 'text-on-primary');
      }, 1500);
    });
  }

  if (voucherRemoveBtn) {
    voucherRemoveBtn.addEventListener('click', function () {
      state.couponCode = null;
      state.discount = 0;
      if (voucherTag) {
        voucherTag.classList.add('hidden');
        voucherTag.classList.remove('flex');
      }
      if (discountRow) {
        discountRow.classList.add('hidden');
        discountRow.classList.remove('flex');
      }
      recalculateCart();
    });
  }

  /* ============================================================
     RENDER FUNCTIONS - NẠP TỪ DB
     ------------------------------------------------------------
     Gọi:
       FCA_CART.renderActiveBranch({ name });
       FCA_CART.renderCartItems(items);
       FCA_CART.renderUpsells(upsells);
       FCA_CART.renderSummary({ subtotal, shipping, discount, couponCode, freeShipping });
       FCA_CART.renderLoyalty({ tier, discountNext, points });
       FCA_CART.setEstimatedTime('20-25 phút');
       FCA_CART.renderFooterBranches(branches);
     ============================================================ */

  /* ---- 1. Active branch ---- */
  function renderActiveBranch(branch) {
    const el = document.getElementById('active-branch-name');
    if (el) el.textContent = branch?.name || '—';
  }

  /* ---- 2. Cart items ---- */
  function renderCartItems(items) {
    const container = document.getElementById('cart-item-list');
    if (!container) return;
    state.items = Array.isArray(items) ? items : [];

    if (state.items.length === 0) {
      renderEmptyCart();
      recalculateCart();
      return;
    }

    container.innerHTML = state.items
      .map(
        (it) => `
      <div class="cart-item bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md transition-all duration-200 hover:shadow-sm"
           data-id="${it.id}" data-price="${it.price}">
        <div class="flex items-center gap-space-md w-full sm:w-auto">
          <div class="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container">
            ${it.image
              ? `<img class="w-full h-full object-cover" src="${it.image}" alt="${escapeHtml(it.name)}"/>`
              : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-outline text-[32px]">restaurant</span></div>`
            }
            ${it.badge
              ? `<span class="absolute bottom-1 left-1 bg-surface-container-lowest/90 px-1.5 py-0.5 rounded text-[10px] font-label-caps text-primary font-bold">${escapeHtml(it.badge)}</span>`
              : ''
            }
          </div>
          <div class="flex flex-col min-w-0">
            <h3 class="font-title-md text-title-md text-on-surface font-semibold truncate">${escapeHtml(it.name)}</h3>
            ${it.note ? `<p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">${escapeHtml(it.note)}</p>` : ''}
            ${it.tag ? `<span class="font-label-caps text-label-caps text-primary mt-1">${escapeHtml(it.tag)}</span>` : ''}
            <div class="sm:hidden mt-2 font-title-md text-title-md font-bold text-primary">${formatCurrency(it.price)}</div>
          </div>
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-space-lg w-full sm:w-auto shrink-0">
          <div class="hidden sm:block text-right">
            <span class="font-title-md text-title-md font-bold text-on-surface item-total">${formatCurrency(it.price * (it.quantity || 1))}</span>
            <div class="font-body-sm text-[11px] text-outline">${formatCurrency(it.price)} / phần</div>
          </div>
          <div class="flex items-center bg-surface-container-lowest rounded-lg p-1 shadow-xs">
            <button aria-label="Giảm số lượng" class="qty-btn-minus w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span class="qty-count w-9 text-center font-label-lg text-label-lg text-on-surface font-bold">${it.quantity || 1}</span>
            <button aria-label="Tăng số lượng" class="qty-btn-plus w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors">
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
          <button class="btn-remove p-2 rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-all" title="Xóa món">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>`
      )
      .join('');

    recalculateCart();
  }

  /* ---- 3. Upsells ---- */
  function renderUpsells(upsells) {
    const container = document.getElementById('upsell-container');
    if (!container) return;
    state.upsells = Array.isArray(upsells) ? upsells : [];

    if (state.upsells.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = state.upsells
      .map(
        (u) => `
      <div class="bg-surface-container-low rounded-xl p-3 flex flex-col justify-between hover:bg-surface-container-high transition-colors group">
        <div class="flex gap-3 items-center">
          <div class="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-container">
            ${u.image
              ? `<img class="w-full h-full object-cover group-hover:scale-105 transition-transform" src="${u.image}" alt="${escapeHtml(u.name)}"/>`
              : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-outline">restaurant</span></div>`
            }
          </div>
          <div class="min-w-0">
            <h4 class="font-label-lg text-label-lg font-bold text-on-surface truncate">${escapeHtml(u.name)}</h4>
            ${u.description ? `<p class="font-body-sm text-[12px] text-outline">${escapeHtml(u.description)}</p>` : ''}
            <p class="font-label-md text-label-md font-bold text-primary mt-1">${formatCurrency(u.price)}</p>
          </div>
        </div>
        <button class="add-upsell-btn mt-3 w-full h-9 bg-primary-container text-on-primary-container rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-1 hover:bg-primary hover:text-on-primary transition-colors"
                data-id="${u.id}" data-name="${escapeHtml(u.name)}" data-price="${u.price}">
          <span class="material-symbols-outlined text-[18px]">add</span>
          Thêm ngay
        </button>
      </div>`
      )
      .join('');
  }

  /* ---- 4. Summary ---- */
  function renderSummary(summary) {
    const s = summary || {};
    state.subtotal = s.subtotal || 0;
    state.shipping = s.shipping || 0;
    state.discount = s.discount || 0;
    state.couponCode = s.couponCode || null;

    // Shipping
    const shippingFinal = document.getElementById('shipping-final');
    const shippingOrig = document.getElementById('shipping-original');
    const freeshipBadge = document.getElementById('freeship-badge');
    if (shippingFinal) shippingFinal.textContent = formatCurrency(state.shipping);
    if (shippingOrig) {
      if (s.freeShipping && s.originalShipping) {
        shippingOrig.textContent = formatCurrency(s.originalShipping);
        shippingOrig.classList.remove('hidden');
      } else {
        shippingOrig.classList.add('hidden');
      }
    }
    if (freeshipBadge) {
      freeshipBadge.classList.toggle('hidden', !s.freeShipping);
    }

    // Discount
    if (state.discount > 0 && state.couponCode) {
      if (discountRow) {
        discountRow.classList.remove('hidden');
        discountRow.classList.add('flex');
      }
      if (discountCodeLabel) {
        discountCodeLabel.textContent = `(${state.couponCode})`;
      }
      const discountEl = document.getElementById('summary-discount');
      if (discountEl) discountEl.textContent = '-' + formatCurrency(state.discount);

      if (voucherTag) {
        voucherTag.classList.remove('hidden');
        voucherTag.classList.add('flex');
      }
      if (voucherTagText) {
        voucherTagText.textContent = `${state.couponCode} (-${formatCurrency(state.discount)})`;
      }
    } else {
      if (discountRow) {
        discountRow.classList.add('hidden');
        discountRow.classList.remove('flex');
      }
      if (voucherTag) {
        voucherTag.classList.add('hidden');
        voucherTag.classList.remove('flex');
      }
    }

    recalculateCart();
  }

  /* ---- 5. Loyalty ---- */
  function renderLoyalty(loyalty) {
    const badge = document.getElementById('loyalty-badge');
    if (!badge || !loyalty) {
      if (badge) badge.classList.add('hidden');
      return;
    }
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    const title = document.getElementById('loyalty-title');
    const sub = document.getElementById('loyalty-subtitle');
    const points = document.getElementById('loyalty-points');
    if (title) title.textContent = `Tích lũy FCA Member`;
    if (sub) sub.textContent = loyalty.tier ? `Hạng ${loyalty.tier}` : '';
    if (points) points.textContent = `+${loyalty.points || 0} điểm`;
  }

  /* ---- 6. Estimated time ---- */
  function setEstimatedTime(text) {
    const el = document.getElementById('estimated-time');
    if (!el) return;
    el.innerHTML = `<span class="material-symbols-outlined text-[18px]">timer</span><span>Thời gian dự kiến: ${escapeHtml(text || '—')}</span>`;
    state.estimatedTime = text || null;
  }

  /* ---- 7. Footer branches ---- */
  function renderFooterBranches(branches) {
    const container = document.getElementById('footer-branches');
    if (!container) return;
    if (!Array.isArray(branches) || branches.length === 0) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = branches
      .map(
        (b) => `
      <li class="flex items-start gap-2">
        <span class="material-symbols-outlined text-primary text-[16px] mt-0.5">storefront</span>
        <div><strong class="text-on-surface">${escapeHtml(b.city || '')}:</strong> ${escapeHtml(b.address || '')}</div>
      </li>`
      )
      .join('');
  }

  /* ============================================================
     EXPOSE API
     ============================================================ */
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
    state,
  };

  /* ============================================================
     VÍ DỤ NẠP TỪ DB
     ------------------------------------------------------------
     fetch('/api/cart')
       .then(r => r.json())
       .then(data => {
         FCA_CART.renderActiveBranch(data.branch);
         FCA_CART.renderCartItems(data.items);
         FCA_CART.renderUpsells(data.upsells);
         FCA_CART.renderSummary({
           subtotal: data.subtotal,
           shipping: data.shipping,
           originalShipping: data.originalShipping,
           freeShipping: data.freeShipping,
           discount: data.discount,
           couponCode: data.couponCode,
         });
         FCA_CART.renderLoyalty(data.loyalty);
         FCA_CART.setEstimatedTime(data.estimatedTime);
       });
     fetch('/api/branches').then(r => r.json()).then(FCA_CART.renderFooterBranches);
     ============================================================ */

})();