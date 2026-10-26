
/* =====================================================
   FCA CULINARY - LOGIN / REGISTER
   Backend: Spring Boot
   API: http://localhost:8080/api/v1/auth
   ===================================================== */

const API_BASE_URL = "http://localhost:8080/api/v1/auth";

let currentAuthMode = "login";

/* =====================================================
   1. COMMON HELPERS
   ===================================================== */

function getElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }

  return null;
}

function getForm() {
  return document.querySelector("form");
}

function getInputValue(...selectors) {
  const input = getElement(...selectors);
  return input ? input.value.trim() : "";
}

function showAuthMessage(message, type = "error") {
  const form = getForm();

  if (!form) {
    alert(message);
    return;
  }

  let messageElement = document.getElementById("auth-message");

  if (!messageElement) {
    messageElement = document.createElement("p");
    messageElement.id = "auth-message";
    messageElement.className = "mt-3 text-center text-sm";
    messageElement.setAttribute("role", "status");
    form.appendChild(messageElement);
  }

  messageElement.textContent = message;
  messageElement.style.whiteSpace = "pre-line";

  // HTML hiện tại có sẵn class hidden.
  // Bỏ hidden để thông báo Backend được hiển thị.
  messageElement.classList.remove(
    "hidden",
    "text-red-600",
    "text-green-600"
  );

  messageElement.classList.add(
    type === "success" ? "text-green-600" : "text-red-600"
  );
}

function clearAuthMessage() {
  document.getElementById("auth-message")?.remove();
}

/* =====================================================
   2. BACKEND VALIDATION MESSAGE

   Chỉ đọc và hiển thị lỗi do Backend trả về.
   Không tự đặt quy tắc validation ở Frontend.
   ===================================================== */

function extractValidationMessage(result) {
  if (!result) return null;

  if (typeof result === "string") {
    return result.trim() || null;
  }

  // Một số Backend trả errors dưới dạng danh sách.
  // Ví dụ:
  // errors: [
  //   { field: "username", defaultMessage: "..." }
  // ]
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    const messages = result.errors
      .map((error) => {
        if (typeof error === "string") {
          return error;
        }

        return (
          error?.defaultMessage ||
          error?.message ||
          error?.reason ||
          null
        );
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return [...new Set(messages)].join("\n");
    }
  }

  // Một số Backend trả lỗi theo tên trường:
  // errors: {
  //   username: "Tên đăng nhập ...",
  //   password: "Mật khẩu ..."
  // }
  if (
    result.errors &&
    typeof result.errors === "object" &&
    !Array.isArray(result.errors)
  ) {
    const messages = Object.values(result.errors)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => {
        if (typeof value === "string") {
          return value;
        }

        return (
          value?.defaultMessage ||
          value?.message ||
          null
        );
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return [...new Set(messages)].join("\n");
    }
  }

  // Một số Backend trả fieldErrors.
  if (
    Array.isArray(result.fieldErrors) &&
    result.fieldErrors.length > 0
  ) {
    const messages = result.fieldErrors
      .map((error) => {
        if (typeof error === "string") {
          return error;
        }

        return (
          error?.defaultMessage ||
          error?.message ||
          null
        );
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return [...new Set(messages)].join("\n");
    }
  }

  // Cấu trúc thông thường của API Spring Boot.
  if (
    typeof result.message === "string" &&
    result.message.trim()
  ) {
    return result.message;
  }

  if (
    typeof result.error === "string" &&
    result.error.trim()
  ) {
    return result.error;
  }

  return null;
}

/* =====================================================
   3. API REQUEST

   Hỗ trợ JSON và FormData.
   Lấy thông báo validation từ Backend.
   ===================================================== */

async function callAuthApi(endpoint, payload) {
  const isFormData = payload instanceof FormData;

  const headers = {
    Accept: "application/json"
  };

  // Không tự đặt Content-Type cho FormData.
  // Trình duyệt cần tự thêm multipart boundary.
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: "POST",
      headers,
      body: isFormData ? payload : JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      "Không thể kết nối Backend. Hãy kiểm tra máy chủ Spring Boot tại cổng 8080 và cấu hình CORS."
    );
  }

  const responseText = await response.text();

  let result = null;

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { message: responseText };
    }
  }

  if (!response.ok) {
    const message =
      extractValidationMessage(result) ||
      `Yêu cầu thất bại: HTTP ${response.status}`;

    throw new Error(message);
  }

  return result;
}

