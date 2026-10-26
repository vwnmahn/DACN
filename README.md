# FCA Culinary – Hệ thống đặt món ăn trực tuyến

## 1. Giới thiệu

**FCA Culinary** là dự án đồ án chuyên ngành xây dựng hệ thống đặt món ăn trực tuyến, hỗ trợ khách hàng tìm kiếm món ăn, đặt hàng, sử dụng voucher và tích lũy điểm thưởng.

Hệ thống được phát triển theo mô hình Frontend – Backend, với giao diện web dành cho khách hàng và khu vực quản trị dành cho Admin.

## 2. Công nghệ sử dụng

### Frontend (FE)
- HTML5
- CSS3
- JavaScript
- Tailwind CSS

### Backend (BE)
- Java
- JDK: [Điền phiên bản JDK thực tế]
- Spring Boot
- Spring Security
- Maven

### Cơ sở dữ liệu
- MySQL

## 3. Chức năng hệ thống

### 3.1. Chức năng dành cho User

**Tài khoản**
- Đăng ký, đăng nhập và xác thực tài khoản.
- Quản lý thông tin cá nhân.

**Nhà hàng và món ăn**
- Xem danh sách nhà hàng và món ăn.
- Tìm kiếm và xem thông tin chi tiết món ăn.
- Lựa chọn món ăn theo nhu cầu.

**Giỏ hàng và đặt hàng**
- Thêm món ăn vào giỏ hàng.
- Điều chỉnh số lượng và ghi chú cho từng món.
- Cung cấp thông tin nhận hàng.
- Đặt hàng và theo dõi trạng thái đơn hàng.
- Sử dụng các phương thức thanh toán được hệ thống hỗ trợ.

**Voucher và ưu đãi**
- Xem danh sách voucher và chương trình khuyến mãi.
- Nhập mã voucher và sử dụng ưu đãi theo điều kiện áp dụng.
- Tích lũy điểm thưởng theo cơ chế của hệ thống.
- Sử dụng điểm tích lũy để đổi lấy voucher.
- Theo dõi thông tin điểm thưởng và voucher nhận được.

**Tiện ích khác**
- Quản lý món ăn yêu thích.
- Xem lịch sử đặt hàng.
- Theo dõi thông tin đơn hàng và các ưu đãi liên quan.

### 3.2. Chức năng dành cho Admin

**Quản lý tài khoản**
- Xem danh sách tài khoản người dùng.
- Quản lý thông tin tài khoản.
- Thực hiện các thao tác quản trị tài khoản theo quyền được cấp.

**Quản lý nhà hàng**
- Xem danh sách nhà hàng.
- Thêm, sửa và cập nhật thông tin nhà hàng.
- Quản lý trạng thái hoạt động của nhà hàng.

**Quản lý món ăn**
- Thêm, sửa và cập nhật thông tin món ăn.
- Quản lý giá bán, hình ảnh và thông tin món ăn.
- Quản lý trạng thái kinh doanh của món ăn.

**Quản lý doanh thu**
- Theo dõi doanh thu từ hoạt động kinh doanh.
- Xem và tổng hợp dữ liệu doanh thu theo các tiêu chí hệ thống hỗ trợ.
- Hỗ trợ theo dõi tình hình hoạt động kinh doanh.

## 4. Kiến trúc hệ thống

Hệ thống gồm ba thành phần chính:

- **Frontend:** Xây dựng giao diện web và tiếp nhận thao tác người dùng.
- **Backend:** Xử lý nghiệp vụ, cung cấp API, xác thực và phân quyền truy cập.
- **MySQL:** Lưu trữ và quản lý dữ liệu của hệ thống.

Frontend giao tiếp với Backend để trao đổi dữ liệu. Backend xử lý yêu cầu nghiệp vụ và tương tác với cơ sở dữ liệu nhằm trả về kết quả phù hợp.

## 5. Yêu cầu môi trường

| Thành phần | Yêu cầu |
|---|---|
| Java |21 |
| JDK | 21 |
| Maven | Maven tương thích với dự án hoặc Maven Wrapper |
| MySQL | Phiên bản tương thích với cấu hình dự án |
| IDE | IntelliJ IDEA hoặc Visual Studio Code |
| Trình duyệt | Chrome, Edge hoặc trình duyệt hiện đại tương đương |

## 6. Hướng dẫn chạy Backend

### Bước 1: Mở Terminal

Mở Terminal trong IDE hoặc PowerShell, sau đó di chuyển đến thư mục Backend:

cd BE

Đường dẫn `BE` cần được điều chỉnh nếu thư mục Backend trong repository có tên khác.

### Bước 2: Kiểm tra Java và JDK
java -version
javac -version

Kiểm tra Maven:

mvn -version

Nếu dự án có Maven Wrapper, có thể sử dụng Wrapper mà không cần cài Maven toàn cục.

### Bước 3: Cấu hình MySQL

Đảm bảo MySQL đang hoạt động và cơ sở dữ liệu đã được tạo theo cấu hình dự án.

Thông tin kết nối được khai báo trong file cấu hình ứng dụng của Backend. Hãy sử dụng thông tin phù hợp với môi trường cục bộ và không công khai mật khẩu thật.

### Bước 4: Chạy Backend

**Cách 1: Sử dụng Maven Wrapper trên Windows**

.\mvnw.cmd spring-boot:run

**Cách 2: Sử dụng Maven đã cài đặt**

mvn spring-boot:run


Sau khi khởi động, kiểm tra log để xác nhận ứng dụng đã chạy thành công và đang sử dụng đúng cổng được cấu hình.

## 7. Thông tin dự án

- **Tên dự án:** FCA Culinary
- **Loại dự án:** Đồ án chuyên ngành (DACN)
- **Lĩnh vực:** Hệ thống đặt món ăn trực tuyến
- **Nền tảng:** Web Application
- **Đối tượng sử dụng:** User và Admin

---
