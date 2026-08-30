const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const multer = require('multer');
const path = require('path');

const normalizeMovie = (row) => ({
  ...row,
  poster_url: row.poster_url || null,
  banner_url: row.banner_url || row.poster_url || null,
  rating: Number(row.rating ?? 0),
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ hỗ trợ file ảnh và video!'), false);
        }
    }
});

// GET /api/movies - Get list of movies
router.get('/', async (req, res) => {
    try {
        const { genre, search, sort, page = 1, limit = 20, minYear, maxYear, minRating } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;

        let countSql = 'SELECT COUNT(DISTINCT m.id) as total FROM movies m';
        let dataSql = `SELECT m.*, GROUP_CONCAT(g.name) as genres FROM movies m LEFT JOIN movie_genres mg ON m.id = mg.movie_id LEFT JOIN genres g ON mg.genre_id = g.id`;

        const params = [];
        let whereClauses = [];

        if (genre) {
            countSql += ' JOIN movie_genres mg_genre ON m.id = mg_genre.movie_id JOIN genres g_genre ON mg_genre.genre_id = g_genre.id';
            whereClauses.push('g_genre.name = ?');
            params.push(genre);
        }

        if (search) {
            whereClauses.push('m.title LIKE ?');
            params.push(`%${search}%`);
        }
        if (minYear) {
            whereClauses.push('m.release_year >= ?');
            params.push(parseInt(minYear, 10));
        }
        if (maxYear) {
            whereClauses.push('m.release_year <= ?');
            params.push(parseInt(maxYear, 10));
        }
        if (minRating) {
            whereClauses.push('m.rating >= ?');
            params.push(parseFloat(minRating));
        }

        if (whereClauses.length > 0) {
            const whereString = ' WHERE ' + whereClauses.join(' AND ');
            countSql += whereString;
            dataSql += whereString;
        }

        dataSql += ' GROUP BY m.id';

        let sortClause = ' ORDER BY m.created_at DESC';
        if (sort === 'views') sortClause = ' ORDER BY m.views DESC';
        else if (sort === 'year') sortClause = ' ORDER BY m.release_year DESC';

        dataSql += sortClause;

        const offset = (pageNum - 1) * limitNum;
        dataSql += ' LIMIT ? OFFSET ?';
        const dataParams = [...params, limitNum, offset];

        const [[countResult], [rows]] = await Promise.all([
            db.query(countSql, params),
            db.query(dataSql, dataParams),
        ]);

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limitNum);

        res.json({
            success: true,
            data: rows.map(normalizeMovie),
            pagination: {
                total,
                totalPages,
                currentPage: pageNum,
                limit: limitNum,
            },
        });
    } catch (error) {
        console.error('Error getting movies:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});


// GET /api/movies/:id - Get movie details
router.get('/:id', async (req, res) => {
    const movieId = Number(req.params.id);
    if (isNaN(movieId)) {
        return res.status(400).json({ success: false, message: 'Invalid movie ID.' });
    }

    try {
        const [movieRows] = await db.query(
            `SELECT m.*, COALESCE(GROUP_CONCAT(g.name SEPARATOR ', '), '') as genres 
             FROM movies m 
             LEFT JOIN movie_genres mg ON m.id = mg.movie_id 
             LEFT JOIN genres g ON mg.genre_id = g.id 
             WHERE m.id = ? 
             GROUP BY m.id`,
            [movieId]
        );

        if (movieRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found!' });
        }

        const [episodes] = await db.query('SELECT * FROM episodes WHERE movie_id = ? ORDER BY episode_number ASC', [movieId]);

        await db.query('UPDATE movies SET views = views + 1 WHERE id = ?', [movieId]);

        const movie = normalizeMovie(movieRows[0]);
        movie.episodes = episodes;

        res.json({ success: true, data: movie });
    } catch (error) {
        console.error('Error getting movie details:', error);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

// POST /api/movies - Add a new movie (Admin only)
router.post('/', [authMiddleware, adminMiddleware, upload.fields([{ name: 'poster_url', maxCount: 1 }, { name: 'banner_url', maxCount: 1 }])], async (req, res) => {
    const { title, description, release_year, country, duration, genre_ids, youtube_link } = req.body;

    if (!title || !description || !release_year) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    const poster_url = req.files['poster_url'] ? `/uploads/${req.files['poster_url'][0].filename}` : null;
    const banner_url = req.files['banner_url'] ? `/uploads/${req.files['banner_url'][0].filename}` : null;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            'INSERT INTO movies (title, description, release_year, country, duration, poster_url, banner_url, youtube_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, release_year, country, duration, poster_url, banner_url, youtube_link]
        );
        const movieId = result.insertId;

        if (genre_ids) {
            const genres = JSON.parse(genre_ids);
            if (Array.isArray(genres) && genres.length > 0) {
                const genreValues = genres.map(genreId => [movieId, genreId]);
                await connection.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ?', [genreValues]);
            }
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Movie added successfully!', movieId });
    } catch (error) {
        await connection.rollback();
        console.error('Error adding movie:', error);
        res.status(500).json({ success: false, message: 'Server error when adding movie.' });
    } finally {
        connection.release();
    }
});


// PUT /api/movies/:id - Update a movie (Admin only)
router.put('/:id', [authMiddleware, adminMiddleware, upload.fields([{ name: 'poster_url', maxCount: 1 }, { name: 'banner_url', maxCount: 1 }])], async (req, res) => {
    const { id } = req.params;
    const { title, description, release_year, country, duration, genre_ids, youtube_link } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Lấy thông tin phim hiện tại để giữ lại URL ảnh/banner cũ nếu không có file mới được tải lên
        const [existingMovies] = await connection.query('SELECT poster_url, banner_url FROM movies WHERE id = ?', [id]);
        if (existingMovies.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }
        const existingMovie = existingMovies[0];
        
        // 2. Xác định URL cuối cùng cho poster và banner
        // Nếu có file 'poster_url' mới trong request, dùng nó. Nếu không, giữ lại URL cũ.
        const poster_url = req.files && req.files['poster_url']
            ? `/uploads/${req.files['poster_url'][0].filename}`
            : existingMovie.poster_url;

        // Tương tự với banner
        const banner_url = req.files && req.files['banner_url']
            ? `/uploads/${req.files['banner_url'][0].filename}`
            : existingMovie.banner_url;

        // 3. Cập nhật phim với các thông tin mới (bao gồm cả URL ảnh/banner đã xác định)
        await connection.query(
            `UPDATE movies SET title = ?, description = ?, release_year = ?, country = ?, duration = ?, poster_url = ?, banner_url = ?, youtube_link = ? WHERE id = ?`,
            [title, description, release_year, country, duration, poster_url, banner_url, youtube_link, id]
        );

        await connection.query('DELETE FROM movie_genres WHERE movie_id = ?', [id]);
        if (genre_ids) {
            const genres = JSON.parse(genre_ids);
            if (Array.isArray(genres) && genres.length > 0) {
                const genreValues = genres.map(genreId => [id, genreId]);
                await connection.query('INSERT INTO movie_genres (movie_id, genre_id) VALUES ?', [genreValues]);
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Movie updated successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating movie:', error);
        res.status(500).json({ success: false, message: 'Server error when updating movie.' });
    } finally {
        connection.release();
    }
});


// DELETE /api/movies/:id - Delete a movie (Admin only)
router.delete('/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM movies WHERE id = ?', [id]);
        res.json({ success: true, message: 'Movie deleted successfully!' });
    } catch (error) {
        console.error('Error deleting movie:', error);
        res.status(500).json({ success: false, message: 'Server error when deleting movie.' });
    }
});


// --- Episodes ---

// POST /api/movies/:id/episodes - Add an episode (Admin only)
router.post('/:id/episodes', [authMiddleware, adminMiddleware, upload.single('video_file')], async (req, res) => {
    const { id: movie_id } = req.params;
    const { episode_number, title, duration, youtube_link } = req.body;
    const video_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!episode_number || !title) {
        return res.status(400).json({ success: false, message: 'Please provide episode number and title.' });
    }
    if (!video_url && !youtube_link) {
        return res.status(400).json({ success: false, message: 'Please provide either a video file or a YouTube link.' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO episodes (movie_id, episode_number, title, duration, video_url, youtube_link) VALUES (?, ?, ?, ?, ?, ?)',
            [movie_id, episode_number, title, duration, video_url, youtube_link]
        );
        res.status(201).json({ success: true, message: 'Episode added successfully!', episodeId: result.insertId });
    } catch (error) {
        console.error('Error adding episode:', error);
        res.status(500).json({ success: false, message: 'Server error when adding episode.' });
    }
});

// PUT /api/movies/:id/episodes/:episode_id - Update an episode (Admin only)
router.put('/:id/episodes/:episode_id', [authMiddleware, adminMiddleware, upload.single('video_file')], async (req, res) => {
    const { episode_id } = req.params;
    const { episode_number, title, duration, youtube_link } = req.body;

    // If a new file is uploaded, use it. Otherwise, keep the existing video_url from the body.
    const video_url = req.file ? `/uploads/${req.file.filename}` : req.body.video_url;

    try {
        await db.query(
            'UPDATE episodes SET episode_number = ?, title = ?, duration = ?, video_url = ?, youtube_link = ? WHERE id = ?',
            [episode_number, title, duration, video_url, youtube_link, episode_id]
        );
        res.json({ success: true, message: 'Episode updated successfully!' });
    } catch (error) {
        console.error('Error updating episode:', error);
        res.status(500).json({ success: false, message: 'Server error when updating episode.' });
    }
});

// DELETE /api/movies/:id/episodes/:episode_id - Delete an episode (Admin only)
router.delete('/:id/episodes/:episode_id', [authMiddleware, adminMiddleware], async (req, res) => {
    const { episode_id } = req.params;
    try {
        await db.query('DELETE FROM episodes WHERE id = ?', [episode_id]);
        res.json({ success: true, message: 'Episode deleted successfully!' });
    } catch (error) {
        console.error('Error deleting episode:', error);
        res.status(500).json({ success: false, message: 'Server error when deleting episode.' });
    }
});

module.exports = router;
