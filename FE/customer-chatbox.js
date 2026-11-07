(function () {
  'use strict';

  if (window.FCA_CUSTOMER_CHATBOX?.initialized) return;

  const REQUEST_TIMEOUT_MS = 125000;

  async function requestHistory(retry = true) {
    const shell = window.FCA_SHELL;
    const response = await fetch(`${shell?.apiOrigin || 'http://localhost:8080'}/api/v1/chatbot/history`, {
      headers: {
        Accept: 'application/json',
        ...(shell?.authHeaders?.() || {})
      }
    });
    if (response.status === 401 && retry && shell?.refreshAccessToken
        && localStorage.getItem('userRefreshToken')) {
      await shell.refreshAccessToken();
      return requestHistory(false);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload?.code !== undefined && payload.code !== 1000)) {
      throw new Error(payload?.message || 'Không thể tải lịch sử trò chuyện.');
    }
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  const normalizeIntentText = value => value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const needsLocation = message => {
    const normalized = normalizeIntentText(message);
    const locationPhrase = ['gan toi', 'gan day', 'gan nhat', 'gan minh', 'vi tri hien tai', 'quanh day']
      .some(phrase => normalized.includes(phrase));
    const branchPhrase = ['chi nhanh', 'nha hang', 'cua hang', 'quan', 'tim', 'o dau']
      .some(phrase => normalized.includes(phrase));
    return locationPhrase && branchPhrase;
  };

  function currentPosition() {
    if (!navigator.geolocation) {
      return Promise.reject(new Error('Thiết bị không hỗ trợ định vị. Bạn có thể nhập khu vực hoặc địa chỉ.'));
    }
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }),
      error => {
        const messages = {
          1: 'Bạn đã từ chối quyền vị trí. Vui lòng cấp quyền hoặc nhập khu vực/địa chỉ.',
          2: 'Không thể xác định vị trí hiện tại. Vui lòng nhập khu vực hoặc địa chỉ.',
          3: 'Quá thời gian xác định vị trí. Vui lòng thử lại hoặc nhập khu vực.'
        };
        reject(new Error(messages[error.code] || 'Không thể xác định vị trí hiện tại.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    ));
  }

  async function requestChat(message, coordinates = null, retry = true) {
    const shell = window.FCA_SHELL;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(`${shell?.apiOrigin || 'http://localhost:8080'}/api/v1/chatbot`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(shell?.authHeaders?.(true) || { 'Content-Type': 'application/json' })
        },
        body: JSON.stringify({ message, ...(coordinates || {}) }),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Trợ lý phản hồi quá lâu. Vui lòng thử lại sau.');
      }
      throw new Error('Không thể kết nối đến trợ lý FCA Culinary.');
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (response.status === 401 && retry && shell?.refreshAccessToken
        && localStorage.getItem('userRefreshToken')) {
      try {
        await shell.refreshAccessToken();
        return requestChat(message, coordinates, false);
      } catch {
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      }
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload?.code !== undefined && payload.code !== 1000)) {
      if (response.status === 401) {
        throw new Error('Bạn cần đăng nhập để sử dụng trợ lý FCA Culinary.');
      }
      if (response.status === 403) {
        throw new Error('Tài khoản hiện tại không có quyền sử dụng chức năng này.');
      }
      throw new Error(payload?.message || `Trợ lý đang tạm gián đoạn (HTTP ${response.status}).`);
    }

    const answer = payload?.data?.answer;
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new Error('Trợ lý chưa trả về nội dung hợp lệ. Vui lòng thử lại.');
    }
    return answer.trim();
  }

  function createChatbox() {
    if (document.getElementById('fca-customer-chat')) return;

    const root = document.createElement('aside');
    root.id = 'fca-customer-chat';
    root.className = 'fca-customer-chat';
    root.setAttribute('aria-label', 'Hỗ trợ khách hàng FCA Culinary');
    root.innerHTML = `
      <section class="fca-chat-window" id="fca-chat-window" role="dialog"
               aria-modal="false" aria-labelledby="fca-chat-title" hidden>
        <header class="fca-chat-header">
          <span class="fca-chat-brand" aria-hidden="true">FCA</span>
          <div class="fca-chat-heading">
            <h2 id="fca-chat-title">Trợ lý FCA Culinary</h2>
            <p>Hỗ trợ khách hàng trực tuyến</p>
          </div>
          <button class="fca-chat-close" type="button" aria-label="Đóng cửa sổ chat">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.4 4.29 19.7 2.88 18.3 9.17 12 2.88 5.7 4.29 4.3l6.3 6.29 6.29-6.3 1.42 1.42Z"/></svg>
          </button>
        </header>
        <div class="fca-chat-messages" id="fca-chat-messages" aria-live="polite">
          <div class="fca-chat-message fca-chat-message--support">
            Xin chào! FCA Culinary có thể hỗ trợ bạn về nội dung nào?
          </div>
        </div>
        <form class="fca-chat-composer">
          <textarea class="fca-chat-input" rows="1" maxlength="2000"
                    autocomplete="off" aria-label="Nội dung tin nhắn"
                    placeholder="Nhập nội dung cần hỗ trợ..."></textarea>
          <button class="fca-chat-send" type="submit" aria-label="Gửi tin nhắn" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2.01 21 20.99-9L2.01 3 2 10l15 2-15 2 .01 7Z"/></svg>
          </button>
        </form>
      </section>
      <button class="fca-chat-launcher" type="button" aria-label="Mở hỗ trợ khách hàng"
              aria-controls="fca-chat-window" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 11H6v-2h12v2Zm0-3H6V8h12v2Zm0-3H6V5h12v2Z"/></svg>
      </button>`;

    document.body.appendChild(root);

    const panel = root.querySelector('.fca-chat-window');
    const launcher = root.querySelector('.fca-chat-launcher');
    const closeButton = root.querySelector('.fca-chat-close');
    const form = root.querySelector('.fca-chat-composer');
    const input = root.querySelector('.fca-chat-input');
    const sendButton = root.querySelector('.fca-chat-send');
    const messages = root.querySelector('.fca-chat-messages');
    let processing = false;
    let historyLoaded = false;

    const scrollToLatest = () => {
      window.requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    };

    const setOpen = open => {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      launcher.setAttribute('aria-label', open ? 'Đóng hỗ trợ khách hàng' : 'Mở hỗ trợ khách hàng');
      if (open) {
        loadHistory();
        scrollToLatest();
        input.focus();
      } else {
        launcher.focus();
      }
    };

    const addMessage = (text, type, extraClass = '') => {
      const bubble = document.createElement('div');
      bubble.className = `fca-chat-message fca-chat-message--${type} ${extraClass}`.trim();
      bubble.textContent = text;
      messages.appendChild(bubble);
      scrollToLatest();
      return bubble;
    };

    const loadHistory = async () => {
      if (historyLoaded || !localStorage.getItem('userAccessToken')) return;
      historyLoaded = true;
      const loading = addMessage('Đang tải lịch sử trò chuyện...', 'support', 'fca-chat-message--loading');
      try {
        const history = await requestHistory();
        loading.remove();
        if (history.length) {
          messages.replaceChildren();
          history.forEach(item => addMessage(
            item.content,
            item.role === 'user' ? 'customer' : 'support'
          ));
        }
      } catch (error) {
        loading.textContent = error.message || 'Không thể tải lịch sử trò chuyện.';
        loading.classList.remove('fca-chat-message--loading');
        loading.classList.add('fca-chat-message--error');
      }
    };

    launcher.addEventListener('click', () => setOpen(panel.hidden));
    closeButton.addEventListener('click', () => setOpen(false));
    input.addEventListener('input', () => {
      sendButton.disabled = processing || input.value.trim().length === 0;
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!processing && input.value.trim()) form.requestSubmit();
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || processing) return;

      processing = true;
      addMessage(text, 'customer');
      input.value = '';
      sendButton.disabled = true;
      input.disabled = true;
      const loadingBubble = addMessage('Trợ lý FCA đang xử lý...', 'support', 'fca-chat-message--loading');

      try {
        let coordinates = null;
        if (needsLocation(text)) {
          loadingBubble.textContent = 'Đang xác định vị trí của bạn...';
          coordinates = await currentPosition();
          loadingBubble.textContent = 'Đã xác định vị trí. Trợ lý FCA đang xử lý...';
        }
        loadingBubble.textContent = await requestChat(text, coordinates);
        loadingBubble.classList.remove('fca-chat-message--loading');
      } catch (error) {
        loadingBubble.textContent = error.message || 'Không thể nhận phản hồi từ trợ lý.';
        loadingBubble.classList.remove('fca-chat-message--loading');
        loadingBubble.classList.add('fca-chat-message--error');
      } finally {
        processing = false;
        input.disabled = false;
        sendButton.disabled = true;
        scrollToLatest();
        input.focus();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });
  }

  window.FCA_CUSTOMER_CHATBOX = { initialized: true, create: createChatbox };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createChatbox, { once: true });
  } else {
    createChatbox();
  }
})();
