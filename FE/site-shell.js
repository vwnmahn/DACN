(function () {
  'use strict';

  const ACTIVE_CLASSES = ['font-semibold', 'text-emerald-700', 'bg-emerald-50'];
  const API_ORIGIN = 'http://localhost:8080';
  const INACTIVE_CLASSES = ['font-medium', 'text-slate-600', 'hover:text-emerald-700', 'hover:bg-slate-100'];

  function syncNavigation() {
    const fileName = window.location.pathname.split('/').pop().toLowerCase();
    const currentPage = !fileName || fileName === 'home.html'
      ? 'home'
      : fileName === 'voucher.html'
        ? 'voucher'
        : null;

    document.querySelectorAll('[data-site-nav]').forEach((link) => {
      const isActive = link.dataset.siteNav === currentPage;
      link.classList.remove(...(isActive ? INACTIVE_CLASSES : ACTIVE_CLASSES));
      link.classList.add(...(isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES));

      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const accountLink = document.querySelector('[data-path="tai-khoan"]');
    if (accountLink) {
      const isAccountPage = fileName === 'personal_page.html';
      accountLink.classList.toggle('is-active', isAccountPage);

      if (isAccountPage) {
        accountLink.setAttribute('aria-current', 'page');
      } else {
        accountLink.removeAttribute('aria-current');
      }
    }

    const cartLink = document.querySelector('[data-path="gio-hang"]');
    if (cartLink) {
      const isCartPage = fileName === 'cart.html';
      cartLink.classList.toggle('is-active', isCartPage);

      if (isCartPage) {
        cartLink.setAttribute('aria-current', 'page');
      } else {
        cartLink.removeAttribute('aria-current');
      }
    }
  }

  function setupLocationDropdown() {
    const dropdown = document.getElementById('header-location');
    const trigger = document.getElementById('location-trigger');
    const menu = document.getElementById('location-menu');
    const selectedCity = document.getElementById('selected-city');

    if (!dropdown || !trigger || !menu || !selectedCity) return;

    const closeMenu = () => {
      menu.hidden = true;
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    };

    trigger.addEventListener('click', () => {
      const shouldOpen = menu.hidden;
      menu.hidden = !shouldOpen;
      dropdown.classList.toggle('is-open', shouldOpen);
      trigger.setAttribute('aria-expanded', String(shouldOpen));
    });

    menu.addEventListener('click', (event) => {
      const option = event.target.closest('.location-option');
      if (!option) return;

      menu.querySelector('.location-option.active')?.classList.remove('active');
      option.classList.add('active');
      selectedCity.textContent = option.textContent.trim();
      closeMenu();
    });

    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  function setupCartBadge() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;

    const renderCount = (value) => {
      const count = Math.max(0, Number.parseInt(value, 10) || 0);
      if (badge.dataset.count !== String(count)) {
        badge.dataset.count = String(count);
      }
      badge.textContent = count > 0 ? String(count) : '';
      badge.classList.toggle('hidden', count === 0);
      badge.classList.toggle('flex', count > 0);
    };

    renderCount(badge.dataset.count);

    new MutationObserver(() => renderCount(badge.dataset.count)).observe(badge, {
      attributes: true,
      attributeFilter: ['data-count'],
    });

    window.addEventListener('fca:cart-count', (event) => {
      renderCount(event.detail?.count);
    });

    window.FCA_SHELL = window.FCA_SHELL || {};
    window.FCA_SHELL.setCartCount = renderCount;
  }

  function authHeaders(json) {
    const headers = json ? { 'Content-Type': 'application/json' } : {};
    const token = localStorage.getItem('accessToken');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      window.location.replace('login.html');
      return;
    }
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/logout`, {
      method: 'DELETE', headers: authHeaders(true), body: JSON.stringify({ refreshToken }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Không thể đăng xuất. Vui lòng thử lại.');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.replace('login.html');
  }

  function setupAccountMenu() {
    const accountLink = document.querySelector('header [data-path="tai-khoan"]');
    if (!accountLink || accountLink.closest('.account-menu-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'account-menu-wrap';
    accountLink.parentNode.insertBefore(wrap, accountLink);
    wrap.appendChild(accountLink);
    accountLink.setAttribute('aria-haspopup', 'menu');
    accountLink.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.innerHTML = '<a class="account-menu-item" role="menuitem" href="personal_page.html"><span class="material-symbols-outlined">person</span><span>Thông tin</span></a><button class="account-menu-item" role="menuitem" type="button" data-account-logout><span class="material-symbols-outlined">logout</span><span>Đăng xuất</span></button>';
    wrap.appendChild(menu);

    const close = () => { menu.hidden = true; accountLink.setAttribute('aria-expanded', 'false'); };
    accountLink.addEventListener('click', (event) => {
      event.preventDefault();
      menu.hidden = !menu.hidden;
      accountLink.setAttribute('aria-expanded', String(!menu.hidden));
    });
    menu.querySelector('[data-account-logout]').addEventListener('click', async () => {
      try { await logout(); } catch (error) { window.alert(error.message); }
    });
    document.addEventListener('click', (event) => { if (!wrap.contains(event.target)) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  }

  syncNavigation();
  setupLocationDropdown();
  setupCartBadge();
  setupAccountMenu();
  window.FCA_SHELL = window.FCA_SHELL || {};
  window.FCA_SHELL.logout = logout;
  window.FCA_SHELL.authHeaders = authHeaders;
})();
