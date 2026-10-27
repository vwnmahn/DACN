
/* ============================================================
   FCA CULINARY - REDEEM PAGE
   Spring Boot API:
   GET  /api/v1/auth/me
   GET  /api/v1/vouchers/redeemable
   POST /api/v1/vouchers/{id}/redeem
   ============================================================ */

(function () {
    'use strict';

    const API_ORIGIN =
        window.FCA_SHELL?.apiOrigin || 'http://localhost:8080';

    const REDEEM_COST = 300;

    const state = {
        points: null,
        vouchers: [],
        loadingVouchers: false,
        loadingAccount: false,
        redeemingIds: new Set(),
        idempotencyKeys: new Map()
    };

    const $ = (id) => document.getElementById(id);

    const elements = {
        points: $('available-points'),
        rank: $('membership-rank'),
        message: $('redeem-page-message'),
        count: $('redeem-result-count'),
        loading: $('redeem-loading'),
        empty: $('redeem-empty'),
        error: $('redeem-error'),
        errorText: $('redeem-error-text'),
        list: $('redeem-voucher-list'),
        refresh: $('refresh-redeem'),
        retryEmpty: $('retry-empty'),
        retryError: $('retry-error')
    };

    function getAccessToken() {
        const shell = window.FCA_SHELL;

        if (shell && typeof shell.getAccessToken === 'function') {
            return shell.getAccessToken();
        }

        return localStorage.getItem('accessToken')
            || localStorage.getItem('access_token')
            || localStorage.getItem('token')
            || '';
    }

    function getAuthHeaders() {
        const headers = {
            Accept: 'application/json'
        };

        const shell = window.FCA_SHELL;

        if (shell && typeof shell.authHeaders === 'function') {
            try {
                return {
                    ...headers,
                    ...shell.authHeaders()
                };
            } catch (error) {
                console.warn('[FCA Redeem] Không lấy được auth headers từ shell:', error);
            }
        } else if (
            shell?.authHeaders &&
            typeof shell.authHeaders === 'object'
        ) {
            Object.assign(headers, shell.authHeaders);
        }

        const token = getAccessToken();

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    async function apiRequest(path, options = {}) {
        const headers = {
            ...getAuthHeaders(),
            ...(options.headers || {})
        };

        if (options.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_ORIGIN}${path}`, {
            ...options,
            headers
        });

        const rawText = await response.text();
        let body = null;

        if (rawText) {
            try {
                body = JSON.parse(rawText);
            } catch {
                body = rawText;
            }
        }

        if (!response.ok) {
            const message =
                body && typeof body === 'object'
                    ? body.message || body.error || body.detail
                    : '';

            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    message || 'Bạn cần đăng nhập hoặc phiên đăng nhập đã hết hạn.'
                );
            }

            throw new Error(
                message || `Yêu cầu thất bại (HTTP ${response.status}).`
            );
        }

        if (
            body &&
            typeof body === 'object' &&
            typeof body.code === 'number' &&
            body.code !== 1000
        ) {
            throw new Error(body.message || 'Máy chủ không xử lý được yêu cầu.');
        }

        return body;
    }

    function unwrap(value) {
        let result = value;

        for (let i = 0; i < 4; i += 1) {
            if (!result || typeof result !== 'object' || Array.isArray(result)) {
                break;
            }

            if (Object.prototype.hasOwnProperty.call(result, 'data')) {
                result = result.data;
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(result, 'result')) {
                result = result.result;
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(result, 'payload')) {
                result = result.payload;
                continue;
            }

            break;
        }

        return result;
    }

    function formatNumber(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return '—';
        }

        return new Intl.NumberFormat('vi-VN').format(number);
    }

    function showMessage(message, type = 'info') {
        if (!elements.message) return;

        elements.message.textContent = message;
        elements.message.hidden = false;
        elements.message.classList.toggle('is-error', type === 'error');
        elements.message.classList.toggle('is-success', type === 'success');
    }

    function clearMessage() {
        if (!elements.message) return;

        elements.message.textContent = '';
        elements.message.hidden = true;
        elements.message.classList.remove('is-error', 'is-success');
    }

    function setVoucherState({ loading = false, empty = false, error = false } = {}) {
        if (elements.loading) elements.loading.hidden = !loading;
        if (elements.empty) elements.empty.hidden = !empty;
        if (elements.error) elements.error.hidden = !error;
        if (elements.list) elements.list.hidden = loading || empty || error;
    }

    function getAccountData(payload) {
        const account = unwrap(payload);

        if (!account || typeof account !== 'object') {
            throw new Error('API tài khoản không trả về dữ liệu hợp lệ.');
        }

        return account;
    }

    async function loadAccount() {
        if (state.loadingAccount) return;

        state.loadingAccount = true;

        if (elements.points) {
            elements.points.textContent = 'Đang tải…';
        }

        if (elements.rank) {
            elements.rank.textContent = 'Đang tải thông tin thành viên…';
        }

        try {
            const response = await apiRequest('/api/v1/auth/me');
            const account = getAccountData(response);

            const pointsValue =
                account.availablePoints ??
                account.available_points;

            if (pointsValue === null || pointsValue === undefined ||
                !Number.isFinite(Number(pointsValue))) {
                throw new Error(
                    'Không tìm thấy trường availablePoints trong dữ liệu tài khoản.'
                );
            }

            state.points = Number(pointsValue);

            if (elements.points) {
                elements.points.textContent = formatNumber(state.points);
            }

            if (elements.rank) {
                elements.rank.textContent =
                    account.membershipRank ||
                    account.rank ||
                    'Thành viên FCA Culinary';
            }

            if (state.vouchers.length > 0) {
                renderVouchers(state.vouchers);
            }
        } catch (error) {
            console.error('[FCA Redeem] Lỗi tải tài khoản:', error);

            if (elements.points) {
                elements.points.textContent = '—';
            }

            if (elements.rank) {
                elements.rank.textContent = error.message;
            }

            showMessage(error.message, 'error');
        } finally {
            state.loadingAccount = false;
        }
    }

    function getVoucherArray(payload) {
        const data = unwrap(payload);

        if (Array.isArray(data)) {
            return data;
        }

        if (!data || typeof data !== 'object') {
            throw new Error('API voucher không trả về danh sách hợp lệ.');
        }

        const candidates = [
            data.content,
            data.items,
            data.vouchers,
            data.records
        ];

        const array = candidates.find(Array.isArray);

        if (array) {
            return array;
        }

        throw new Error('Không tìm thấy danh sách voucher trong phản hồi API.');
    }

    function getVoucherId(voucher) {
        return voucher.id ?? voucher.voucherId ?? voucher.voucher_id ?? null;
    }

    function getVoucherName(voucher) {
        return voucher.name ||
            voucher.voucherName ||
            voucher.title ||
            voucher.code ||
            'Voucher FCA Culinary';
    }

    function getVoucherDescription(voucher) {
        return voucher.description ||
            voucher.content ||
            voucher.terms ||
            'Xem điều kiện áp dụng khi đổi voucher.';
    }

    function getVoucherCode(voucher) {
        return voucher.code || voucher.voucherCode || '';
    }

    function getDiscountText(voucher) {
        if (voucher.discountText) return voucher.discountText;
        if (voucher.discountDescription) return voucher.discountDescription;

        const value = voucher.discountValue ?? voucher.discountAmount;
        const type = String(voucher.discountType || '').toUpperCase();

        if (value !== null && value !== undefined) {
            if (type.includes('PERCENT')) return `Giảm ${value}%`;
            if (type.includes('FIXED') || type.includes('AMOUNT')) {
                return `Giảm ${formatNumber(value)}đ`;
            }
        }

        return 'Ưu đãi thành viên';
    }

    function formatCurrency(value) {
        const number = Number(value);
        return Number.isFinite(number)
            ? `${new Intl.NumberFormat('vi-VN').format(number)}đ`
            : '—';
    }

    function formatDate(value) {
        if (!value) return '—';

        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? String(value)
            : new Intl.DateTimeFormat('vi-VN').format(date);
    }

    function getCustomerStatus(voucher) {
        return String(
            voucher.customerStatus ?? voucher.customer_status ?? ''
        ).trim().toUpperCase();
    }

    function getStatusView(voucher) {
        const status = getCustomerStatus(voucher);

        if (status === 'AVAILABLE' || status === 'USED') {
            return { label: 'Đã đổi', button: 'Đã đổi', redeemable: false, redeemed: true };
        }

        if (status === 'UNOWNED') {
            return { label: 'Có thể đổi', button: 'Đổi voucher', redeemable: true, redeemed: false };
        }

        if (status === 'UNAVAILABLE') {
            return { label: 'Không khả dụng', button: 'Không khả dụng', redeemable: false, redeemed: false };
        }

        return { label: 'Chưa xác định', button: 'Không thể đổi', redeemable: false, redeemed: false };
    }

    function createIdempotencyKey() {
        if (typeof window.crypto?.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        if (!window.crypto?.getRandomValues) {
            throw new Error('Trình duyệt không hỗ trợ tạo khóa an toàn cho yêu cầu đổi voucher.');
        }

        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function appendText(parent, tagName, className, text) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        element.textContent = text;
        parent.appendChild(element);

        return element;
    }

    function renderVouchers(vouchers) {
        if (!elements.list) return;

        elements.list.replaceChildren();

        if (elements.count) {
            elements.count.textContent = `${vouchers.length} voucher`;
        }

        if (vouchers.length === 0) {
            setVoucherState({ empty: true });
            return;
        }

        vouchers.forEach((voucher) => {
            const id = getVoucherId(voucher);
            const statusView = getStatusView(voucher);
            const card = document.createElement('article');
            card.className = `redeem-voucher-card${statusView.redeemed ? ' is-redeemed' : ''}`;

            const top = document.createElement('div');
            top.className = 'redeem-voucher-top';

            const icon = document.createElement('span');
            icon.className = 'redeem-voucher-icon';
            icon.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">confirmation_number</span>';
            top.appendChild(icon);

            appendText(
                top,
                'span',
                `redeem-voucher-tag${statusView.redeemed ? ' is-redeemed' : ''}`,
                statusView.label
            );
            card.appendChild(top);

            const heading = appendText(
                card,
                'h3',
                'redeem-voucher-title',
                getVoucherName(voucher)
            );

            heading.setAttribute('title', getVoucherName(voucher));

            appendText(
                card,
                'p',
                'redeem-voucher-description',
                getVoucherDescription(voucher)
            );

            const meta = document.createElement('div');
            meta.className = 'redeem-voucher-meta';

            const appendMeta = (label, value) => {
                const row = document.createElement('div');
                row.className = 'redeem-voucher-meta-row';
                appendText(row, 'span', '', label);
                appendText(row, 'span', '', value);
                meta.appendChild(row);
            };

            appendMeta('Mã voucher', getVoucherCode(voucher) || '—');
            appendMeta('Mức giảm', getDiscountText(voucher));
            appendMeta('Đơn tối thiểu', formatCurrency(voucher.minOrderAmount));
            appendMeta('Hạn sử dụng', formatDate(voucher.endDate));
            card.appendChild(meta);

            const footer = document.createElement('div');
            footer.className = 'redeem-voucher-footer';
            const costBlock = document.createElement('div');
            costBlock.className = 'redeem-voucher-cost';
            appendText(costBlock, 'span', '', 'Chi phí đổi');
            appendText(costBlock, 'strong', '', `${formatNumber(REDEEM_COST)} điểm`);
            footer.appendChild(costBlock);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'redeem-button';

            const isRedeeming = state.redeemingIds.has(String(id));
            const hasValidId = id !== null && id !== undefined;
            const hasEnoughPoints =
                state.points !== null && state.points >= REDEEM_COST;

            button.disabled =
                !hasValidId ||
                isRedeeming ||
                !statusView.redeemable ||
                state.points === null ||
                !hasEnoughPoints;

            button.textContent = isRedeeming
                ? 'Đang xử lý…'
                : !statusView.redeemable
                    ? statusView.button
                    : state.points === null
                        ? 'Không tải được điểm'
                        : !hasEnoughPoints
                            ? 'Không đủ điểm'
                            : 'Đổi voucher';

            button.addEventListener('click', () => {
                redeemVoucher(voucher, button);
            });

            footer.appendChild(button);
            card.appendChild(footer);
            elements.list.appendChild(card);
        });

        setVoucherState();
    }

    async function loadVouchers() {
        if (state.loadingVouchers) return;

        state.loadingVouchers = true;
        setVoucherState({ loading: true });

        if (elements.count) {
            elements.count.textContent = 'Đang tải…';
        }

        try {
            const response = await apiRequest('/api/v1/vouchers?size=100');
            state.vouchers = getVoucherArray(response);
            renderVouchers(state.vouchers);
        } catch (error) {
            console.error('[FCA Redeem] Lỗi tải voucher:', error);

            setVoucherState({ error: true });

            if (elements.errorText) {
                elements.errorText.textContent = error.message;
            }

            if (elements.count) {
                elements.count.textContent = '— voucher';
            }
        } finally {
            state.loadingVouchers = false;
        }
    }

    async function redeemVoucher(voucher, button) {
        const id = getVoucherId(voucher);

        if (id === null || id === undefined) {
            showMessage('Voucher không có ID hợp lệ nên không thể gửi yêu cầu đổi.', 'error');
            return;
        }

        if (state.redeemingIds.has(String(id))) {
            return;
        }

        if (state.points === null) {
            showMessage('Chưa tải được điểm khả dụng. Vui lòng làm mới thông tin tài khoản.', 'error');
            return;
        }

        const statusView = getStatusView(voucher);

        if (!statusView.redeemable) {
            showMessage(
                statusView.redeemed
                    ? 'Voucher này đã được đổi.'
                    : 'Voucher này hiện không đủ điều kiện đổi.',
                'error'
            );
            return;
        }

        if (state.points < REDEEM_COST) {
            showMessage('Bạn không đủ điểm khả dụng để đổi voucher này.', 'error');
            return;
        }

        const confirmed = window.confirm(
            `Bạn muốn đổi "${getVoucherName(voucher)}" với ${formatNumber(REDEEM_COST)} điểm?`
        );

        if (!confirmed) return;

        state.redeemingIds.add(String(id));

        if (button) {
            button.disabled = true;
            button.textContent = 'Đang xử lý…';
        }

        clearMessage();

        try {
            const key = state.idempotencyKeys.get(String(id)) || createIdempotencyKey();
            state.idempotencyKeys.set(String(id), key);

            const response = await apiRequest(
                `/api/v1/vouchers/${encodeURIComponent(id)}/redeem`,
                {
                    method: 'POST',
                    headers: { 'Idempotency-Key': key }
                }
            );

            const successMessage =
                response && typeof response === 'object' && response.message
                    ? response.message
                    : 'Đổi voucher thành công.';

            state.idempotencyKeys.delete(String(id));
            showMessage(successMessage, 'success');

            // Đọc lại số điểm và danh sách từ backend, không tự trừ điểm ở frontend.
            await Promise.all([
                loadAccount(),
                loadVouchers()
            ]);
        } catch (error) {
            console.error('[FCA Redeem] Lỗi đổi voucher:', error);
            showMessage(error.message || 'Không đổi được voucher. Vui lòng thử lại.', 'error');
        } finally {
            state.redeemingIds.delete(String(id));

            if (state.vouchers.length > 0) {
                renderVouchers(state.vouchers);
            } else if (button) {
                button.disabled = false;
                button.textContent = 'Đổi voucher';
            }
        }
    }

    async function refreshPageData() {
        clearMessage();

        await Promise.all([
            loadAccount(),
            loadVouchers()
        ]);
    }

    function bindEvents() {
        elements.refresh?.addEventListener('click', refreshPageData);
        elements.retryEmpty?.addEventListener('click', refreshPageData);
        elements.retryError?.addEventListener('click', refreshPageData);
    }

    function init() {
        bindEvents();
        refreshPageData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
