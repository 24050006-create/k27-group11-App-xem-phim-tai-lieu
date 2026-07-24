const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const sendEmail = require('./sendEmail'); // sendEmail.js nằm trong /routes/

// POST /api/auth/register - Đăng ký người dùng mới
router.post(
    '/register',
    [
        body('username', 'Tên người dùng là bắt buộc').not().isEmpty(),
        body('email', 'Vui lòng nhập một email hợp lệ').isEmail(),
        body('password', 'Mật khẩu phải có ít nhất 6 ký tự').isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username, email, password } = req.body;

        try {
            // Kiểm tra email hoặc username đã tồn tại chưa
            const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
            if (existingUsers.length > 0) {
                return res.status(400).json({ success: false, message: 'Email hoặc tên người dùng đã tồn tại.' });
            }

            // Mã hóa mật khẩu
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Lưu người dùng vào DB
            await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

            res.status(201).json({ success: true, message: 'Đăng ký thành công!' });
        } catch (error) {
            console.error('Lỗi đăng ký:', error);
            res.status(500).json({ success: false, message: 'Lỗi server!' });
        }
    }
);

// POST /api/auth/login - Đăng nhập
router.post(
    '/login',
    [
        body('email', 'Vui lòng nhập một email hợp lệ').isEmail(),
        body('password', 'Mật khẩu là bắt buộc').exists(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            // Tìm người dùng bằng email
            const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
            if (users.length === 0) {
                return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
            }

            const user = users[0];

            // So sánh mật khẩu
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
            }

            // Tạo và trả về JWT
            const payload = {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET || 'your_default_jwt_secret', // Nên đặt trong file .env
                { expiresIn: '7d' }, // Token hết hạn sau 7 ngày
                (err, token) => {
                    if (err) throw err;
                    // Không trả về password
                    delete user.password;
                    res.json({ success: true, token, user });
                }
            );
        } catch (error) {
            console.error('Lỗi đăng nhập:', error);
            res.status(500).json({ success: false, message: 'Lỗi server!' });
        }
    }
);

// POST /api/auth/google-login - Đăng nhập bằng Google
router.post('/google-login', async (req, res) => {
    const { email, username, googleId, avatar_url } = req.body;

    if (!email || !googleId) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin từ Google.' });
    }

    try {
        // 1. Kiểm tra xem người dùng đã tồn tại với email này chưa
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        let user = users[0];

        // 2. Nếu người dùng chưa tồn tại, tạo mới
        if (!user) {
            // Tạo một mật khẩu ngẫu nhiên, an toàn vì nó sẽ không được sử dụng
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            // Đảm bảo username là duy nhất
            let finalUsername = username;
            const [existingUsernames] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
            if (existingUsernames.length > 0) {
                finalUsername = `${username}_${crypto.randomBytes(4).toString('hex')}`;
            }

            const [newUserResult] = await db.query(
                'INSERT INTO users (username, email, password, avatar_url, google_id) VALUES (?, ?, ?, ?, ?)',
                [finalUsername, email, hashedPassword, avatar_url, googleId]
            );
            const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [newUserResult.insertId]);
            user = newUsers[0];
        } else {
            // 3. Nếu người dùng đã tồn tại, cập nhật google_id và avatar nếu cần
            if (!user.google_id || user.avatar_url !== avatar_url) {
                await db.query('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [googleId, avatar_url, user.id]);
            }
        }

        // 4. Tạo JWT và trả về cho client
        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_default_jwt_secret',
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                delete user.password;
                res.json({ success: true, token, user });
            }
        );
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// POST /api/auth/facebook-login - Đăng nhập bằng Facebook
router.post('/facebook-login', async (req, res) => {
    const { email, name, facebookId, avatar_url } = req.body;

    if (!email || !facebookId) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin từ Facebook.' });
    }

    try {
        // 1. Kiểm tra xem người dùng đã tồn tại với email này chưa
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user = users[0];

        // 2. Nếu người dùng chưa tồn tại, tạo mới
        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            let finalUsername = name.replace(/\s/g, '') + crypto.randomBytes(2).toString('hex');
            const [existingUsernames] = await db.query('SELECT id FROM users WHERE username = ?', [finalUsername]);
            if (existingUsernames.length > 0) {
                finalUsername = `${finalUsername}_${crypto.randomBytes(2).toString('hex')}`;
            }

            const [newUserResult] = await db.query(
                'INSERT INTO users (username, email, password, avatar_url, facebook_id) VALUES (?, ?, ?, ?, ?)',
                [finalUsername, email, hashedPassword, avatar_url, facebookId]
            );
            const [newUsers] = await db.query('SELECT * FROM users WHERE id = ?', [newUserResult.insertId]);
            user = newUsers[0];
        } else {
            // 3. Nếu người dùng đã tồn tại, cập nhật facebook_id và avatar nếu cần
            if (!user.facebook_id || user.avatar_url !== avatar_url) {
                await db.query('UPDATE users SET facebook_id = ?, avatar_url = ? WHERE id = ?', [facebookId, avatar_url, user.id]);
            }
        }

        // 4. Tạo JWT và trả về cho client
        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your_default_jwt_secret',
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                delete user.password;
                res.json({ success: true, token, user });
            }
        );
    } catch (error) {
        console.error('Lỗi đăng nhập Facebook:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// POST /api/auth/forgot-password - Yêu cầu reset mật khẩu
router.post('/forgot-password', [body('email').isEmail()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Vẫn trả về thành công để tránh lộ thông tin email nào đã đăng ký
            return res.json({ success: true, message: 'Nếu email tồn tại, bạn sẽ nhận được link khôi phục mật khẩu.' });
        }
        const user = users[0];

        // Tạo token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Đặt thời gian hết hạn (10 phút)
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        // Lưu token vào DB
        await db.query('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?', [hashedToken, expires, user.id]);

        // Gửi email
        // ⚠️ Thay 'phimdown' bằng scheme của bạn trong app.json
        const resetUrl = `phimdown://reset-password?token=${resetToken}`;
        const message = `Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu khôi phục mật khẩu cho tài khoản của bạn.\n\nVui lòng nhấn vào link sau, hoặc sao chép và dán vào trình duyệt để hoàn tất quá trình:\n\n${resetUrl}\n\nNếu bạn không yêu cầu điều này, vui lòng bỏ qua email này. Link sẽ hết hạn trong 10 phút.`;

        await sendEmail({
            email: user.email,
            subject: 'Khôi phục mật khẩu TàiLiệu',
            message,
        });

        res.json({ success: true, message: 'Link khôi phục mật khẩu đã được gửi đến email của bạn.' });
    } catch (error) {
        console.error('Lỗi quên mật khẩu:', error);
        // Xóa token nếu có lỗi xảy ra
        await db.query('UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE email = ?', [email]);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

// POST /api/auth/reset-password - Đặt lại mật khẩu
router.post('/reset-password', [body('password').isLength({ min: 6 })], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    try {
        const [users] = await db.query('SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()', [hashedToken]);

        if (users.length === 0) {
            return res.status(400).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
        }

        const user = users[0];

        // Hash mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Cập nhật mật khẩu và xóa token
        await db.query('UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?', [hashedPassword, user.id]);

        res.json({ success: true, message: 'Đặt lại mật khẩu thành công!' });
    } catch (error) {
        console.error('Lỗi reset mật khẩu:', error);
        res.status(500).json({ success: false, message: 'Lỗi server!' });
    }
});

module.exports = router;