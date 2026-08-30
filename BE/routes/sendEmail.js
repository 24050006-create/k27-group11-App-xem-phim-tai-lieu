const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1) Tạo một transporter (dịch vụ sẽ gửi email, ví dụ: Gmail, SendGrid, Mailtrap)
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // 2) Định nghĩa các tùy chọn email
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"TàiLiệu" <noreply@tailieu.app>',
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    // 3) Gửi email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;