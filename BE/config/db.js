// File: BE/config/db.js
const mysql = require('mysql2');
require('dotenv').config();

// Tạo một "Hồ bơi kết nối" (Connection Pool) để quản lý kết nối hiệu quả
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Tối đa 10 kết nối đồng thời
    queueLimit: 0
});

// Kiểm tra kết nối thử xem có thành công không
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Lỗi kết nối MySQL:', err.message);
    } else {
        console.log('✅ Đã kết nối thành công vào MySQL trong Docker!');
        connection.release(); // Nhả kết nối lại cho hồ bơi
    }
});

// Xuất ra dạng Promise để dùng được cú pháp hiện đại async/await
module.exports = pool.promise();