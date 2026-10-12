/* ============================================================
   FCA CULINARY - LOGIN PAGE SCRIPT
   - Toggle password visibility
   - Switch between Login / Register tabs
   ============================================================ */

/**
 * Bật/tắt hiển thị mật khẩu.
 * @param {string} inputId - ID của input password
 * @param {string} iconId  - ID của icon material symbols
 */
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
}

/**
 * Chuyển đổi giữa tab Đăng nhập và Đăng ký.
 * @param {'login'|'register'} type
 */
function switchAuthTab(type) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const fullnameField = document.getElementById('fullname-field');
  const confirmPasswordField = document.getElementById('confirm-password-field');
  const auxiliaryActions = document.getElementById('auxiliary-actions');
  const termsAcceptance = document.getElementById('terms-acceptance');
  const submitText = document.getElementById('submit-text');

  if (type === 'register') {
    tabRegister.className =
      'flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 bg-surface-container-lowest text-on-surface shadow-sm';
    tabLogin.className =
      'flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 text-on-surface-variant hover:text-on-surface';

    fullnameField.classList.remove('hidden');
    confirmPasswordField.classList.remove('hidden');
    auxiliaryActions.classList.add('hidden');
    termsAcceptance.classList.remove('hidden');
    termsAcceptance.classList.add('flex');
    submitText.textContent = 'Đăng ký thành viên FCA';
  } else {
    tabLogin.className =
      'flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 bg-surface-container-lowest text-on-surface shadow-sm';
    tabRegister.className =
      'flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 text-on-surface-variant hover:text-on-surface';

    fullnameField.classList.add('hidden');
    confirmPasswordField.classList.add('hidden');
    auxiliaryActions.classList.remove('hidden');
    termsAcceptance.classList.add('hidden');
    termsAcceptance.classList.remove('flex');
    submitText.textContent = 'Đăng nhập ngay';
  }
}