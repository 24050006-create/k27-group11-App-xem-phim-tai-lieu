const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// GET /api/genres - Lấy danh sách thể loại
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM genres ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Lỗi lấy danh sách thể loại:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
});

// POST /api/genres - Thêm thể loại mới (Admin only)
router.post('/', [authMiddleware, adminMiddleware], async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên thể loại.' });
  }

  try {
    const [result] = await db.query('INSERT INTO genres (name) VALUES (?)', [name]);
    res.status(201).json({ success: true, message: 'Thêm thể loại thành công!', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Tên thể loại đã tồn tại.' });
    }
    console.error('Lỗi thêm thể loại:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm thể loại.' });
  }
});

// PUT /api/genres/:id - Cập nhật thể loại (Admin only)
router.put('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập tên thể loại.' });
    }

    try {
        const [result] = await db.query('UPDATE genres SET name = ? WHERE id = ?', [name, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại.' });
        }
        res.json({ success: true, message: 'Cập nhật thể loại thành công!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Tên thể loại đã tồn tại.' });
        }
        console.error('Lỗi cập nhật thể loại:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thể loại.' });
    }
});

// DELETE /api/genres/:id - Xóa thể loại (Admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM genres WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thể loại.' });
        }
        res.json({ success: true, message: 'Xóa thể loại thành công!' });
    } catch (error) {
        console.error('Lỗi xóa thể loại:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa thể loại.' });
    }
});

module.exports = router;