/* =====================================================
   4. PASSWORD VISIBILITY

   Giữ nguyên chức năng hiện / ẩn mật khẩu.
   ===================================================== */

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (!input || !icon) return;

  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "visibility_off";
    icon.setAttribute("aria-label", "Ẩn mật khẩu");
  } else {
    input.type = "password";
    icon.textContent = "visibility";
    icon.setAttribute("aria-label", "Hiện mật khẩu");
  }
}

/* =====================================================
   5. SWITCH LOGIN / REGISTER

   Giữ nguyên logic chuyển tab.
   ===================================================== */

function switchAuthTab(type) {
  currentAuthMode = type === "register" ? "register" : "login";

  const isRegister = currentAuthMode === "register";

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");

  const fullnameField = document.getElementById("fullname-field");

  const registerExtraFields =
    document.getElementById("register-extra-fields");

  const confirmPasswordField =
    document.getElementById("confirm-password-field");

  const auxiliaryActions =
    document.getElementById("auxiliary-actions");

  const termsAcceptance =
    document.getElementById("terms-acceptance");

  const submitText = document.getElementById("submit-text");

  const activeClass =
    "flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 bg-surface-container-lowest text-on-surface shadow-sm";

  const inactiveClass =
    "flex-1 py-2.5 rounded-lg font-label-lg text-label-lg transition-all duration-200 text-on-surface-variant hover:text-on-surface";

  if (tabLogin) {
    tabLogin.className = isRegister ? inactiveClass : activeClass;
    tabLogin.setAttribute("aria-selected", String(!isRegister));
  }

  if (tabRegister) {
    tabRegister.className = isRegister ? activeClass : inactiveClass;
    tabRegister.setAttribute("aria-selected", String(isRegister));
  }

  // Hiện/ẩn tên đăng nhập.
  if (fullnameField) {
    fullnameField.classList.toggle("hidden", !isRegister);
  }

  // Hiện/ẩn các trường đăng ký.
  if (registerExtraFields) {
    registerExtraFields.classList.toggle("hidden", !isRegister);
    registerExtraFields.classList.toggle("flex", isRegister);
  }

  // Hiện/ẩn mật khẩu xác nhận.
  if (confirmPasswordField) {
    confirmPasswordField.classList.toggle("hidden", !isRegister);
  }

  // Ẩn các thao tác dành riêng cho đăng nhập.
  if (auxiliaryActions) {
    auxiliaryActions.classList.toggle("hidden", isRegister);
  }

  // Hiện/ẩn điều khoản đăng ký.
  if (termsAcceptance) {
    termsAcceptance.classList.toggle("hidden", !isRegister);
    termsAcceptance.classList.toggle("flex", isRegister);
  }

  if (submitText) {
    submitText.textContent = isRegister
      ? "Đăng ký thành viên FCA"
      : "Đăng nhập ngay";
  }

  // Giữ nguyên logic ẩn ô điện thoại đăng nhập
  // khi chuyển sang tab đăng ký.
  const loginContactInput = getElement(
    "#login-phone-input",
    "#login-contact-input",
    "#contact-input",
    "#phone-input"
  );

  const registerPhoneInput = document.getElementById(
    "register-phone-input"
  );

  if (loginContactInput && registerPhoneInput) {
    const contactContainer =
      loginContactInput.closest(".form-field") ||
      loginContactInput.closest(".input-group") ||
      loginContactInput.parentElement?.parentElement;

    if (
      contactContainer &&
      !contactContainer.closest("#register-extra-fields") &&
      contactContainer !== fullnameField
    ) {
      contactContainer.classList.toggle("hidden", isRegister);
    }
  }

  const form = getForm();

  if (form) {
    form.reset();
  }

  clearAuthMessage();
}

