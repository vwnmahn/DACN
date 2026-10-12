/* ============================================================
   FCA CULINARY - PAYMENT PAGE SCRIPT
   - VAT toggle
   - Delivery time radio selection
   - Coupon apply
   - Order submit
   - Render functions (dùng khi nạp DB)
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. VAT TOGGLE
     ============================================================ */
  const vatToggle = document.getElementById('vat-toggle');
  const vatFields = document.getElementById('vat-fields');
  if (vatToggle && vatFields) {
    vatToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        vatFields.classList.remove('hidden');
        vatFields.classList.add('flex');
      } else {
        vatFields.classList.remove('flex');
        vatFields.classList.add('hidden');
      }
    });
  }

  /* ============================================================
     2. DELIVERY TIME RADIO SELECTION
     ============================================================ */
  const deliveryCards = document.querySelectorAll('.delivery-time-card');
  deliveryCards.forEach((card) => {
    const radio = card.querySelector('input[type="radio"]');
    card.addEventListener('click', () => {
      deliveryCards.forEach((c) => {
        c.classList.remove('bg-surface-container-lowest');
        c.classList.add('bg-surface-container-low');
      });
      card.classList.remove('bg-surface-container-low');
      card.classList.add('bg-surface-container-lowest');
      if (radio) radio.checked = true;
    });
  });

  /* ============================================================
     3. COUPON APPLY
     ============================================================ */
  const applyBtn = document.getElementById('apply-coupon-btn');
  const couponInput = document.getElementById('coupon-input');
  const couponMessage = document.getElementById('coupon-message');
  const couponMessageText = document.getElementById('coupon-message-text');
  const discountRow = document.getElementById('discount-row');
  const discountCodeLabel = document.getElementById('discount-code-label');
  const discountAmount = document.getElementById('discount-amount');
  const savingsLabel = document.getElementById('savings-label');

  let currentCoupon = null; // { code, discount }

  if (applyBtn && couponInput) {
    applyBtn.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      if (!code) return;

      // TODO: gọi API/DB để kiểm tra coupon thật
      // Demo: chỉ hiện feedback UI
      applyBtn.innerText = 'Đã áp dụng';
      applyBtn.classList.add('bg-primary-container');

      // Nếu có discount thật từ DB thì cập nhật:
      // currentCoupon = { code, discount: 25000 };
      // updateDiscountDisplay();

      setTimeout(() => {
        applyBtn.innerText = 'Áp dụng';
        applyBtn.classList.remove('bg-primary-container');
      }, 2000);
    });
  }

  /* ============================================================
     4. ORDER SUBMIT
     ============================================================ */
  const orderSubmitBtn = document.getElementById('order-submit-btn');
  if (orderSubmitBtn) {
    orderSubmitBtn.addEventListener('click', () => {
      orderSubmitBtn.innerHTML =
        '<span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span><span>Đang xử lý thanh toán an toàn...</span>';

      // TODO: gọi API tạo đơn hàng
      setTimeout(() => {
        orderSubmitBtn.innerHTML =
          '<span class="material-symbols-outlined text-[24px]">task_alt</span><span>Đặt hàng thành công! Đang chuyển hướng...</span>';
        orderSubmitBtn.classList.remove('bg-primary');
        orderSubmitBtn.classList.add('bg-secondary');
      }, 1400);
    });
  }

  /* ============================================================
     5. HELPERS
     ============================================================ */
  function formatVND(n) {
    return Number(n || 0).toLocaleString('vi-VN') + 'đ';
  }

  function updateTotals({ subtotal = 0, shipping = 0, discount = 0 } = {}) {
    const total = Math.max(0, subtotal + shipping - discount);
    document.getElementById('subtotal-amount').textContent = formatVND(subtotal);
    document.getElementById('shipping-fee').textContent = formatVND(shipping);
    document.getElementById('total-amount').textContent = formatVND(total);

    // Cập nhật text nút CTA nếu chưa bấm
    const btn = document.getElementById('order-submit-btn');
    if (btn && btn.innerText.includes('Xác nhận đặt hàng')) {
      btn.innerHTML =
        '<span class="material-symbols-outlined text-[24px]">verified</span>' +
        `<span>Xác nhận đặt hàng &amp; Thanh toán (${formatVND(total)})</span>`;
    }
  }

  /* ============================================================
     6. RENDER FUNCTIONS - NẠP TỪ DB
     ------------------------------------------------------------
     Gọi:
       FCA_PAYMENT.renderDeliveryAddress(address);
       FCA_PAYMENT.renderOrderItems(items);
       FCA_PAYMENT.renderSummary({ subtotal, shipping, discount });
       FCA_PAYMENT.renderFooterBranches(branches);
       FCA_PAYMENT.setScheduledTimeSlot('11:45 - 12:15 hôm nay');
     ============================================================ */

  /* ---- 6.1 Render địa chỉ giao món ---- */
  function renderDeliveryAddress(addr) {
    const box = document.getElementById('delivery-address-card');
    if (!box) return;

    if (!addr) {
      box.innerHTML =
        '<p class="text-on-surface-variant text-sm italic">Chưa có địa chỉ giao món. Nhấn "Thay đổi địa chỉ" để chọn.</p>';
      return;
    }

    box.innerHTML = `
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="font-title-md text-title-md text-on-surface font-bold">${addr.receiverName || ''}</span>
          ${addr.tag ? `<span class="bg-primary/10 text-primary font-label-caps text-label-caps px-2 py-0.5 rounded-full font-bold">${addr.tag}</span>` : ''}
        </div>
        <p class="font-body-md text-body-md text-on-surface font-medium">${addr.receiverPhone || ''}</p>
        <p class="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
          <span class="material-symbols-outlined text-outline text-[18px]">apartment</span>
          ${addr.address || ''}
        </p>
      </div>`;
  }

  /* ---- 6.2 Render danh sách món ---- */
  function renderOrderItems(items) {
    const container = document.getElementById('order-items-container');
    const countEl = document.getElementById('order-item-count');
    const cartBadge = document.getElementById('cart-count-badge');
    const subtotalCount = document.getElementById('subtotal-count');

    if (!container) return;

    const list = Array.isArray(items) ? items : [];

    if (countEl) countEl.textContent = `${list.length} món`;
    if (subtotalCount) subtotalCount.textContent = String(list.length);

    if (cartBadge) {
      cartBadge.textContent = String(list.length);
      cartBadge.setAttribute('data-count', String(list.length));
    }

    if (list.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = list
      .map(
        (item) => `
      <div class="flex items-center gap-space-sm pb-space-sm">
        <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm relative bg-surface-container">
          ${item.image
            ? `<img class="w-full h-full object-cover" src="${item.image}" alt="${item.name || ''}"/>`
            : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-outline text-[24px]">restaurant</span></div>`
          }
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-1">
            <h3 class="font-label-lg text-label-lg font-bold text-on-surface truncate">${item.name || ''}</h3>
            <span class="font-label-lg text-label-lg font-bold text-on-surface shrink-0">${formatVND(item.price)}</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${item.description || ''}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="font-label-caps text-[10px] bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded font-semibold">Số lượng: ${item.quantity || 1}</span>
            ${item.note ? `<span class="font-body-sm text-body-sm text-outline">• ${item.note}</span>` : ''}
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  /* ---- 6.3 Render tổng kết chi phí ---- */
  function renderSummary(summary) {
    const s = summary || {};
    const subtotal = s.subtotal ?? 0;
    const shipping = s.shipping ?? 0;
    const discount = s.discount ?? 0;

    // Cập nhật dòng voucher
    if (discount > 0) {
      if (discountRow) {
        discountRow.classList.remove('hidden');
        discountRow.classList.add('flex');
      }
      if (discountCodeLabel) {
        discountCodeLabel.textContent = s.couponCode ? `(${s.couponCode})` : '';
      }
      if (discountAmount) {
        discountAmount.textContent = '-' + formatVND(discount);
      }
      if (savingsLabel) {
        savingsLabel.classList.remove('hidden');
        savingsLabel.textContent = `Tiết kiệm ${formatVND(discount)}`;
      }
    } else {
      if (discountRow) {
        discountRow.classList.add('hidden');
        discountRow.classList.remove('flex');
      }
      if (savingsLabel) savingsLabel.classList.add('hidden');
    }

    updateTotals({ subtotal, shipping, discount });
  }

  /* ---- 6.4 Render footer branches ---- */
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
          <div><strong class="text-on-surface">${b.city || ''}:</strong> ${b.address || ''}</div>
        </li>`
      )
      .join('');
  }

  /* ---- 6.5 Set khung giờ hẹn ---- */
  function setScheduledTimeSlot(text) {
    const el = document.getElementById('scheduled-time-slot');
    if (el) el.textContent = text || '—';
  }

  /* ============================================================
     7. EXPOSE API
     ============================================================ */
  window.FCA_PAYMENT = {
    renderDeliveryAddress,
    renderOrderItems,
    renderSummary,
    renderFooterBranches,
    setScheduledTimeSlot,
    updateTotals,
    formatVND,
  };

  /* ============================================================
     8. VÍ DỤ NẠP TỪ DB (bỏ comment khi dùng thật)
     ------------------------------------------------------------
     fetch('/api/cart/checkout')
       .then(r => r.json())
       .then(data => {
         FCA_PAYMENT.renderDeliveryAddress(data.address);
         FCA_PAYMENT.renderOrderItems(data.items);
         FCA_PAYMENT.renderSummary({
           subtotal: data.subtotal,
           shipping: data.shipping,
           discount: data.discount,
           couponCode: data.couponCode,
         });
         FCA_PAYMENT.setScheduledTimeSlot(data.scheduledSlot);
       });

     fetch('/api/branches')
       .then(r => r.json())
       .then(b => FCA_PAYMENT.renderFooterBranches(b));
     ============================================================ */

})();