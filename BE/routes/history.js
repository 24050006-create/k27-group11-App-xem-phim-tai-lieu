const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/history - Get user's watch history
router.get('/', async (req, res) => {
    const userId = req.user.id;
    try {
        const [watchedEntries] = await db.query(
            `SELECT 
                m.id as id, 
                m.title, 
                m.poster_url, 
                wh.watched_at, 
                wh.progress, 
                e.id as episode_id, 
                e.episode_number
             FROM watch_history wh
             LEFT JOIN movies m ON wh.movie_id = m.id
             LEFT JOIN episodes e ON wh.episode_id = e.id
             WHERE wh.user_id = ?
             ORDER BY wh.watched_at DESC`,
            [userId]
        );
        
        // Filter out any history entries where the movie has been deleted
        const validWatchedMovies = watchedEntries.filter(entry => entry.id !== null);

        res.json({ success: true, data: validWatchedMovies });
    } catch (error) {
        console.error('Error getting watch history:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

// POST /api/history - Add/Update watch history
router.post('/', async (req, res) => {
    const userId = req.user.id;
    const { movie_id, episode_id, progress } = req.body;

    if (!movie_id) {
        return res.status(400).json({ success: false, message: 'movie_id is required.' });
    }

    try {
        await db.query(
            `INSERT INTO watch_history (user_id, movie_id, episode_id, progress) 
             VALUES (?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE progress = VALUES(progress), watched_at = CURRENT_TIMESTAMP`,
            [userId, movie_id, episode_id, progress]
        );
        res.status(201).json({ success: true, message: 'Watch history updated.' });
    } catch (error) {
        console.error('Error updating watch history:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

module.exports = router;
