"use strict";

const API_BASE = "http://localhost:8080/api/v1";
const state = { fromDate: "", toDate: "", restaurantId: "", loading: false, chart: null };
const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("vi-VN");

function formatMoney(value) { return Number.isFinite(Number(value)) ? money.format(Number(value)) : "—"; }
function formatNumber(value) { return Number.isFinite(Number(value)) ? number.format(Number(value)) : "—"; }
function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}
function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value == null ? "" : String(value);
    return node.innerHTML;
}
function showMessage(message, type = "info") {
    const element = $("page-message");
    element.textContent = message;
    element.className = `message${type === "info" ? "" : ` ${type}`}`;
}
function hideMessage() { $("page-message").className = "message hidden"; }
function setLoading(loading) {
    state.loading = loading;
    ["apply-date-btn", "reset-date-btn", "branch-filter"].forEach(id => {
        if ($(id)) $(id).disabled = loading;
    });
}
function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function setDefaultDates() {
    const today = new Date();
    state.fromDate = localDate(new Date(today.getFullYear(), today.getMonth(), 1));
    state.toDate = localDate(today);
    $("date-from").value = state.fromDate;
    $("date-to").value = state.toDate;
}
function initializeDates() {
    const today = localDate();
    $("date-from").max = today;
    $("date-to").max = today;
    setDefaultDates();
    $("date-from").addEventListener("change", () => { $("date-to").min = $("date-from").value || ""; });
    $("date-to").addEventListener("change", () => { $("date-from").max = $("date-to").value || today; });
}
function validRange(from, to) {
    if (!from || !to) { showMessage("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.", "error"); return false; }
    if (from > to) { showMessage("Ngày bắt đầu không được lớn hơn ngày kết thúc.", "error"); return false; }
    return true;
}
async function api(path) {
    const token = localStorage.getItem("adminAccessToken");
    if (!token) throw new Error("Không tìm thấy access token. Vui lòng đăng nhập lại.");
    const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
    const text = await response.text();
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch { body = text; } }
    if (!response.ok) throw new Error((body && typeof body === "object" && body.message) || `Yêu cầu thất bại (HTTP ${response.status}).`);
    if (body && typeof body.code === "number" && body.code !== 1000) throw new Error(body.message || "Backend không xử lý được yêu cầu.");
    return body?.data ?? body;
}
function clearDashboard() {
    $("total-revenue").textContent = "—";
    $("total-orders").textContent = "—";
    $("revenue-growth").textContent = "Đang tải dữ liệu";
    $("order-average").textContent = "Đang tải dữ liệu";
    $("branch-list").innerHTML = '<div class="empty-state">Đang tải dữ liệu...</div>';
    $("transaction-table").innerHTML = '<tr><td colspan="7" class="empty-state">Đang tải dữ liệu...</td></tr>';
    $("revenue-chart-empty").classList.remove("hidden");
    if (state.chart) { state.chart.destroy(); state.chart = null; }
}
function renderSummary(data) {
    $("total-revenue").textContent = formatMoney(data.totalRevenue);
    $("total-orders").textContent = formatNumber(data.totalOrders);
    $("revenue-growth").textContent = "Thanh toán thành công trong khoảng đã chọn";
    $("order-average").textContent = `Giá trị trung bình: ${formatMoney(data.averageOrderValue)}`;
}
function renderChart(points) {
    const hasData = Array.isArray(points) && points.some(item => Number(item.revenue) > 0);
    $("revenue-chart-empty").classList.toggle("hidden", hasData);
    if (!hasData || typeof Chart === "undefined") return;
    state.chart = new Chart($("revenue-chart"), {
        type: "line",
        data: {
            labels: points.map(item => new Date(`${item.date}T00:00:00`).toLocaleDateString("vi-VN")),
            datasets: [{ label: "Doanh thu", data: points.map(item => Number(item.revenue)), borderColor: "#0f7a3b", backgroundColor: "rgba(15,122,59,.12)", fill: true, tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { callbacks: { label: context => formatMoney(context.raw) } } }, scales: { y: { beginAtZero: true, ticks: { callback: value => formatMoney(value) } } } }
    });
}
function renderBranches(items) {
    if (!Array.isArray(items) || items.length === 0) {
        $("branch-list").innerHTML = '<div class="empty-state">Không có doanh thu chi nhánh trong khoảng đã chọn</div>';
        return;
    }
    $("branch-list").innerHTML = items.map(item => `<div class="branch-item"><div><strong>${escapeHtml(item.restaurantName)}</strong><small>${formatNumber(item.orderCount)} đơn hàng</small></div><strong>${formatMoney(item.revenue)}</strong></div>`).join("");
}
function renderTransactions(items) {
    if (!Array.isArray(items) || items.length === 0) {
        $("transaction-table").innerHTML = '<tr><td colspan="7" class="empty-state">Không có giao dịch doanh thu trong khoảng đã chọn</td></tr>';
        return;
    }
    $("transaction-table").innerHTML = items.map(item => `<tr><td>${escapeHtml(item.transactionReference)}</td><td>${escapeHtml(formatDateTime(item.paidAt))}</td><td>${escapeHtml(item.restaurantName)}</td><td>Đơn #${escapeHtml(item.orderId)}</td><td>${escapeHtml(item.paymentMethod)}</td><td>${formatMoney(item.amount)}</td><td><span class="status success">Thành công</span></td></tr>`).join("");
}
async function loadRestaurants() {
    try {
        const data = await api("/admin/restaurants?size=100&sortBy=name&sortDirection=asc");
        const items = Array.isArray(data?.content) ? data.content : [];
        $("branch-filter").innerHTML = '<option value="">Tất cả chi nhánh</option>' + items.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
    } catch (error) { showMessage(`Không tải được danh sách chi nhánh: ${error.message}`, "error"); }
}
async function loadDashboard() {
    if (state.loading || !validRange(state.fromDate, state.toDate)) return;
    hideMessage(); clearDashboard(); setLoading(true);
    try {
        const params = new URLSearchParams({ from: state.fromDate, to: state.toDate });
        if (state.restaurantId) params.set("restaurantId", state.restaurantId);
        const report = await api(`/admin/reports/revenue?${params}`);
        renderSummary(report.summary);
        renderChart(report.dailyRevenue);
        renderBranches(report.branchRevenue);
        renderTransactions(report.recentTransactions);
        $("last-updated").textContent = `Cập nhật lúc: ${new Date().toLocaleString("vi-VN")}`;
        if (Number(report.summary.totalOrders) === 0) showMessage("Không có giao dịch doanh thu trong khoảng thời gian đã chọn.");
    } catch (error) {
        showMessage(error.message, "error");
        $("branch-list").innerHTML = '<div class="empty-state">Không tải được dữ liệu</div>';
        $("transaction-table").innerHTML = '<tr><td colspan="7" class="empty-state">Không tải được dữ liệu</td></tr>';
    } finally { setLoading(false); }
}
function initializePage() {
    initializeDates();
    $("apply-date-btn").addEventListener("click", () => {
        const from = $("date-from").value, to = $("date-to").value;
        if (!validRange(from, to)) return;
        state.fromDate = from; state.toDate = to; loadDashboard();
    });
    $("reset-date-btn").addEventListener("click", () => { setDefaultDates(); loadDashboard(); });
    $("branch-filter").addEventListener("change", event => { state.restaurantId = event.target.value; loadDashboard(); });
    loadRestaurants();
    loadDashboard();
}
document.addEventListener("DOMContentLoaded", initializePage);
