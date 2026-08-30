// File: BE/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db'); // Gọi file kết nối DB ở bước 3

const app = express();

// Middleware (Bộ lọc)
app.use(cors()); // Cho phép điện thoại/FE kết nối vào không bị chặn
app.use(express.json()); // Giúp BE đọc được dữ liệu JSON gửi lên
app.use('/uploads', express.static('uploads')); // Phục vụ file ảnh tĩnh từ thư mục 'uploads'

// ==========================================
// ROUTES (ĐIỀU HƯỚNG API)
// ==========================================
const moviesRouter = require('./routes/movies');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const historyRouter = require('./routes/history');
const favoritesRouter = require('./routes/favorites');
const commentsRouter = require('./routes/comments');
const genresRouter = require('./routes/genres');


app.use('/api/movies', moviesRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/history', historyRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/genres', genresRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '🚀 TàiLiệu API is running!' });
});

// Khởi chạy Server tại cổng 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TàiLiệu Server đang chạy tại: http://0.0.0.0:${PORT}`);
});
