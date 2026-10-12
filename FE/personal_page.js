/* ============================================================
   FCA CULINARY - PERSONAL PAGE SCRIPT
   - Taste tag toggle
   - Profile save simulation
   - Reorder handler
   - Render functions cho việc nạp DB
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. TASTE TAG TOGGLE
     ============================================================ */
  window.toggleTag = function (btn) {
    const isSelected = btn.getAttribute('data-selected') === 'true';

    if (isSelected) {
      btn.setAttribute('data-selected', 'false');
      btn.className =
        'taste-btn px-4 py-2 rounded-full font-label-md text-label-md transition-all bg-surface-container text-on-surface hover:bg-surface-container-high flex items-center gap-1.5';
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'add';
    } else {
      btn.setAttribute('data-selected', 'true');
      btn.className =
        'taste-btn px-4 py-2 rounded-full font-label-md text-label-md transition-all bg-primary text-on-primary shadow-sm flex items-center gap-1.5';
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'check';
    }
  };

  /* ============================================================
     2. PROFILE SAVE SIMULATION
     ============================================================ */
  window.handleProfileSave = function () {
    const btn = document.getElementById('saveBtn');
    const alertBox = document.getElementById('saveAlert');
    if (!btn || !alertBox) return;

    btn.innerHTML =
      '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span><span>Đang lưu...</span>';
    btn.disabled = true;

    // TODO: gọi API/DB để lưu profile
    setTimeout(() => {
      btn.innerHTML =
        '<span class="material-symbols-outlined text-[20px]">save</span><span>Lưu thay đổi</span>';
      btn.disabled = false;
      alertBox.classList.remove('hidden');
      setTimeout(() => {
        alertBox.classList.add('hidden');
      }, 4000);
    }, 700);
  };

  /* ============================================================
     3. REORDER HANDLER
     ============================================================ */
  window.handleReorder = function (orderId) {
    // TODO: gọi API để thêm lại món vào giỏ hàng
    alert(
      `Các món từ đơn ${orderId || ''} đã được thêm vào giỏ hàng của bạn!`
    );
  };

  /* ============================================================
     4. RENDER FUNCTIONS - NẠP DỮ LIỆU TỪ DB
     ------------------------------------------------------------
     Gọi:
       FCA_PERSONAL.renderUserProfile(user);
       FCA_PERSONAL.renderVipTier(tier);
       FCA_PERSONAL.renderTasteTags(tags);
       FCA_PERSONAL.renderAddresses(addresses);
       FCA_PERSONAL.renderRecentOrders(orders);
       FCA_PERSONAL.renderFooterBranches(branches);
     ============================================================ */

  /* ---- 4.1 Render user profile card ---- */
  function renderUserProfile(user) {
    if (!user) return;

    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-display-email');
    const tierEl = document.getElementById('user-tier-badge');
    const pointsEl = document.getElementById('user-points');
    const orderBadge = document.getElementById('order-count-badge');
    const voucherBadge = document.getElementById('voucher-badge');

    if (nameEl) nameEl.textContent = user.name || '—';
    if (emailEl) emailEl.textContent = user.email || '—';

    if (tierEl) {
      tierEl.innerHTML = `
        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">stars</span>
        <span>${user.tierLabel || '—'}</span>`;
    }

    if (pointsEl) {
      pointsEl.innerHTML = `${(user.points ?? 0).toLocaleString('vi-VN')} <span class="font-label-md text-label-md font-medium text-on-surface-variant">điểm</span>`;
    }

    if (orderBadge) orderBadge.textContent = user.orderCount ?? 0;

    if (voucherBadge) {
      voucherBadge.textContent = `${user.newVoucherCount ?? 0} mới`;
      voucherBadge.setAttribute('data-count', String(user.newVoucherCount ?? 0));
    }

    // Điền vào form
    const f = document.getElementById('fullName');
    const p = document.getElementById('phoneNumber');
    const e = document.getElementById('emailAddress');
    const d = document.getElementById('dob');
    if (f) f.value = user.name || '';
    if (p) p.value = user.phone || '';
    if (e) e.value = user.email || '';
    if (d) d.value = user.dob || '';

    // Giới tính
    if (user.gender) {
      const radio = document.querySelector(
        `input[name="gender"][value="${user.gender}"]`
      );
      if (radio) radio.checked = true;
    }
  }

  /* ---- 4.2 Render VIP tier banner ---- */
  function renderVipTier(tier) {
    if (!tier) return;

    const nameEl = document.getElementById('vip-tier-name');
    const codeEl = document.getElementById('vip-member-code');
    const nextEl = document.getElementById('vip-next-tier');
    const progTextEl = document.getElementById('vip-progress-text');
    const progBarEl = document.getElementById('vip-progress-bar');
    const hintEl = document.getElementById('vip-progress-hint');

    if (nameEl) nameEl.textContent = tier.name || '—';
    if (codeEl) codeEl.textContent = tier.memberCode || '—';
    if (nextEl) nextEl.textContent = tier.nextTier || '—';

    const pct = tier.progressPercent ?? 0;
    if (progTextEl) {
      progTextEl.textContent = `${(tier.currentPoints ?? 0).toLocaleString('vi-VN')} / ${(tier.nextTierPoints ?? 0).toLocaleString('vi-VN')} điểm (${pct}%)`;
    }
    if (progBarEl) progBarEl.style.width = `${pct}%`;
    if (hintEl) {
      hintEl.innerHTML = `Tích lũy thêm <strong class="text-surface font-semibold">${(tier.pointsToNext ?? 0).toLocaleString('vi-VN')} điểm</strong> để mở khóa ưu đãi ${tier.nextTier || ''}`;
    }
  }

  /* ---- 4.3 Render taste tags ---- */
  function renderTasteTags(tags) {
    const container = document.getElementById('tasteTags');
    if (!container) return;

    if (!Array.isArray(tags) || tags.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = tags
      .map((t) => {
        const selected = t.selected;
        return `
        <button class="taste-btn px-4 py-2 rounded-full font-label-md text-label-md transition-all ${
          selected
            ? 'bg-primary text-on-primary shadow-sm'
            : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
        } flex items-center gap-1.5"
          data-selected="${selected}"
          onclick="toggleTag(this)" type="button">
          <span class="material-symbols-outlined text-[16px]">${selected ? 'check' : 'add'}</span>
          <span>${t.label || ''}</span>
        </button>`;
      })
      .join('');
  }

  /* ---- 4.4 Render address list ---- */
  function renderAddresses(addresses) {
    const container = document.getElementById('address-list-container');
    if (!container) return;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      container.innerHTML = '';
      return;
    }

    const iconMap = {
      home: { icon: 'home', color: 'text-primary' },
      office: { icon: 'apartment', color: 'text-secondary' },
      other: { icon: 'place', color: 'text-outline' },
    };

    container.innerHTML = addresses
      .map((a) => {
        const meta = iconMap[a.type] || iconMap.other;
        return `
        <div class="bg-surface-container-low rounded-xl p-space-lg relative flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined ${meta.color} text-[20px]">${meta.icon}</span>
                <span class="font-title-md text-title-md font-bold text-on-surface">${a.label || ''}</span>
              </div>
              ${a.isDefault
                ? `<span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-caps text-label-caps font-bold">Mặc định</span>`
                : a.tag
                  ? `<span class="font-label-caps text-[11px] text-outline">${a.tag}</span>`
                  : ''
              }
            </div>
            <p class="font-label-md text-label-md text-on-surface font-semibold">${a.receiverName || ''} • ${a.receiverPhone || ''}</p>
            <p class="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">${a.address || ''}</p>
            ${a.note ? `<span class="inline-block mt-2 font-label-caps text-[11px] text-outline">Ghi chú: ${a.note}</span>` : ''}
          </div>
          <div class="flex items-center ${a.isDefault ? 'justify-end' : 'justify-between'} mt-4 pt-3 border-t border-surface-container-highest/50">
            ${!a.isDefault
              ? `<button class="font-label-md text-label-md text-primary hover:underline" data-action="set-default" data-id="${a.id}">Đặt làm mặc định</button>`
              : ''
            }
            <div class="flex items-center gap-3">
              <button class="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1" data-action="edit" data-id="${a.id}">
                <span class="material-symbols-outlined text-[16px]">edit</span> Sửa
              </button>
              <span class="text-outline-variant">|</span>
              <button class="font-label-md text-label-md text-outline hover:text-error transition-colors flex items-center gap-1" data-action="delete" data-id="${a.id}">
                <span class="material-symbols-outlined text-[16px]">delete</span> Xóa
              </button>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  /* ---- 4.5 Render recent order ---- */
  function renderRecentOrders(orders) {
    const container = document.getElementById('recent-order-container');
    if (!container) return;

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Chỉ render đơn gần nhất (order[0])
    const o = orders[0];
    container.innerHTML = `
      <div class="bg-surface rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-lg shadow-sm">
        <div class="flex items-center gap-space-md">
          <div class="w-20 h-20 rounded-xl overflow-hidden shrink-0 shadow-inner bg-surface-container">
            ${o.image
              ? `<img class="w-full h-full object-cover" src="${o.image}" alt="${o.title || ''}"/>`
              : `<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-outline text-[32px]">restaurant</span></div>`
            }
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-label-caps text-label-caps font-mono text-outline">${o.orderCode || ''}</span>
              ${o.status
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-label-caps font-bold">
                    <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    ${o.status}
                  </span>`
                : ''
              }
            </div>
            <h4 class="font-title-md text-title-md font-bold text-on-surface">${o.title || ''}</h4>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">${o.time || ''} • ${o.address || ''}</p>
            <span class="font-label-lg text-label-lg font-bold text-primary mt-1">${o.total || ''}</span>
          </div>
        </div>
        <div class="flex items-center gap-space-sm w-full md:w-auto justify-end">
          <a class="px-4 py-2.5 rounded-lg bg-surface-container-high hover:bg-surface-dim font-label-md text-label-md font-semibold text-on-surface transition-colors" href="#">Xem chi tiết</a>
          <button class="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5" onclick="handleReorder('${o.orderCode || ''}')">
            <span class="material-symbols-outlined text-[18px]">replay</span>
            <span>Đặt lại đơn này</span>
          </button>
        </div>
      </div>`;
  }

  /* ---- 4.6 Render footer branches ---- */
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

  /* ============================================================
     5. EXPOSE API
     ============================================================ */
  window.FCA_PERSONAL = {
    renderUserProfile,
    renderVipTier,
    renderTasteTags,
    renderAddresses,
    renderRecentOrders,
    renderFooterBranches,
  };

  /* ============================================================
     6. VÍ DỤ CÁCH NẠP TỪ DB (bỏ comment khi dùng thật)
     ------------------------------------------------------------
     fetch('/api/me/profile')
       .then(r => r.json())
       .then(data => {
         FCA_PERSONAL.renderUserProfile(data.user);
         FCA_PERSONAL.renderVipTier(data.tier);
         FCA_PERSONAL.renderTasteTags(data.tasteTags);
         FCA_PERSONAL.renderAddresses(data.addresses);
         FCA_PERSONAL.renderRecentOrders(data.recentOrders);
       });

     fetch('/api/branches')
       .then(r => r.json())
       .then(branches => FCA_PERSONAL.renderFooterBranches(branches));
     ============================================================ */

})();