const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const multer = require('multer');
const path = require('path');

// Cấu hình Multer để lưu file ảnh
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/avatars/'); // Thư mục lưu avatar
    },
    filename: function (req, file, cb) {
        // Tạo tên file duy nhất: user-id-timestamp.extension
        cb(null, `user-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Chỉ cho phép upload file ảnh
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ file ảnh!'), false);
        }
    }
});

// PUT /api/users/profile - Cập nhật thông tin cá nhân
router.put('/profile', [authMiddleware, upload.single('avatar')], async (req, res) => {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập username.' });
    }

    try {
        // 1. Lấy thông tin user hiện tại để giữ avatar cũ nếu không có ảnh mới
        const [currentUserRows] = await db.query('SELECT avatar_url, username FROM users WHERE id = ?', [userId]);
        if (currentUserRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }
        const currentUser = currentUserRows[0];

        // 2. Kiểm tra username mới có bị trùng không (nếu username có thay đổi)
        if (username !== currentUser.username) {
             const [existingUser] = await db.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
            if (existingUser.length > 0) {
                return res.status(400).json({ success: false, message: 'Tên người dùng đã tồn tại.' });
            }
        }

        // 3. Xác định URL avatar cuối cùng
        let finalAvatarUrl = currentUser.avatar_url; // Mặc định là avatar cũ
        if (req.file) {
            // Nếu có file mới, dùng URL của file mới
            finalAvatarUrl = `/uploads/avatars/${req.file.filename}`;
        }

        // 4. Cập nhật vào DB
        await db.query('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [username, finalAvatarUrl, userId]);

        const [updatedUser] = await db.query('SELECT id, username, email, role, avatar_url FROM users WHERE id = ?', [userId]);
        
        res.json({ success: true, message: 'Cập nhật thành công!', user: updatedUser[0] });
    } catch (error) {
        console.error('Lỗi cập nhật profile:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// PUT /api/users/push-token - Cập nhật push token của người dùng
router.put('/push-token', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { token } = req.body; // Expo Push Token

    if (!token) {
        return res.status(400).json({ success: false, message: 'Thiếu push token.' });
    }

    try {
        await db.query('UPDATE users SET push_token = ? WHERE id = ?', [token, userId]);
        res.json({ success: true, message: 'Push token đã được cập nhật.' });
    } catch (error) {
        console.error('Lỗi cập nhật push token:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// DELETE /api/users/push-token - Xóa push token của người dùng (khi tắt thông báo hoặc đăng xuất)
router.delete('/push-token', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        await db.query('UPDATE users SET push_token = NULL WHERE id = ?', [userId]);
        res.json({ success: true, message: 'Push token đã được xóa.' });
    } catch (error) {
        console.error('Lỗi xóa push token:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// === ADMIN ROUTES ===

// GET /api/users - Lấy danh sách tất cả người dùng (Admin only)
router.get('/', [authMiddleware, adminMiddleware], async (req, res) => {
    const { search, page = 1, limit = 15 } = req.query;
    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        let countSql = 'SELECT COUNT(*) as total FROM users';
        let dataSql = 'SELECT id, username, email, role, created_at, avatar_url, points FROM users';
        const params = [];
        const countParams = [];

        if (search) {
            const searchClause = ' WHERE username LIKE ? OR email LIKE ?';
            countSql += searchClause;
            dataSql += searchClause;
            params.push(`%${search}%`);
            params.push(`%${search}%`);
            countParams.push(...params);
        }

        dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const [[{ total }]] = await db.query(countSql, countParams);
        const [users] = await db.query(dataSql, params);

        res.json({
            success: true,
            data: users,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total / limitNum),
                currentPage: pageNum,
            },
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách người dùng:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// PUT /api/users/:id/role - Cập nhật vai trò người dùng (Admin only)
router.put('/:id/role', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (req.user.id === Number(id)) {
        return res.status(400).json({ success: false, message: 'Bạn không thể thay đổi vai trò của chính mình.' });
    }
    if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
    }

    try {
        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ success: true, message: 'Cập nhật vai trò người dùng thành công!' });
    } catch (error) {
        console.error('Lỗi cập nhật vai trò:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// DELETE /api/users/:id - Xóa người dùng (Admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.id;

    if (Number(id) === adminId) {
        return res.status(400).json({ success: false, message: 'Bạn không thể xóa tài khoản của chính mình.' });
    }

    try {
        // Nhờ có "ON DELETE CASCADE" trong CSDL, khi xóa người dùng,
        // tất cả bình luận, phim yêu thích, và lịch sử xem của họ cũng sẽ tự động bị xóa.
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'Xóa người dùng thành công!' });
    } catch (error) {
        console.error('Lỗi xóa người dùng:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

module.exports = router;