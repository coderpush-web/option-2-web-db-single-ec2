# Shared Web Application

Thư mục này chứa mã nguồn Node.js/Express dùng chung cho cả 4 kịch bản CloudFormation:
- **`server.js`**: Web server nhẹ, tự động phát hiện biến môi trường (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
  - Nếu không có DB: Chạy ở chế độ **Standalone Mode** (Dùng cho **Option 1**).
  - Nếu có DB: Tự động kết nối và test truy vấn `SELECT 1 + 1` để kiểm tra kết nối (Dùng cho **Option 2, 3, 4**).
- **`package.json`**: Cấu hình dependencies (`express`, `mysql2`).

UserData trong kịch bản CloudFormation sẽ tự động nén hoặc tạo file này khi máy ảo khởi chạy.
