/* ============================================================
   FCA CULINARY - PERSONAL PAGE SCRIPT
   - Taste tag toggle
   - Profile API integration
   - Reorder handler
   - Render functions cho việc nạp DB
   ============================================================ */

(function () {
  'use strict';
  const API = 'http://localhost:8080/api/v1';
  let currentAccount = null;

  function headers(json) {
    if (window.FCA_SHELL?.authHeaders) return window.FCA_SHELL.authHeaders(json);
    const result = json ? { 'Content-Type': 'application/json' } : {};
    const token = localStorage.getItem('accessToken');
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...headers(options.json), ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Không thể kết nối hệ thống FCA.');
    return payload.data;
  }

  function setMessage(element, message, error) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('hidden', 'text-error', 'text-primary');
    element.classList.add(error ? 'text-error' : 'text-primary');
  }

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
     2. PROFILE SAVE
     ============================================================ */
  window.handleProfileSave = async function () {
    const btn = document.getElementById('saveBtn');
    const alertBox = document.getElementById('saveAlert');
    if (!btn || !alertBox) return;

    btn.innerHTML =
      '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span><span>Đang lưu...</span>';
    btn.disabled = true;

    const data = new FormData();
    data.append('email', document.getElementById('emailAddress').value.trim());
    const address = document.getElementById('address')?.value.trim();
    const dateOfBirth = document.getElementById('dob')?.value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    if (address) data.append('address', address);
    if (dateOfBirth) data.append('dateOfBirth', dateOfBirth);
    if (gender === 'true' || gender === 'false') data.append('gender', gender);
    try {
      await request(`${API}/auth/update`, { method: 'PUT', body: data });
      await loadAccount();
      btn.innerHTML =
        '<span class="material-symbols-outlined text-[20px]">save</span><span>Lưu thay đổi</span>';
      btn.disabled = false;
      setMessage(alertBox, 'Thông tin tài khoản đã được cập nhật thành công trên hệ thống FCA!', false);
    } catch (error) {
      btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">save</span><span>Lưu thay đổi</span>';
      btn.disabled = false;
      setMessage(alertBox, error.message, true);
    }
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
    const avatar = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = user.username || '—';
    if (emailEl) emailEl.textContent = user.email || '—';
    if (avatar && user.avatarUrl) {
      const image = document.createElement('img');
      image.className = 'w-full h-full object-cover';
      image.alt = `Ảnh đại diện của ${user.username || 'tài khoản'}`;
      image.src = new URL(user.avatarUrl, 'http://localhost:8080').href;
      avatar.replaceChildren(image);
    }

    if (tierEl) {
      tierEl.innerHTML = `
        <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">stars</span>
        <span>${rankLabel(user.membershipRank)}</span>`;
    }

    if (pointsEl) {
      pointsEl.innerHTML = `${(user.loyaltyPoints ?? 0).toLocaleString('vi-VN')} <span class="font-label-md text-label-md font-medium text-on-surface-variant">điểm</span>`;
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
    if (f) f.value = user.username || '';
    if (p) p.value = user.phoneNumber || '';
    if (e) e.value = user.email || '';
    if (d) d.value = user.dateOfBirth || '';
    const address = document.getElementById('address');
    const available = document.getElementById('available-points');
    if (address) address.value = user.address || '';
    if (available) available.textContent = (user.availablePoints ?? 0).toLocaleString('vi-VN');

    // Giới tính
    if (user.gender !== null && user.gender !== undefined) {
      const radio = document.querySelector(
        `input[name="gender"][value="${String(user.gender)}"]`
      );
      if (radio) radio.checked = true;
    }
  }

  const RANKS = [
    { key: 'BRONZE', label: 'Đồng', min: 0 }, { key: 'SILVER', label: 'Bạc', min: 100 },
    { key: 'GOLD', label: 'Vàng', min: 300 }, { key: 'PLATINUM', label: 'Bạch kim', min: 600 },
    { key: 'DIAMOND', label: 'Kim cương — VIP', min: 1000 },
  ];
  function rankLabel(rank) { return RANKS.find((item) => item.key === rank)?.label || 'Đồng'; }

  function renderAccountTier(account) {
    const points = account.loyaltyPoints ?? 0;
    const index = Math.max(0, RANKS.findIndex((item) => item.key === account.membershipRank));
    const current = RANKS[index];
    const next = RANKS[index + 1];
    renderVipTier(next ? {
      name: current.label, memberCode: '—', nextTier: next.label,
      currentPoints: points, nextTierPoints: next.min,
      pointsToNext: Math.max(0, next.min - points),
      progressPercent: Math.max(0, Math.min(100, ((points - current.min) / (next.min - current.min)) * 100)),
    } : { name: current.label, memberCode: '—', nextTier: 'Hạng cao nhất', currentPoints: points,
      nextTierPoints: points, pointsToNext: 0, progressPercent: 100 });
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
      hintEl.innerHTML = tier.nextTier === 'Hạng cao nhất'
        ? '<strong class="text-surface font-semibold">Đã đạt hạng cao nhất</strong>'
        : `Tích lũy thêm <strong class="text-surface font-semibold">${(tier.pointsToNext ?? 0).toLocaleString('vi-VN')} điểm</strong> để mở khóa ưu đãi ${tier.nextTier || ''}`;
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

  async function loadAccount() {
    currentAccount = await request(`${API}/auth/me`);
    renderUserProfile(currentAccount);
    renderAccountTier(currentAccount);
  }

  function renderRedeemable(vouchers) {
    const container = document.getElementById('redeemable-vouchers');
    const status = document.getElementById('redeem-status');
    if (!container) return;
    container.replaceChildren();
    if (!vouchers.length) {
      setMessage(status, 'Hiện chưa có voucher để đổi điểm.', false);
      return;
    }
    status?.classList.add('hidden');
    vouchers.forEach((voucher) => {
      const card = document.createElement('article');
      card.className = 'border border-surface-container-highest rounded-xl p-space-md flex items-center justify-between gap-space-md';
      const info = document.createElement('div');
      const code = document.createElement('strong');
      code.className = 'block text-primary';
      code.textContent = voucher.code;
      const description = document.createElement('span');
      description.className = 'font-body-sm text-body-sm text-on-surface-variant';
      description.textContent = voucher.description || 'Voucher FCA Culinary';
      info.append(code, description);
      const button = document.createElement('button');
      button.className = 'shrink-0 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold disabled:opacity-50';
      button.type = 'button';
      button.textContent = 'Đổi 300 điểm';
      button.disabled = (currentAccount?.availablePoints ?? 0) < 300;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const redemption = await request(`${API}/vouchers/${voucher.id}/redeem`, { method: 'POST' });
          setMessage(status, `Đã đổi voucher ${redemption.voucher.code} thành công.`, false);
          await Promise.all([loadAccount(), loadRedeemable(), loadOwnedVouchers()]);
        } catch (error) {
          setMessage(status, error.message, true);
          button.disabled = false;
        }
      });
      card.append(info, button);
      container.appendChild(card);
    });
  }

  async function loadRedeemable() {
    const data = await request(`${API}/vouchers/redeemable?size=100`);
    renderRedeemable(data?.content || []);
  }

  async function loadOwnedVouchers() {
    const vouchers = await request(`${API}/vouchers/mine`);
    const badge = document.getElementById('voucher-badge');
    if (badge) {
      badge.dataset.count = String(vouchers.length);
      badge.textContent = String(vouchers.length);
    }
  }

  function setupProfileActions() {
    document.getElementById('cancelProfileBtn')?.addEventListener('click', () => {
      if (currentAccount) renderUserProfile(currentAccount);
    });
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmation = document.getElementById('confirmNewPassword').value;
      const status = document.getElementById('password-status');
      if (newPassword !== confirmation) {
        setMessage(status, 'Xác nhận mật khẩu mới không khớp.', true);
        return;
      }
      const button = document.getElementById('changePasswordBtn');
      button.disabled = true;
      try {
        await request(`${API}/auth/change-password`, {
          method: 'POST', json: true, body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (form) form.reset();
        setMessage(status, 'Đổi mật khẩu thành công', false);
      } catch (error) { setMessage(status, error.message, true); }
      finally { button.disabled = false; }
    });
    document.getElementById('logout-link')?.addEventListener('click', async (event) => {
      event.preventDefault();
      try { await window.FCA_SHELL.logout(); } catch (error) { window.alert(error.message); }
    });
  }

  async function initialize() {
    if (!localStorage.getItem('accessToken')) {
      window.location.href = 'login.html';
      return;
    }
    setupProfileActions();
    try {
      await loadAccount();
      await Promise.all([loadRedeemable(), loadOwnedVouchers()]);
    } catch (error) {
      if (/xác thực|token/i.test(error.message)) window.location.href = 'login.html';
      else setMessage(document.getElementById('redeem-status'), error.message, true);
    }
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

  initialize();

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
