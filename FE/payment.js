/* FCA CULINARY - PAYMENT PAGE */
(function () {
  'use strict';

  const API_ORIGIN = 'http://localhost:8080';
  const CART_KEY = 'fca_cart';
  const LOCATION_KEY = 'fca_delivery_location';
  const CONTEXT_KEY = 'fca_checkout_context';
  const IDEMPOTENCY_KEY = 'fca_checkout_idempotency';
  const state = { cart: [], account: null, accountError: null, location: null, context: {}, availability: null, submitting: false };
  const $ = (id) => document.getElementById(id);
  const formatVND = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function readStorage(storage, key, fallback) {
    try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; }
    catch (error) { console.warn(`Dữ liệu ${key} không hợp lệ:`, error); return fallback; }
  }

  function authHeaders(json = false) {
    if (window.FCA_SHELL?.authHeaders) return window.FCA_SHELL.authHeaders(json);
    const headers = json ? { 'Content-Type': 'application/json' } : {};
    const token = localStorage.getItem('accessToken');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      ...options, headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    return payload.data ?? payload;
  }

  function setStatus(message, error = false) {
    const element = $('checkout-status');
    if (!element) return;
    element.textContent = message;
    element.classList.remove('hidden', 'bg-error-container', 'text-on-error-container', 'bg-secondary-container', 'text-on-secondary-container');
    element.classList.add(error ? 'bg-error-container' : 'bg-secondary-container');
    element.classList.add(error ? 'text-on-error-container' : 'text-on-secondary-container');
  }

  function commonRestaurantId() {
    const ids = new Set(state.cart.map((item) => String(item.restaurantId ?? item.restaurant?.id ?? '')));
    return ids.size === 1 && !ids.has('') ? Number([...ids][0]) : null;
  }

  const subtotal = () => state.cart.reduce((sum, item) =>
    sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

  function renderDeliveryAddress() {
    const box = $('delivery-address-card');
    if (!box) return;
    if (!state.location?.address) {
      box.innerHTML = '<p class="text-on-surface-variant text-sm italic">Chưa có địa chỉ giao món. Hãy chọn địa chỉ GPS trên header.</p>';
      return;
    }
    box.innerHTML = `<div class="flex flex-col gap-1">
      <strong class="text-on-surface">${escapeHtml(state.location.recipientName || state.account?.username || 'Người nhận')}</strong>
      <span class="text-on-surface">${escapeHtml(state.location.recipientPhone || state.account?.phoneNumber || '')}</span>
      <span class="text-on-surface-variant">${escapeHtml(state.location.address)}</span>
    </div>`;
  }

  function renderSavedAddresses() {
    const container = $('payment-saved-addresses');
    if (!container) return;
    if (state.accountError) {
      container.innerHTML = `<p class="text-sm text-error">${escapeHtml(state.accountError)}</p>`;
      return;
    }
    const choices = [];
    if (state.location?.address) choices.push({ ...state.location, label: 'Địa chỉ đang chọn' });
    if (state.account?.address && state.account.address !== state.location?.address) {
      choices.push({
        source: 'account', label: 'Địa chỉ tài khoản', address: state.account.address,
        recipientName: state.account.username, recipientPhone: state.account.phoneNumber,
        latitude: state.account.latitude ?? null, longitude: state.account.longitude ?? null
      });
    }
    if (!choices.length) {
      container.innerHTML = '<p class="text-sm text-slate-500">Tài khoản chưa có địa chỉ đã lưu.</p>';
      return;
    }
    container.innerHTML = choices.map((choice, index) => `
      <button class="delivery-saved-address" type="button" data-saved-address-index="${index}">
        <strong>${escapeHtml(choice.label)}</strong><small>${escapeHtml(choice.address)}</small>
      </button>`).join('');
    container.onclick = (event) => {
      const button = event.target.closest('[data-saved-address-index]');
      if (!button) return;
      const selected = choices[Number(button.dataset.savedAddressIndex)];
      if (!selected) return;
      state.location = selected;
      localStorage.setItem(LOCATION_KEY, JSON.stringify(selected));
      const headerAddress = $('selected-delivery-address');
      if (headerAddress) headerAddress.textContent = selected.address;
      $('location-menu').hidden = true;
      $('header-location')?.classList.remove('is-open');
      $('location-trigger')?.setAttribute('aria-expanded', 'false');
      renderDeliveryAddress();
      refreshAvailability();
    };
  }

  function renderOrderItems() {
    const container = $('order-items-container');
    const count = state.cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    if ($('order-item-count')) $('order-item-count').textContent = `${count} món`;
    if ($('subtotal-count')) $('subtotal-count').textContent = String(count);
    if (!container) return;
    container.innerHTML = state.cart.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const image = item.image ? `<img class="w-full h-full object-cover" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
        : '<span class="material-symbols-outlined w-full h-full flex items-center justify-center text-outline">restaurant</span>';
      return `<div class="flex items-center gap-space-sm pb-space-sm">
        <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-surface-container">${image}</div>
        <div class="flex-1 min-w-0"><div class="flex justify-between gap-2">
          <strong class="truncate">${escapeHtml(item.name || item.menuItemName || 'Món ăn')}</strong>
          <strong class="shrink-0">${formatVND((Number(item.price) || 0) * quantity)}</strong>
        </div><span class="text-sm text-on-surface-variant">Số lượng: ${quantity}</span></div>
      </div>`;
    }).join('');
  }

  function renderSummary() {
    const shipping = Number(state.availability?.deliveryFee ?? state.context.shipping) || 0;
    const discount = Math.max(0, Number(state.context.discount) || 0);
    const total = Math.max(0, subtotal() + shipping - discount);
    $('subtotal-amount').textContent = formatVND(subtotal());
    $('shipping-fee').textContent = formatVND(shipping);
    $('total-amount').textContent = formatVND(total);
    $('checkout-voucher-label').textContent = state.context.voucherCode || 'Chọn voucher của bạn';
    $('eco-packaging-row')?.classList.toggle('hidden', !$('eco-packaging-toggle')?.checked);
    $('discount-row')?.classList.toggle('hidden', discount <= 0);
    $('discount-row')?.classList.toggle('flex', discount > 0);
    if ($('discount-code-label')) $('discount-code-label').textContent = state.context.voucherCode ? `(${state.context.voucherCode})` : '';
    if ($('discount-amount')) $('discount-amount').textContent = `-${formatVND(discount)}`;
    if ($('savings-label')) {
      $('savings-label').textContent = discount > 0 ? `Tiết kiệm ${formatVND(discount)}` : '';
      $('savings-label').classList.toggle('hidden', discount <= 0);
    }
    const method = document.querySelector('input[name="payment_method"]:checked')?.value || 'COD';
    const label = method === 'VNPAY' ? 'Thanh toán qua VNPay' : 'Xác nhận đặt hàng';
    $('order-submit-btn').innerHTML = `<span class="material-symbols-outlined text-[24px]">verified</span><span>${label} (${formatVND(total)})</span>`;
  }

  function setCodModal(open) {
    const modal = $('cod-confirm-modal');
    if (!modal) return;
    modal.classList.toggle('hidden', !open);
    modal.classList.toggle('flex', open);
  }

  function setCheckoutEnabled(enabled) {
    const button = $('order-submit-btn');
    if (!button || state.submitting) return;
    button.disabled = !state.cart.length;
    button.classList.toggle('opacity-50', button.disabled || !enabled);
    button.classList.toggle('cursor-not-allowed', button.disabled);
  }

  async function refreshAvailability() {
    state.location = readStorage(localStorage, LOCATION_KEY, null);
    renderDeliveryAddress();
    const rawLatitude = state.location?.latitude;
    const rawLongitude = state.location?.longitude;
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    const validCoordinates = rawLatitude !== null && rawLatitude !== undefined && rawLatitude !== ''
      && rawLongitude !== null && rawLongitude !== undefined && rawLongitude !== ''
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
    if (!commonRestaurantId() || !validCoordinates) {
      state.availability = null;
      $('delivery-distance').textContent = 'Chưa có GPS';
      $('delivery-estimate').textContent = '—';
      setCheckoutEnabled(false);
      const reason = !commonRestaurantId()
        ? 'Không xác định được nhà hàng chung của các món trong giỏ.'
        : state.location?.address
          ? 'Địa chỉ đã chọn chỉ có dữ liệu văn bản, chưa có vĩ độ và kinh độ.'
          : 'Chưa chọn địa chỉ giao hàng có tọa độ.';
      if (!state.location?.address || !commonRestaurantId()) {
        setStatus(reason, true);
        renderSummary();
        return;
      }
    }
    try {
      const result = await request('/api/v1/checkout/delivery-availability', {
        method: 'POST', body: JSON.stringify({
          restaurantId: commonRestaurantId(),
          deliveryLatitude: validCoordinates ? latitude : null,
          deliveryLongitude: validCoordinates ? longitude : null,
          deliveryAddress: state.location.address
        })
      });
      state.availability = result;
      const geocodedLatitude = Number(result.deliveryLatitude);
      const geocodedLongitude = Number(result.deliveryLongitude);
      if (Number.isFinite(geocodedLatitude) && Number.isFinite(geocodedLongitude)) {
        state.location.latitude = geocodedLatitude;
        state.location.longitude = geocodedLongitude;
        localStorage.setItem(LOCATION_KEY, JSON.stringify(state.location));
      }
      const distance = Number(result.distanceKm);
      $('delivery-distance').textContent = Number.isFinite(distance) ? `${distance.toFixed(2)} km` : '—';
      $('delivery-estimate').textContent = Number.isFinite(distance) ? `${Math.ceil(distance * 4)} phút` : '—';
      const deliverable = result.deliverable === true && distance < 6;
      setCheckoutEnabled(deliverable);
      if (deliverable) $('checkout-status')?.classList.add('hidden');
      else setStatus('Khoảng cách từ 6 km trở lên, FCA chưa thể giao đơn này.', true);
    } catch (error) {
      state.availability = null;
      $('delivery-distance').textContent = 'Không khả dụng';
      $('delivery-estimate').textContent = '—';
      setCheckoutEnabled(false);
      setStatus(error.message, true);
    }
    renderSummary();
  }

  function getIdempotencyKey() {
    const fingerprint = JSON.stringify(state.cart.map((item) => [item.id, item.quantity]));
    const saved = readStorage(sessionStorage, IDEMPOTENCY_KEY, null);
    if (saved?.fingerprint === fingerprint && saved.key) return saved.key;
    const key = window.crypto?.randomUUID?.() || `checkout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(IDEMPOTENCY_KEY, JSON.stringify({ fingerprint, key }));
    return key;
  }

  async function submitOrder() {
    if (state.submitting) return;
    state.submitting = true;
    if (!state.availability?.deliverable) {
      await refreshAvailability();
      if (!state.availability?.deliverable) {
        state.submitting = false;
        return;
      }
    }
    if (!state.account?.username || !state.account?.phoneNumber) {
      state.submitting = false;
      setStatus('Tài khoản cần có tên và số điện thoại hợp lệ trước khi đặt hàng.', true);
      return;
    }
    const button = $('order-submit-btn');
    button.disabled = true;
    button.textContent = 'Đang tạo đơn hàng...';
    try {
      const result = await request('/api/v1/checkout', {
        method: 'POST', body: JSON.stringify({
          restaurantId: commonRestaurantId(), idempotencyKey: getIdempotencyKey(),
          recipientName: state.location.recipientName || state.account.username,
          recipientPhone: state.location.recipientPhone || state.account.phoneNumber,
          deliveryAddress: state.location.address, deliveryNote: $('shipper-note')?.value.trim() || null,
          paymentMethod: document.querySelector('input[name="payment_method"]:checked')?.value || 'COD',
          locale: 'vn', voucherCode: state.context.voucherCode || null,
          deliveryLatitude: state.location.latitude, deliveryLongitude: state.location.longitude,
          items: state.cart.map((item) => ({ menuItemId: Number(item.id), quantity: Number(item.quantity) || 1 }))
        })
      });
      const createdOrderId = result.order?.id;
      if (createdOrderId) sessionStorage.setItem('fca_last_order_id', String(createdOrderId));
      localStorage.removeItem(CART_KEY);
      sessionStorage.removeItem(CONTEXT_KEY);
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      window.dispatchEvent(new CustomEvent('fca:cart-count', { detail: { count: 0 } }));
      if (result.payment?.paymentUrl) { window.location.assign(result.payment.paymentUrl); return; }
      const waitingVnPay = result.payment?.method === 'VNPAY';
      setStatus(waitingVnPay
        ? 'Đơn hàng đã được tạo và đang chờ nhà hàng xác nhận trước khi mở thanh toán VNPay.'
        : 'Đặt hàng thành công. Đơn COD chưa được ghi nhận thanh toán.');
      button.textContent = `Đã tạo đơn #${result.order?.id ?? ''}`;
      if (!waitingVnPay && createdOrderId) {
        window.location.assign(`order-status.html?orderId=${encodeURIComponent(createdOrderId)}`);
      }
    } catch (error) {
      state.submitting = false;
      setStatus(error.message, true);
      setCheckoutEnabled(true);
      renderSummary();
    }
  }

  function setupInteractions() {
    $('vat-toggle')?.addEventListener('change', (event) => {
      $('vat-fields')?.classList.toggle('hidden', !event.target.checked);
      $('vat-fields')?.classList.toggle('flex', event.target.checked);
    });
    $('eco-packaging-toggle')?.addEventListener('change', renderSummary);
    document.querySelectorAll('input[name="payment_method"]').forEach((radio) => radio.addEventListener('change', renderSummary));
    $('order-submit-btn')?.addEventListener('click', () => {
      const method = document.querySelector('input[name="payment_method"]:checked')?.value || 'COD';
      if (method === 'COD') setCodModal(true);
      else submitOrder();
    });
    $('cancel-cod-confirm')?.addEventListener('click', () => setCodModal(false));
    $('confirm-cod-order')?.addEventListener('click', () => {
      setCodModal(false);
      submitOrder();
    });
    $('change-delivery-address')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      renderSavedAddresses();
      const trigger = $('location-trigger');
      const menu = $('location-menu');
      if (trigger && menu?.hidden) trigger.click();
    });
    const selectedAddress = $('selected-delivery-address');
    if (selectedAddress) new MutationObserver(refreshAvailability).observe(selectedAddress, { childList: true, characterData: true, subtree: true });
  }

  async function init() {
    state.cart = readStorage(localStorage, CART_KEY, []);
    state.context = readStorage(sessionStorage, CONTEXT_KEY, {});
    state.location = readStorage(localStorage, LOCATION_KEY, null);
    setupInteractions();
    renderOrderItems();
    renderSummary();
    if (!state.cart.length) {
      setStatus('Giỏ hàng đang trống. Vui lòng quay lại giỏ hàng để chọn món.', true);
      setCheckoutEnabled(false);
      return;
    }
    try { state.account = await request('/api/v1/auth/me'); }
    catch (error) { state.accountError = error.message; setStatus(error.message, true); }
    renderDeliveryAddress();
    renderSavedAddresses();
    await refreshAvailability();
  }

  window.FCA_PAYMENT = { refreshAvailability, formatVND };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
