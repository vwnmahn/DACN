(function () {
  'use strict';

  const ACTIVE_CLASSES = ['font-semibold', 'text-emerald-700', 'bg-emerald-50'];
  const API_ORIGIN = 'http://localhost:8080';
  const INACTIVE_CLASSES = ['font-medium', 'text-slate-600', 'hover:text-emerald-700', 'hover:bg-slate-100'];

  function renderSharedShell() {
    const headerHost = document.querySelector('[data-site-header]');
    if (headerHost) {
      headerHost.insertAdjacentHTML('beforebegin', `
        <header class="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
          <div class="fca-layout-container fca-site-header-inner h-20 max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12 flex items-center justify-between gap-4">
            <div class="flex items-center gap-6 flex-shrink-0"><a class="flex items-center gap-3" data-path="trang-chu" href="Home.html"><div class="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg tracking-tight shadow-sm shadow-emerald-600/30">FCA</div><div class="hidden sm:flex flex-col"><span class="text-base text-slate-900 font-bold leading-tight tracking-tight">FCA CULINARY</span><span class="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Food &amp; Delivery</span></div></a><div class="header-location-dropdown hidden md:block" id="header-location"><button type="button" class="location-trigger" id="location-trigger" aria-expanded="false" aria-controls="location-menu"><span class="material-symbols-outlined location-icon">location_on</span><span class="location-trigger-copy"></span><span id="selected-delivery-address">Chọn địa chỉ giao hàng</span></span><span class="material-symbols-outlined location-chevron">expand_more</span></button><div class="location-menu delivery-location-menu" id="location-menu" hidden><button type="button" class="delivery-location-gps" id="use-current-location"><span class="material-symbols-outlined">my_location</span><span>Dùng vị trí hiện tại</span></button><p class="delivery-location-status" id="delivery-location-status" aria-live="polite"></p><div class="delivery-location-divider"><span>hoặc</span></div><label class="delivery-location-field" for="delivery-address-input">Địa chỉ giao hàng</label><input class="delivery-location-input" id="delivery-address-input" type="text" autocomplete="street-address" placeholder="Nhập số nhà, đường, phường/xã, quận/huyện..."><button type="button" class="delivery-location-confirm" id="confirm-delivery-address">Xác nhận địa chỉ</button></div></div></div>
            <div class="flex-1 max-w-xl mx-4 hidden lg:block"><div class="relative flex items-center w-full"><span class="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px]">search</span><input class="w-full h-10 pl-10 pr-4 rounded-full bg-slate-100 border border-transparent focus:border-emerald-500 focus:bg-white text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" placeholder="Tìm kiếm món ngon, ẩm thực nghệ thuật, chi nhánh FCA..." type="text"></div></div>
            <div class="flex items-center gap-4 flex-shrink-0"><nav class="hidden xl:flex items-center gap-1.5 px-1"><a class="site-nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors" data-site-nav="home" href="Home.html">Trang chủ</a><a class="site-nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors" data-site-nav="voucher" href="voucher.html">Voucher</a></nav><div class="flex items-center gap-2"><a class="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center border border-slate-200/70" data-path="gio-hang" id="cart-button" href="cart.html" aria-label="Giỏ hàng"><span class="material-symbols-outlined text-[22px]">shopping_bag</span><span class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold items-center justify-center leading-none hidden" id="cart-count-badge" data-count="0"></span></a><a class="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full hover:bg-slate-100 border border-slate-200/70 transition-colors" data-path="tai-khoan" href="personal_page.html"><div class="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center"><span class="material-symbols-outlined text-[16px]">person</span></div><span class="hidden sm:inline text-xs text-slate-700 font-medium">Tài khoản</span></a></div></div>
          </div>
        </header>`);
      headerHost.remove();
    }
    const footerHost = document.querySelector('[data-site-footer]');
    if (footerHost) {
      footerHost.insertAdjacentHTML('beforebegin', `<footer class="w-full bg-slate-900 text-slate-400 pt-14 pb-8"><div class="fca-layout-container max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12"><div class="lg:col-span-2 flex flex-col gap-4 pr-0 lg:pr-8"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">FCA</div><span class="text-lg text-white font-bold">FCA Culinary Arts</span></div><p class="text-sm leading-relaxed max-w-sm">Hệ thống ẩm thực cao cấp và giao nhận mỹ vị chuẩn nghệ thuật.</p></div><div class="flex flex-col gap-3"><h4 class="text-xs text-white font-bold uppercase tracking-wider">Hệ thống chi nhánh</h4><ul class="flex flex-col gap-2 text-sm"><li>TP. Hồ Chí Minh</li><li>Hà Nội</li><li>Đà Nẵng</li><li>Cần Thơ &amp; Hải Phòng</li></ul></div><div class="flex flex-col gap-3"><h4 class="text-xs text-white font-bold uppercase tracking-wider">Dịch vụ &amp; Nghệ thuật</h4><ul class="flex flex-col gap-2 text-sm"><li><a class="hover:text-emerald-400" href="Home.html">Thực đơn Bếp trưởng FCA</a></li><li><a class="hover:text-emerald-400" href="voucher.html">Ưu đãi FCA</a></li><li>Giao tiệc tận nơi VIP</li></ul></div><div class="flex flex-col gap-3"><h4 class="text-xs text-white font-bold uppercase tracking-wider">Hỗ trợ &amp; Đối tác</h4><ul class="flex flex-col gap-2 text-sm"><li><span class="text-slate-300">Hotline:</span> 1900 8899</li><li><span class="text-slate-300">Email:</span> contact@fca-culinary.vn</li></ul></div></div><div class="pt-6 border-t border-slate-800 flex items-center justify-between gap-4"><p class="text-xs text-slate-500">© 2026 FCA - Food &amp; Culinary Arts System.</p><div class="flex gap-5 text-xs"><a href="#">Điều khoản dịch vụ</a><a href="#">Bảo mật thông tin</a></div></div></div></footer>`);
      footerHost.remove();
    }
  }

  function setupOrderNavigation() {
    document.querySelectorAll('nav [data-site-nav="voucher"]').forEach((voucherLink) => {
      const nav = voucherLink.parentElement;
      if (!nav || nav.querySelector('[data-site-nav="orders"]')) return;
      const orderLink = document.createElement('a');
      orderLink.className = 'site-nav-link px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors';
      orderLink.dataset.siteNav = 'orders';
      orderLink.href = 'order-status.html';
      orderLink.textContent = 'Đơn hàng';
      voucherLink.insertAdjacentElement('afterend', orderLink);
    });
  }

  function syncNavigation() {
    const fileName = window.location.pathname.split('/').pop().toLowerCase();
    const currentPage = !fileName || fileName === 'home.html'
      ? 'home'
      : fileName === 'voucher.html'
        ? 'voucher'
        : fileName === 'order-status.html'
          ? 'orders'
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
    const selectedAddress = document.getElementById('selected-delivery-address');
    const gpsButton = document.getElementById('use-current-location');
    const addressInput = document.getElementById('delivery-address-input');
    const confirmButton = document.getElementById('confirm-delivery-address');
    const status = document.getElementById('delivery-location-status');
    const storageKey = 'fca_delivery_location';
    const geocodeCacheKey = 'fca_reverse_geocode_cache';
    const geocodeRateKey = 'fca_reverse_geocode_last_request';
    const reverseGeocodingUrl = dropdown.dataset.reverseGeocodingUrl ||
      'https://nominatim.openstreetmap.org/reverse';
    let lastReverseRequestAt = 0;

    if (!dropdown || !trigger || !menu) return;

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

    if (selectedAddress && gpsButton && addressInput && confirmButton && status) {
      const setStatus = (message, type = '') => {
        status.textContent = message;
        status.classList.toggle('is-error', type === 'error');
        status.classList.toggle('is-success', type === 'success');
      };

      const saveLocation = (location) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(location));
          return true;
        } catch (error) {
          console.error('Không lưu được địa chỉ giao hàng:', error);
          setStatus('Không thể lưu địa chỉ trên trình duyệt này.', 'error');
          return false;
        }
      };

      const renderLocation = (location) => {
        if (location.source === 'gps') {
          selectedAddress.textContent = location.address ||
            `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          addressInput.value = location.address || '';
        } else {
          selectedAddress.textContent = location.address;
          addressInput.value = location.address;
        }
      };

      const formatGeocodedAddress = (result) => {
        const address = result?.address || {};
        const street = [address.house_number, address.road || address.pedestrian]
          .filter(Boolean).join(' ');
        const ward = address.suburb || address.quarter || address.neighbourhood || address.village;
        const district = address.city_district || address.district || address.county || address.state_district;
        const city = address.city || address.town || address.municipality;
        const province = address.state || address.region;
        return [...new Set([street, ward, district, city, province].filter(Boolean))].join(', ')
          || String(result?.display_name || '').trim();
      };

      const reverseGeocode = async (latitude, longitude) => {
        const coordinateKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
        try {
          const cached = JSON.parse(localStorage.getItem(geocodeCacheKey) || 'null');
          if (cached?.coordinateKey === coordinateKey && cached.address) return cached.address;
        } catch (error) {
          console.warn('Bộ nhớ đệm địa chỉ không hợp lệ:', error);
        }

        try {
          lastReverseRequestAt = Math.max(
            lastReverseRequestAt,
            Number(localStorage.getItem(geocodeRateKey)) || 0
          );
        } catch (error) {
          console.warn('Không đọc được giới hạn tần suất geocoding:', error);
        }
        const waitTime = Math.max(0, 1000 - (Date.now() - lastReverseRequestAt));
        if (waitTime) await new Promise(resolve => setTimeout(resolve, waitTime));
        lastReverseRequestAt = Date.now();
        try {
          localStorage.setItem(geocodeRateKey, String(lastReverseRequestAt));
        } catch (error) {
          console.warn('Không lưu được giới hạn tần suất geocoding:', error);
        }

        const url = new URL(reverseGeocodingUrl);
        url.search = new URLSearchParams({
          format: 'jsonv2',
          lat: String(latitude),
          lon: String(longitude),
          zoom: '18',
          addressdetails: '1',
          'accept-language': 'vi'
        }).toString();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            referrerPolicy: 'strict-origin-when-cross-origin',
            signal: controller.signal
          });
          if (!response.ok) throw new Error(`Reverse geocoding HTTP ${response.status}`);
          const result = await response.json();
          if (result?.error) throw new Error(result.error);
          const address = formatGeocodedAddress(result);
          if (!address) return null;
          try {
            localStorage.setItem(geocodeCacheKey, JSON.stringify({ coordinateKey, address }));
          } catch (error) {
            console.warn('Không lưu được bộ nhớ đệm địa chỉ:', error);
          }
          return address;
        } finally {
          clearTimeout(timeoutId);
        }
      };

      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        const validGps = saved?.source === 'gps' && Number.isFinite(saved.latitude)
          && saved.latitude >= -90 && saved.latitude <= 90
          && Number.isFinite(saved.longitude) && saved.longitude >= -180 && saved.longitude <= 180;
        const validManual = saved?.source === 'manual' && typeof saved.address === 'string'
          && saved.address.trim().length > 0;
        if (validGps || validManual) renderLocation(saved);
      } catch (error) {
        console.warn('Dữ liệu địa chỉ đã lưu không hợp lệ:', error);
      }

      gpsButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
          setStatus('Trình duyệt này không hỗ trợ định vị GPS.', 'error');
          return;
        }

        gpsButton.disabled = true;
        setStatus('Đang lấy vị trí hiện tại...');
        navigator.geolocation.getCurrentPosition(async (position) => {
          const location = {
            source: 'gps',
            address: null,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            savedAt: new Date().toISOString()
          };
          if (saveLocation(location)) {
            renderLocation(location);
            const accuracyText = location.accuracy == null ? '' : ` Độ chính xác khoảng ${Math.round(location.accuracy)} m.`;
            setStatus(`Đã lấy tọa độ GPS.${accuracyText} Đang tìm địa chỉ...`);
            try {
              const address = await reverseGeocode(location.latitude, location.longitude);
              if (address) {
                location.address = address;
                saveLocation(location);
                renderLocation(location);
                setStatus(`Đã xác định địa chỉ từ GPS.${accuracyText}`, 'success');
              } else {
                setStatus(`Đã lưu tọa độ GPS nhưng không tìm thấy địa chỉ tương ứng.${accuracyText}`, 'error');
              }
            } catch (error) {
              console.error('Không thể chuyển tọa độ thành địa chỉ:', error);
              const message = error.name === 'AbortError'
                ? 'Dịch vụ tìm địa chỉ đã hết thời gian chờ.'
                : 'Không thể chuyển tọa độ thành địa chỉ lúc này.';
              setStatus(`${message} Tọa độ GPS vẫn được lưu.`, 'error');
            }
          }
          gpsButton.disabled = false;
        }, (error) => {
          const messages = {
            1: 'Bạn đã từ chối quyền truy cập vị trí.',
            2: 'Không thể xác định vị trí hiện tại.',
            3: 'Yêu cầu định vị đã hết thời gian chờ.'
          };
          setStatus(messages[error.code] || 'Không thể lấy vị trí hiện tại.', 'error');
          gpsButton.disabled = false;
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const confirmManualAddress = () => {
        const address = addressInput.value.trim();
        if (!address) {
          setStatus('Vui lòng nhập địa chỉ giao hàng.', 'error');
          addressInput.focus();
          return;
        }
        const location = {
          source: 'manual',
          address,
          latitude: null,
          longitude: null,
          accuracy: null,
          savedAt: new Date().toISOString()
        };
        if (!saveLocation(location)) return;
        renderLocation(location);
        setStatus('Đã lưu địa chỉ. Địa chỉ này chưa có tọa độ GPS xác thực.', 'success');
        closeMenu();
      };

      confirmButton.addEventListener('click', confirmManualAddress);
      addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          confirmManualAddress();
        }
      });
    } else {
      const selectedCity = document.getElementById('selected-city');
      if (selectedCity) {
        menu.addEventListener('click', (event) => {
          const option = event.target.closest('.location-option');
          if (!option) return;
          menu.querySelector('.location-option.active')?.classList.remove('active');
          option.classList.add('active');
          selectedCity.textContent = option.textContent.trim();
          closeMenu();
        });
      }
    }

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

  renderSharedShell();
  setupOrderNavigation();
  syncNavigation();
  setupLocationDropdown();
  setupCartBadge();
  setupAccountMenu();
  window.FCA_SHELL = window.FCA_SHELL || {};
  window.FCA_SHELL.apiOrigin = API_ORIGIN;
  window.FCA_SHELL.logout = logout;
  window.FCA_SHELL.authHeaders = authHeaders;

  /* ============================================================
     6. ĐỒNG BỘ SỐ LƯỢNG GIỎ HÀNG TRÊN TRANG HOME
     ============================================================ */
  function updateCartBadge() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;

    try {
      const raw = localStorage.getItem('fca_cart');
      const cart = raw ? JSON.parse(raw) : [];

      const count = Array.isArray(cart)
        ? cart.reduce((total, item) => {
            const quantity = Number(item?.quantity);
            return total + (
              Number.isFinite(quantity) && quantity > 0
                ? Math.floor(quantity)
                : 1
            );
          }, 0)
        : 0;

      badge.textContent = count > 99 ? '99+' : String(count);
      badge.dataset.count = String(count);
      badge.classList.toggle('hidden', count === 0);
      badge.classList.toggle('flex', count > 0);
    } catch (error) {
      console.error('[FCA] Không đọc được giỏ hàng:', error);
      badge.textContent = '';
      badge.dataset.count = '0';
      badge.classList.add('hidden');
      badge.classList.remove('flex');
    }
  }

  // Cập nhật khi mở trang hoặc quay lại từ trang giỏ hàng.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }

  window.addEventListener('pageshow', updateCartBadge);

  // Đồng bộ nếu giỏ hàng thay đổi từ tab khác.
  window.addEventListener('storage', (event) => {
    if (event.key === 'fca_cart') {
      updateCartBadge();
    }
  });

  function getCustomerGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ lấy GPS.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            deliveryLatitude: position.coords.latitude,
            deliveryLongitude: position.coords.longitude
          });
        },
        (error) => {
          const messages = {
            1: 'Bạn chưa cấp quyền truy cập vị trí.',
            2: 'Không xác định được vị trí hiện tại.',
            3: 'Lấy GPS quá thời gian cho phép.'
          };

          reject(new Error(
            messages[error.code] || 'Không lấy được GPS.'
          ));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  }

  // Cho phép các script khác cập nhật badge sau khi sửa giỏ hàng.
  window.FCA = window.FCA || {};
  window.FCA.updateCartBadge = updateCartBadge;

})();