// Cho phép HTML sử dụng onclick.
window.switchAuthTab = switchAuthTab;
window.togglePasswordVisibility = togglePasswordVisibility;

/* =====================================================
   6. FIND FORM INPUTS

   Giữ nguyên cách tìm input hiện tại.
   ===================================================== */

function getFormElements() {
  const form = getForm();

  if (!form) {
    throw new Error("Không tìm thấy form đăng nhập.");
  }

  const fullnameInput = getElement(
    "#username-input",
    "#fullname-input",
    "#fullname-field input"
  );

  // Ưu tiên ID dành riêng cho ô điện thoại đăng nhập.
  let loginContactInput = getElement(
    "#login-phone-input",
    "#login-contact-input",
    "#contact-input",
    "#phone-input"
  );

  // Tương thích HTML cũ.
  if (
    !loginContactInput ||
    loginContactInput.closest("#register-extra-fields")
  ) {
    const candidates = Array.from(
      form.querySelectorAll(
        "#fullname-field ~ div input, input[name='phoneNumber'], input[type='tel']"
      )
    );

    loginContactInput = candidates.find((input) => {
      return (
        !input.closest("#register-extra-fields") &&
        input.id !== "register-phone-input" &&
        input.id !== "confirm-password-input" &&
        input.id !== "password-input" &&
        input.type !== "password" &&
        !input.disabled
      );
    }) || null;
  }

  const passwordInput = getElement(
    "#password-input",
    "input[name='password']"
  );

  const confirmPasswordInput = getElement(
    "#confirm-password-input",
    "input[name='confirmPassword']"
  );

  const registerPhoneInput = getElement(
    "#register-phone-input",
    "input[name='phoneNumber']"
  );

  const emailInput = getElement(
    "#email-input",
    "input[name='email']"
  );

  const addressInput = getElement(
    "#address-input",
    "textarea[name='address']",
    "input[name='address']"
  );

  const genderInput = getElement(
    "#gender-input",
    "select[name='gender']"
  );

  const avatarInput = getElement(
    "#avatar-input",
    "input[name='avatar'][type='file']"
  );

  const birthDateInput = getElement(
    "#birth-date-input",
    "input[name='dateOfBirth']"
  );

  if (!passwordInput) {
    throw new Error("Không tìm thấy ô mật khẩu.");
  }

  return {
    form,
    fullnameInput,
    loginContactInput,
    passwordInput,
    confirmPasswordInput,
    registerPhoneInput,
    emailInput,
    addressInput,
    genderInput,
    avatarInput,
    birthDateInput
  };
}

/* =====================================================
   7. VALIDATION

   Không kiểm tra cứng username, email, password,
   phoneNumber ở Frontend.

   Các quy tắc này được kiểm tra bởi DTO Backend
   thông qua Jakarta Bean Validation.

   Riêng điều khoản đăng ký vẫn giữ ở Frontend.
   ===================================================== */

/* =====================================================
   8. LOGIN

   Backend: POST /api/v1/auth/login
   Payload: { phoneNumber, password }
   ===================================================== */

async function handleLogin(phoneNumber, password) {
  // Gửi dữ liệu để Backend kiểm tra.
  const result = await callAuthApi("login", {
    phoneNumber,
    password
  });

  const data = result?.data ?? result;

  if (data?.accessToken) {
    localStorage.setItem("accessToken", data.accessToken);
  }

  if (data?.refreshToken) {
    localStorage.setItem("refreshToken", data.refreshToken);
  }

  window.location.href = "Home.html";
  return result;
}

/* =====================================================
   9. REGISTER

   Backend: POST /api/v1/auth/register

   Fields theo RegisterRequest:
   username, password, confirmPassword,
   email, address, gender, phoneNumber,
   dateOfBirth, avatar
   ===================================================== */

