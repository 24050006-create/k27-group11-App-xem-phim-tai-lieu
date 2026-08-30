const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/categories - Lấy danh sách thể loại
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, slug FROM genres ORDER BY name ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Lỗi lấy danh sách thể loại:', error);
    res.status(500).json({ success: false, message: 'Lỗi server!' });
  }
});

module.exports = router;
