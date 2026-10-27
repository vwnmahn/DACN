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
  let reservationsLoaded = false;
  let reservationsLoading = false;
  let ordersLoaded = false;
  let ordersLoading = false;
  let ownedVouchersLoaded = false;
  let profileSaving = false;
  let profileConfirmOpen = false;
  let refreshAccessTokenPromise = null;



  function headers(json) {
    if (window.FCA_SHELL?.authHeaders) return window.FCA_SHELL.authHeaders(json);
    const result = json ? { 'Content-Type': 'application/json' } : {};
    const token = localStorage.getItem('accessToken');
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
  }

  async function refreshAccessToken() {
    if (refreshAccessTokenPromise) return refreshAccessTokenPromise;
    refreshAccessTokenPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      const response = await fetch(`${API}/auth/refresh`, {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const payload = await response.json().catch(() => ({}));
      const data = payload.data ?? payload;
      if (!response.ok || !data?.accessToken) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.replace('login.html');
        throw new Error(payload.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken;
    })();
    try { return await refreshAccessTokenPromise; }
    finally { refreshAccessTokenPromise = null; }
  }

  async function request(url, options = {}) {
    const send = (token) => fetch(url, {
      ...options,
      headers: { ...headers(options.json), ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    let response = await send(localStorage.getItem('accessToken'));
    if (response.status === 401) response = await send(await refreshAccessToken());
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

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function setupPersonalPanels() {
    const menuItems = document.querySelectorAll('[data-personal-panel]');
    const panels = document.querySelectorAll('[data-personal-content]');

    menuItems.forEach((item) => item.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = item.dataset.personalPanel;

      panels.forEach((panel) => { panel.hidden = panel.id !== targetId; });
      menuItems.forEach((menuItem) => {
        const active = menuItem === item;
        menuItem.classList.toggle('bg-primary', active);
        menuItem.classList.toggle('text-on-primary', active);
        menuItem.classList.toggle('shadow-sm', active);
        menuItem.classList.toggle('text-on-surface', !active);
        menuItem.classList.toggle('hover:bg-surface-container', !active);
        if (active) menuItem.setAttribute('aria-current', 'page');
        else menuItem.removeAttribute('aria-current');
      });

      if (targetId === 'reservation-history-panel' && !reservationsLoaded) {
        loadReservations();
      }
      if (targetId === 'order-history-panel' && !ordersLoaded) loadCompletedOrders();
      if (targetId === 'voucher-wallet-panel' && !ownedVouchersLoaded) {
        loadOwnedVouchers().catch((error) => {
          setMessage(document.getElementById('owned-vouchers-status'), error.message, true);
        });
      }
    }));
  }

  function formatReservationDateTime(value, part) {
    if (!value) return '—';
    const [date = '', time = ''] = String(value).split('T');
    if (part === 'date') {
      const [year, month, day] = date.split('-');
      return year && month && day ? `${day}/${month}/${year}` : date;
    }
    return time ? time.slice(0, 5) : '—';
  }

  function reservationStatusLabel(status) {
    return ({
      PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy',
      COMPLETED: 'Đã hoàn tất', NO_SHOW: 'Không đến'
    })[status] || status || 'Không xác định';
  }

  function renderReservations(reservations) {
    const container = document.getElementById('reservation-history-list');
    const status = document.getElementById('reservation-history-status');
    if (!container || !status) return;

    container.replaceChildren();
    if (!Array.isArray(reservations) || reservations.length === 0) {
      status.textContent = 'Bạn chưa có lịch sử đặt bàn.';
      status.classList.remove('hidden', 'text-error');
      return;
    }

    status.classList.add('hidden');
    container.innerHTML = reservations.map((reservation) => `
      <article class="border border-surface-container-highest rounded-xl p-space-lg bg-surface">
        <div class="flex items-start justify-between gap-space-md mb-space-md">
          <div><h4 class="font-title-md text-title-md font-bold text-on-surface">${escapeHtml(reservation.restaurantName)}</h4>
          <p class="font-body-sm text-body-sm text-outline">Mã đặt bàn #${escapeHtml(reservation.reservationId)}</p></div>
          <span class="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-md text-label-md font-semibold">${escapeHtml(reservationStatusLabel(reservation.status))}</span>
        </div>
        <dl class="grid grid-cols-2 gap-space-md font-body-sm text-body-sm">
          <div><dt class="text-outline">Ngày đặt bàn</dt><dd class="font-semibold text-on-surface">${escapeHtml(formatReservationDateTime(reservation.startTime, 'date'))}</dd></div>
          <div><dt class="text-outline">Giờ đặt bàn</dt><dd class="font-semibold text-on-surface">${escapeHtml(formatReservationDateTime(reservation.startTime, 'time'))}</dd></div>
          <div><dt class="text-outline">Số khách</dt><dd class="font-semibold text-on-surface">${escapeHtml(reservation.guestCount)} người</dd></div>
          <div><dt class="text-outline">Tên người đặt</dt><dd class="font-semibold text-on-surface">${escapeHtml(reservation.customerName)}</dd></div>
          <div><dt class="text-outline">Số điện thoại</dt><dd class="font-semibold text-on-surface">${escapeHtml(reservation.customerPhone)}</dd></div>
          <div><dt class="text-outline">Ghi chú</dt><dd class="font-semibold text-on-surface">${escapeHtml(reservation.note || 'Không có')}</dd></div>
        </dl>
        ${reservation.cancellable ? `<div class="mt-space-md pt-space-md border-t border-surface-container-highest/60 text-right"><button class="cancel-reservation-btn px-4 py-2 rounded-lg border border-error text-error font-label-md text-label-md font-bold hover:bg-error-container/30" type="button" data-reservation-id="${escapeHtml(reservation.reservationId)}">Hủy đặt bàn</button></div>` : ''}
      </article>`).join('');
  }

async function loadReservations(force = false) {
  if (reservationsLoading || (reservationsLoaded && !force)) return;

  const status = document.getElementById('reservation-history-status');
  const badge = document.getElementById('reservation-count-badge');

  reservationsLoading = true;

  if (status) {
    status.textContent = 'Đang tải lịch sử đặt bàn...';
    status.classList.remove('hidden', 'text-error');
  }

  try {
    const reservations = await request(`${API}/table-reservations/mine`);
    const list = Array.isArray(reservations) ? reservations : [];

    // Badge đếm tất cả lượt đặt bàn, bao gồm cả lượt đã hủy.
    if (badge) {
      badge.textContent = list.length;
    }

    renderReservations(list);
    reservationsLoaded = true;
  } catch (error) {
    if (status) {
      status.textContent = error.message;
      status.classList.remove('hidden');
      status.classList.add('text-error');
    }
  } finally {
    reservationsLoading = false;
  }
}


  async function cancelReservation(reservationId, button) {
    const modal = document.getElementById('cancel-reservation-modal');
    const successModal = document.getElementById('cancel-reservation-success-modal');
    const errorEl = document.getElementById('cancel-reservation-error');
    const confirmBtn = document.getElementById('confirm-cancel-reservation-btn');
    const keepBtn = document.getElementById('keep-reservation-btn');
    const successCloseBtn = document.getElementById('close-cancel-reservation-success');

    if (!modal || !successModal || !errorEl || !confirmBtn || !keepBtn || !successCloseBtn) {
      window.alert('Không tìm thấy giao diện xác nhận hủy đặt bàn.');
      return;
    }

    errorEl.hidden = true;
    errorEl.textContent = '';
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Đồng ý hủy';
    modal.hidden = false;
    keepBtn.focus();

    // Chờ người dùng chọn "Đồng ý hủy" hoặc "Không, giữ lại".
    const confirmed = await new Promise((resolve) => {
      const cleanup = () => {
        confirmBtn.removeEventListener('click', onConfirm);
        keepBtn.removeEventListener('click', onKeep);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onKeep = () => {
        cleanup();
        resolve(false);
      };

      confirmBtn.addEventListener('click', onConfirm, { once: true });
      keepBtn.addEventListener('click', onKeep, { once: true });
    });

    if (!confirmed) {
      modal.hidden = true;
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang hủy...';
    button.disabled = true;
    button.textContent = 'Đang hủy...';

    try {
      await request(
        `${API}/table-reservations/${encodeURIComponent(reservationId)}/cancel`,
        { method: 'PATCH' }
      );

      // Chỉ hiện thành công sau khi API hủy trả về thành công.
      modal.hidden = true;
      reservationsLoaded = false;
      await loadReservations(true);

      successModal.hidden = false;
      successCloseBtn.focus();
    } catch (error) {
      errorEl.textContent = error.message || 'Hủy đặt bàn thất bại. Vui lòng thử lại.';
      errorEl.hidden = false;
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Thử lại';
      button.disabled = false;
      button.textContent = 'Hủy đặt bàn';
    }
  }



  function setupReservationHistory() {
    document.getElementById('reload-reservations')
      ?.addEventListener('click', () => loadReservations(true));

    document.getElementById('reservation-history-list')
      ?.addEventListener('click', (event) => {
        const button = event.target.closest('.cancel-reservation-btn');
        if (button && !button.disabled) {
          cancelReservation(button.dataset.reservationId, button);
        }
      });

    document.getElementById('close-cancel-reservation-success')
      ?.addEventListener('click', () => {
        document.getElementById('cancel-reservation-success-modal').hidden = true;
      });
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
    if (!btn || !alertBox || profileSaving || profileConfirmOpen) return;

    const email = document.getElementById('emailAddress').value.trim();
    const address = document.getElementById('address')?.value.trim() || '';
    const dateOfBirth = document.getElementById('dob')?.value || '';
    const gender = document.querySelector('input[name="gender"]:checked')?.value || '';
    const avatarFile = document.getElementById('avatar-input')?.files?.[0];
    const changed = email !== (currentAccount?.email || '')
      || address !== (currentAccount?.address || '')
      || dateOfBirth !== (currentAccount?.dateOfBirth || '')
      || gender.toUpperCase() !== String(currentAccount?.gender || '').toUpperCase()
      || Boolean(avatarFile);
    if (!changed) {
      setMessage(alertBox, 'Bạn chưa thay đổi thông tin nào.', false);
      return;
    }

    const modal = document.getElementById('profile-confirm-modal');
    const cancelConfirm = document.getElementById('cancel-profile-confirm');
    const confirmUpdate = document.getElementById('confirm-profile-update');
    if (!modal || !cancelConfirm || !confirmUpdate) return;
    profileConfirmOpen = true;
    modal.hidden = false;
    const confirmed = await new Promise((resolve) => {
      const finish = (value) => {
        cancelConfirm.removeEventListener('click', onCancel);
        confirmUpdate.removeEventListener('click', onConfirm);
        modal.hidden = true;
        resolve(value);
      };
      const onCancel = () => finish(false);
      const onConfirm = () => finish(true);
      cancelConfirm.addEventListener('click', onCancel, { once: true });
      confirmUpdate.addEventListener('click', onConfirm, { once: true });
    });
    profileConfirmOpen = false;
    if (!confirmed) return;

    profileSaving = true;
    btn.innerHTML =
      '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span><span>Đang lưu...</span>';
    btn.disabled = true;
    confirmUpdate.disabled = true;

    const data = new FormData();
    data.append('email', email);

    if (address) data.append('address', address);
    if (dateOfBirth) data.append('dateOfBirth', dateOfBirth);
    if (avatarFile) data.append('avatar', avatarFile);
    if (gender) {
    data.append('gender', gender);
    }
    try {
      await request(`${API}/auth/update`, { method: 'PUT', body: data });
      sessionStorage.setItem('fca_profile_update_success', '1');
      window.location.reload();
    } catch (error) {
      profileSaving = false;
      confirmUpdate.disabled = false;
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
    if (address) address.value = user.address || '';

    // Giới tính
    // Hiển thị giới tính từ Backend (GenderStatus)
    if (user.gender != null) {
      const gender = String(user.gender).toUpperCase();

      document.querySelectorAll('input[name="gender"]').forEach((radio) => {
        radio.checked = radio.value.toUpperCase() === gender;
      });
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

  /* ---- 4.5 Render lịch sử đơn đã giao ---- */
  function renderRecentOrders(orders) {
    const container = document.getElementById('recent-order-container');
    if (!container) return;

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = '<p class="text-on-surface-variant">Bạn chưa có đơn hàng đã giao thành công.</p>';
      return;
    }
    container.className = 'flex flex-col gap-space-md';
    container.innerHTML = orders.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemText = items.map((item) => `${escapeHtml(item.itemName)} × ${Number(item.quantity) || 0}`).join(', ');
      const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '—';
      return `<article class="bg-surface rounded-xl p-space-md shadow-sm">
        <div class="flex items-start justify-between gap-3"><div>
          <span class="font-mono text-outline">Đơn #${escapeHtml(order.id)}</span>
          <h4 class="font-title-md text-title-md font-bold text-on-surface">${escapeHtml(order.restaurantName || 'FCA Culinary')}</h4>
        </div><span class="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-bold">Đã giao</span></div>
        <p class="mt-2 text-on-surface-variant">${itemText || 'Không có chi tiết món'}</p>
        <div class="mt-3 flex items-center justify-between gap-3"><span class="text-sm text-outline">${escapeHtml(createdAt)}</span>
        <strong class="text-primary">${Number(order.totalAmount || 0).toLocaleString('vi-VN')}đ</strong></div>
      </article>`;
    }).join('');
  }

  function renderActiveOrders(orders) {
    const container = document.getElementById('active-order-container');
    if (!container) return;
    if (!orders.length) {
      container.innerHTML = '<p class="text-on-surface-variant">Hiện không có đơn đang xử lý.</p>';
      return;
    }
    const steps = [
      ['PENDING', 'Chờ xác nhận'], ['CONFIRMED', 'Đã xác nhận'], ['PREPARING', 'Chuẩn bị món'],
      ['DELIVERING', 'Đang giao'], ['ARRIVED', 'Đã đến'], ['COMPLETED', 'Đã giao']
    ];
    const statusIndex = (status) => status === 'AWAITING_PAYMENT' ? 0
      : status === 'READY_FOR_DELIVERY' ? 2 : steps.findIndex(([key]) => key === status);
    container.innerHTML = orders.map((order) => {
      const current = statusIndex(order.status);
      const progress = steps.map(([key, label], index) => `
        <li class="flex-1 min-w-[92px] ${index <= current ? 'text-primary' : 'text-outline'}">
          <span class="block w-3 h-3 rounded-full mb-1 ${index <= current ? 'bg-primary' : 'bg-surface-container-highest'}"></span>
          <span class="text-xs font-semibold">${label}</span>
        </li>`).join('');
      return `<article class="bg-surface rounded-xl p-space-md shadow-sm">
        <div class="flex justify-between gap-3"><strong>Đơn #${escapeHtml(order.id)}</strong>
        <strong class="text-primary">${Number(order.totalAmount || 0).toLocaleString('vi-VN')}đ</strong></div>
        <p class="text-sm text-on-surface-variant mt-1">${escapeHtml(order.restaurantName || 'FCA Culinary')}</p>
        <ol class="flex overflow-x-auto mt-4 gap-2" aria-label="Tiến trình đơn hàng">${progress}</ol>
      </article>`;
    }).join('');
  }

async function loadCompletedOrders(force = false) {
  if (ordersLoading || (ordersLoaded && !force)) return;

  ordersLoading = true;

  const container = document.getElementById('recent-order-container');

  if (container) {
    container.innerHTML =
      '<p class="text-on-surface-variant">Đang tải lịch sử đơn hàng...</p>';
  }

  try {
    const orders = await request(`${API}/orders`);
    const list = Array.isArray(orders) ? orders : [];

    // Badge đếm tất cả đơn hàng, bao gồm cả đơn đã hủy.
    const orderBadge = document.getElementById('order-count-badge');
    if (orderBadge) {
      orderBadge.textContent = list.length;
    }

    renderActiveOrders(
      list.filter(
        (order) =>
          order.status !== 'COMPLETED' &&
          order.status !== 'CANCELLED'
      )
    );

    renderRecentOrders(
      list.filter((order) => order.status === 'COMPLETED')
    );

    ordersLoaded = true;
  } catch (error) {
    if (container) {
      container.innerHTML =
        `<p class="text-error">${escapeHtml(error.message)}</p>`;
    }
  } finally {
    ordersLoading = false;
  }
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

  function renderOwnedVouchers(vouchers) {
    const container = document.getElementById('owned-vouchers-list');
    const status = document.getElementById('owned-vouchers-status');
    if (!container) return;
    container.replaceChildren();
    if (!vouchers.length) {
      setMessage(status, 'Tài khoản hiện chưa có voucher.', false);
      return;
    }
    status?.classList.add('hidden');
    vouchers.forEach((redemption) => {
      const voucher = redemption?.voucher;
      if (!voucher) return;
      const customerStatus = String(voucher.customerStatus || '').toUpperCase();
      const expiresAt = redemption.expiresAt ? new Date(redemption.expiresAt) : null;
      const expired = expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now();
      const statusText = expired
        ? 'Hết hạn'
        : customerStatus === 'USED'
          ? 'Đã sử dụng'
          : customerStatus === 'AVAILABLE'
            ? 'Đã được cấp'
            : customerStatus === 'UNAVAILABLE'
              ? 'Chưa đủ điều kiện'
              : 'Trạng thái chưa xác định';
      const card = document.createElement('article');
      card.className = 'rounded-xl border border-surface-container-highest p-space-md flex flex-col gap-3';
      const heading = document.createElement('div');
      heading.className = 'flex items-start justify-between gap-3';
      const code = document.createElement('strong');
      code.className = 'block text-primary';
      code.textContent = voucher.code || voucher.voucherCode || 'Voucher FCA';
      const stateLabel = document.createElement('span');
      stateLabel.className = `shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${customerStatus === 'AVAILABLE' && !expired ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant'}`;
      stateLabel.textContent = statusText;
      heading.append(code, stateLabel);
      const description = document.createElement('p');
      description.className = 'mt-1 font-body-sm text-body-sm text-on-surface-variant';
      description.textContent = voucher.description || voucher.name || 'Ưu đãi thuộc tài khoản của bạn';
      const value = Number(voucher.discountValue);
      const maximum = Number(voucher.maxDiscountAmount);
      const discountText = String(voucher.discountType || '').toUpperCase().includes('PERCENT')
        ? `Giảm ${Number.isFinite(value) ? value : '—'}%`
        : `Giảm ${Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—'}đ`;
      const details = document.createElement('dl');
      details.className = 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-on-surface-variant';
      const addDetail = (label, text) => {
        const term = document.createElement('dt');
        term.className = 'font-semibold text-on-surface';
        term.textContent = label;
        const detail = document.createElement('dd');
        detail.textContent = text;
        details.append(term, detail);
      };
      addDetail('Giá trị', discountText);
      addDetail('Giới hạn giảm', Number.isFinite(maximum) ? `${maximum.toLocaleString('vi-VN')}đ` : 'Theo mức giảm thực tế');
      addDetail('Điều kiện', voucher.description || 'Theo điều kiện backend hiện hành');
      addDetail('Hết hạn', expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.toLocaleString('vi-VN') : 'Theo thời hạn voucher');
      card.append(heading, description, details);
      container.appendChild(card);
    });
  }

  async function loadOwnedVouchers() {
    const result = await request(`${API}/vouchers/mine`);
    const redemptions = Array.isArray(result) ? result : result?.content || [];
    const vouchers = redemptions.filter((redemption) => redemption?.voucher);
    const availableCount = vouchers.filter((redemption) =>
      String(redemption.voucher.customerStatus || '').toUpperCase() === 'AVAILABLE'
      && (!redemption.expiresAt || new Date(redemption.expiresAt).getTime() > Date.now())
    ).length;
    const badge = document.getElementById('voucher-badge');
    if (badge) {
      badge.dataset.count = String(availableCount);
      badge.textContent = String(availableCount);
    }
    renderOwnedVouchers(vouchers);
    ownedVouchersLoaded = true;
  }

  function setupProfileActions() {
    const avatarInput = document.getElementById('avatar-input');
    document.getElementById('change-avatar-btn')?.addEventListener('click', () => avatarInput?.click());
    avatarInput?.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      const previewUrl = URL.createObjectURL(file);
      const image = document.createElement('img');
      image.className = 'w-full h-full object-cover';
      image.alt = 'Ảnh đại diện mới đã chọn';
      image.src = previewUrl;
      image.addEventListener('load', () => URL.revokeObjectURL(previewUrl), { once: true });
      document.getElementById('user-avatar')?.replaceChildren(image);
    });
    document.getElementById('reload-order-history')?.addEventListener('click', () => loadCompletedOrders(true));
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
    setupPersonalPanels();
    setupReservationHistory();
    setupProfileActions();
    try {
      await loadAccount();
      await loadOwnedVouchers();
      if (sessionStorage.getItem('fca_profile_update_success') === '1') {
        sessionStorage.removeItem('fca_profile_update_success');
        setMessage(document.getElementById('saveAlert'), 'Thông tin tài khoản đã được cập nhật thành công trên hệ thống FCA!', false);
      }
    } catch (error) {
      if (/xác thực|token/i.test(error.message)) window.location.href = 'login.html';
      else {
        setMessage(document.getElementById('owned-vouchers-status'), error.message, true);
      }
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