async function handleRegister(fields) {
  const {
    fullnameInput,
    passwordInput,
    confirmPasswordInput,
    registerPhoneInput,
    loginContactInput,
    emailInput,
    addressInput,
    genderInput,
    avatarInput,
    birthDateInput
  } = fields;

  const username = fullnameInput?.value.trim() || "";

  const email = emailInput?.value.trim() || "";

  const phoneNumber = (
    registerPhoneInput?.value ||
    loginContactInput?.value ||
    ""
  ).trim();

  const password = passwordInput.value;

  // Lấy xác nhận mật khẩu từ HTML.
  const confirmPassword = confirmPasswordInput?.value || "";

  const address = addressInput?.value.trim() || "";

  // Không kiểm tra cứng các trường trên ở JS.
  // DTO Backend sẽ xử lý validation.

  // Giữ nguyên logic chuyển giới tính sang Boolean.
  const gender = genderInput?.value.trim() || null;


  // Giữ nguyên kiểm tra điều khoản đăng ký.
  const termsCheckbox = document.querySelector(
    "#terms-acceptance input[type='checkbox']"
  );

  if (termsCheckbox && !termsCheckbox.checked) {
    throw new Error("Bạn cần đồng ý với điều khoản để đăng ký.");
  }

  const avatarFile = avatarInput?.files?.[0] || null;

  let result;

  if (avatarFile) {
    // Có ảnh: gửi multipart/form-data.
    const formData = new FormData();

    formData.append("username", username);
    formData.append("password", password);

    // Trường mới trong RegisterRequest.
    formData.append("confirmPassword", confirmPassword);

    formData.append("email", email);
    formData.append("phoneNumber", phoneNumber);

    if (address) {
      formData.append("address", address);
    }

    if (gender !== null) {
      formData.append("gender", gender);
    }

    formData.append("avatar", avatarFile);

    result = await callAuthApi("register", formData);
  } else {
    // Không có ảnh: gửi application/json.
    const payload = {
      username,
      password,

      // Trường mới trong RegisterRequest.
      confirmPassword,

      email,
      phoneNumber,
      address: address || null,
      gender,
      dateOfBirth: birthDateInput?.value || null
    };

    result = await callAuthApi("register", payload);
  }

  showAuthMessage(
    result?.message || "Đăng ký tài khoản thành công!",
    "success"
  );

  return result;
}

/* =====================================================
   10. SUBMIT FORM

   Giữ nguyên logic submit và trạng thái nút.
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {
  const form = getForm();

  const submitButton = document.getElementById("submit-btn");

  if (!form || !submitButton) {
    console.error("Không tìm thấy form hoặc nút gửi.");
    return;
  }

  // Hỗ trợ HTML có onclick trên nút tab và HTML không có.
  document.getElementById("tab-login")?.addEventListener(
    "click",
    function () {
      switchAuthTab("login");
    }
  );

  document.getElementById("tab-register")?.addEventListener(
    "click",
    function () {
      switchAuthTab("register");
    }
  );

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (submitButton.disabled) return;

    clearAuthMessage();

    const submitText = document.getElementById("submit-text");

    const originalText = submitText?.textContent ||
      "Đang xử lý...";

    try {
      const fields = getFormElements();

      submitButton.disabled = true;

      submitButton.classList.add(
        "opacity-60",
        "cursor-not-allowed"
      );

      if (submitText) {
        submitText.textContent = "Đang xử lý...";
      }

      if (currentAuthMode === "login") {
        const phoneNumber =
          fields.loginContactInput?.value.trim() || "";

        await handleLogin(
          phoneNumber,
          fields.passwordInput.value
        );
      } else {
        await handleRegister(fields);
      }
    } catch (error) {
      showAuthMessage(
        error.message || "Đã xảy ra lỗi. Vui lòng thử lại.",
        "error"
      );
    } finally {
      submitButton.disabled = false;

      submitButton.classList.remove(
        "opacity-60",
        "cursor-not-allowed"
      );

      if (submitText) {
        submitText.textContent =
          currentAuthMode === "register"
            ? "Đăng ký thành viên FCA"
            : "Đăng nhập ngay";
      }
    }
  });

  // Mặc định mở tab đăng nhập.
  switchAuthTab("login");
});
