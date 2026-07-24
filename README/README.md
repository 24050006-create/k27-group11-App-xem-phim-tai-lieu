# 🎬 Ứng Dụng Xem Phim (App Xem Phim Tài Liệu)

Dự án ứng dụng xem phim trực tuyến được phát triển với đầy đủ các tính năng quản lý, phân loại thể loại và trải nghiệm người dùng mượt mà trên nền tảng di động.

---

## 👥 Thành Viên Nhóm & Phân Công Nhiệm Vụ
* **Backend:** Xây dựng hệ thống API, xử lý cơ sở dữ liệu, quản lý xác thực và các chức năng CRUD phim, bình luận.
* **Frontend:** Phát triển giao diện ứng dụng di động (React Native / Expo), màn hình trang chủ, chi tiết phim, quản trị viên (Admin) và tìm kiếm.
* **Database:** Thiết kế cơ sở dữ liệu MySQL, quản lý file SQL, dữ liệu mẫu và sơ đồ quan hệ các bảng.

---

## 🛠 Công Nghệ Sử Dụng
* **Frontend:** React Native, Expo, Expo Router, TypeScript / JavaScript, Axios.
* **Backend:** Node.js, Express.js, Multer (xử lý upload ảnh).
* **Database:** MySQL, TablePlus.

---

## 📁 Cấu Trúc Thư Mục Dự Án
Dự án được tổ chức theo mô hình phân tách rõ ràng giữa các phân hệ:
```text
app_xem_phim/
├── backend/       # Source code phía Server / API
├── frontend/      # Source code giao diện ứng dụng di động
├── database/      # File SQL và dữ liệu mẫu cơ sở dữ liệu
└── README.md      # Tài liệu giới thiệu dự án