# 📚 PHẦN MỀM GHÉP GIÁO ÁN & KẾ HOẠCH BÀI DẠY 35 TUẦN (TIỂU HỌC)

> **Ứng dụng Web chuyên dụng dành cho Giáo viên Tiểu học** — Tự động gom và ghép các tệp Word (`.docx`) riêng lẻ của từng môn học (Tiếng Việt, Toán, Khoa học, Lịch sử và Địa lí, Đạo đức, Công nghệ, Hoạt động trải nghiệm...) thành các tệp Kế hoạch bài dạy (KHBD) tổng hợp theo từng tuần từ **Tuần 1 đến Tuần 35**, chuẩn thể thức văn bản giáo dục.

🌐 **DÙNG TRỰC TIẾP TRÊN TRÌNH DUYỆT (GITHUB PAGES):**  
👉 **[https://chauphan708.github.io/GHEPGIAOAN/](https://chauphan708.github.io/GHEPGIAOAN/)**  
*(Chạy 100% trên trình duyệt của máy người dùng, không tải dữ liệu lên máy chủ, bảo mật tuyệt đối).*

---

## ✨ CÁC TÍNH NĂNG VƯỢT TRỘI

### 1. 🚀 2 Chế Độ Ghép Linh Hoạt
- **Ghép Giáo Án 35 Tuần**: Quét thông minh thư mục giáo án cả năm học, phân loại theo tuần (1 – 35) và môn học tự động, hỗ trợ ghép tuần theo từng học kỳ hoặc cả năm.
- **Ghép Tài Liệu Tự Do (Free Merge)**: Ghép danh sách tài liệu Word bất kỳ (báo cáo, đề thi, chuyên đề, hồ sơ nhà trường...) với khả năng kéo thả sắp xếp thứ tự tùy ý.

### 2. ✍️ Tùy Chọn Khối Chữ Ký Duyệt (1 Cột, 2 Cột hoặc 3 Cột)
- **1 Cột (Giáo viên)**: Dành cho kế hoạch bài dạy cá nhân, chữ ký căn lề góc phải phía dưới theo chuẩn Nghị định 30/2020/NĐ-CP.
- **2 Cột (Tổ trưởng - GV)**: Cột trái Tổ trưởng kiểm tra & ký duyệt, cột phải Giáo viên soạn bài.
- **3 Cột (BGH - Tổ trưởng - GV)**: Bố cục chuẩn 3 cấp đầy đủ của trường tiểu học gồm BGH (Trái), Tổ trưởng (Giữa) và Giáo viên (Phải).
- **Lưu 1 lần dùng mãi mãi**: Tự động lưu họ tên, chức vụ vào `localStorage` trình duyệt.

### 3. 📄 Chuẩn Thể Thức & Bảo Toàn Văn Bản Word
- **Đánh số trang liên tục**: Số trang chân trang (Footer) chạy liên tục từ trang 1 đến trang cuối toàn tuần, không bị lặp lại số trang khi sang môn mới.
- **Bảo toàn 100% hình ảnh & định dạng**: Ánh xạ lại mã liên kết OpenXML (`Relationship ID`), chống trùng mã ảnh, chống lỗi file.
- **Hỗ trợ nhiều tiết trong 1 môn**: Tự động gom đủ các tiết bài dạy trong tuần theo thứ tự tự nhiên mà không bị mất bài.

### 4. 🔒 Bảo Mật & Nhẹ Máy Tuyệt Đối
- Toàn bộ quá trình đọc, ghép và xuất file được thực hiện trực tiếp trong bộ nhớ RAM trình duyệt của máy Thầy/Cô bằng WebAssembly/JavaScript thuần.
- Không gửi bất kỳ tệp giáo án nào lên internet, an toàn thông tin 100%.

---

## 💻 3 CÁCH SỬ DỤNG TIỆN LỢI

### ★ Cách 1: Chạy Trực Tuyến Qua GitHub Pages (Khuyên dùng khi chia sẻ)
- Truy cập trực tiếp link: **[https://chauphan708.github.io/GHEPGIAOAN/](https://chauphan708.github.io/GHEPGIAOAN/)**
- Kéo thả thư mục giáo án hoặc chọn file vào màn hình để ghép ngay, không cần cài đặt bất cứ phần mềm gì.

### ★ Cách 2: Mở File HTML5 Offline Trên Máy Tính
- Nhấp đúp vào file `Ghep_Giao_An_HTML5.html` (hoặc chạy `Mo_Ban_HTML5.bat`).
- Có thể copy file HTML5 này vào USB mang sang bất kỳ máy tính nào của đồng nghiệp để sử dụng.

### ★ Cách 3: Chạy Bản Web Local Node.js
- Nhấp đúp vào file `Chay_Phan_Mem_Web.bat` (chạy tại `http://localhost:8080`).

---

## ⚙️ HƯỚNG DẪN BẬT GITHUB PAGES CHO REPOSITORY (1 LẦN DUY NHẤT)

1. Vào repository GitHub: **`https://github.com/Chauphan708/GHEPGIAOAN`**
2. Bấm vào tab **Settings** (ở trên cùng bên phải).
3. Ở menu bên trái, chọn mục **Pages**.
4. Tại mục **Build and deployment** > **Branch**:
   - Chọn nhánh: **`main`**
   - Thư mục: **`/(root)`**
5. Bấm **Save**. Sau khoảng 1 phút, trang web sẽ hoạt động tại:  
   👉 **`https://chauphan708.github.io/GHEPGIAOAN/`**