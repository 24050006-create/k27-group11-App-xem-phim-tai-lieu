const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// GET /api/comments/movie/:movie_id - Get comments for a movie
router.get('/movie/:movie_id', async (req, res) => {
    const { movie_id } = req.params;
    try {
        const [comments] = await db.query(
            `SELECT c.id, c.content, c.created_at, c.parent_id, u.id as user_id, u.username, u.avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.movie_id = ?
             ORDER BY c.created_at DESC`,
            [movie_id]
        );

        const commentMap = {};
        const nestedComments = [];

        comments.forEach(comment => {
            comment.replies = [];
            commentMap[comment.id] = comment;
        });

        comments.forEach(comment => {
            if (comment.parent_id !== null && commentMap[comment.parent_id]) {
                commentMap[comment.parent_id].replies.push(comment);
            } else {
                nestedComments.push(comment);
            }
        });

        res.json({ success: true, data: nestedComments });
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

// POST /api/comments - Add a new comment
router.post('/', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { movie_id, content, parent_id } = req.body;

    if (!movie_id || !content) {
        return res.status(400).json({ success: false, message: 'Movie ID and content are required.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO comments (user_id, movie_id, content, parent_id) VALUES (?, ?, ?, ?)',
            [userId, movie_id, content, parent_id]
        );

        const [newComment] = await db.query(
            `SELECT c.id, c.content, c.created_at, c.parent_id, u.id as user_id, u.username, u.avatar_url
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.id = ?`,
            [result.insertId]
        );

        res.status(201).json({ success: true, data: newComment[0] });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

// DELETE /api/comments/:id - Delete a comment
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const [comment] = await db.query('SELECT * FROM comments WHERE id = ?', [id]);
        if (comment.length === 0) {
            return res.status(404).json({ success: false, message: 'Comment not found.' });
        }

        if (comment[0].user_id !== userId && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this comment.' });
        }

        await db.query('DELETE FROM comments WHERE id = ?', [id]);
        res.json({ success: true, message: 'Comment deleted successfully.' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

module.exports = router;
