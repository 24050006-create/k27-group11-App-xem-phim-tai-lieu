const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware này sẽ áp dụng cho tất cả các route trong file này
router.use(authMiddleware);

// GET /api/favorites - Lấy danh sách phim yêu thích của người dùng
router.get('/', async (req, res) => {
    const userId = req.user.id;
    try {
        const [favoriteMovies] = await db.query(
            `SELECT m.* 
             FROM favorites f
             JOIN movies m ON f.movie_id = m.id
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );
        res.json({ success: true, data: favoriteMovies });
    } catch (error) {
        console.error('Lỗi lấy danh sách yêu thích:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// GET /api/favorites/ids - Lấy danh sách ID phim yêu thích (để kiểm tra nhanh)
router.get('/ids', async (req, res) => {
    const userId = req.user.id;
    try {
        const [results] = await db.query('SELECT movie_id FROM favorites WHERE user_id = ?', [userId]);
        const ids = results.map(row => row.movie_id);
        res.json({ success: true, data: ids });
    } catch (error) {
        console.error('Lỗi lấy ID yêu thích:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// POST /api/favorites - Thêm một phim vào danh sách yêu thích
router.post('/', async (req, res) => {
    const userId = req.user.id;
    const { movie_id } = req.body;
    if (!movie_id) return res.status(400).json({ success: false, message: 'Thiếu movie_id.' });

    try {
        await db.query('INSERT IGNORE INTO favorites (user_id, movie_id) VALUES (?, ?)', [userId, movie_id]);
        res.status(201).json({ success: true, message: 'Đã thêm vào yêu thích.' });
    } catch (error) {
        console.error('Lỗi thêm yêu thích:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// DELETE /api/favorites/:movieId - Xóa phim khỏi danh sách yêu thích
router.delete('/:movieId', async (req, res) => {
    const userId = req.user.id;
    const { movieId } = req.params;
    await db.query('DELETE FROM favorites WHERE user_id = ? AND movie_id = ?', [userId, Number(movieId)]);
    res.json({ success: true, message: 'Đã xóa khỏi yêu thích.' });
});

module.exports = router;