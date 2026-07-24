const { Expo } = require('expo-server-sdk');
const db = require('../config/db');

// Tạo một instance của Expo SDK
let expo = new Expo();

async function sendPushNotification(targetExpoPushToken, message, data = {}) {
    // Kiểm tra xem token có hợp lệ không
    if (!Expo.isExpoPushToken(targetExpoPushToken)) {
        console.error(`Push token ${targetExpoPushToken} is not a valid Expo push token`);
        return;
    }

    // Tạo thông báo
    let messages = [{
        to: targetExpoPushToken,
        sound: 'default',
        body: message,
        data: data,
    }];

    // Gửi thông báo
    try {
        let ticketChunk = await expo.sendPushNotificationsAsync(messages);
        console.log('Notification ticket:', ticketChunk);
        // Bạn có thể lưu ticket này vào DB để kiểm tra trạng thái sau này nếu cần
    } catch (error) {
        console.error(`Error sending push notification to ${targetExpoPushToken}:`, error);
    }
}

async function sendNewMovieNotification(movieTitle, movieId) {
    // Lấy tất cả các push token từ người dùng đã bật thông báo
    const [users] = await db.query('SELECT push_token FROM users WHERE push_token IS NOT NULL');
    for (const user of users) {
        if (user.push_token) {
            await sendPushNotification(user.push_token, `Phim mới: ${movieTitle} đã có!`, { movieId: movieId, type: 'new_movie' });
        }
    }
}

module.exports = { sendPushNotification, sendNewMovieNotification };