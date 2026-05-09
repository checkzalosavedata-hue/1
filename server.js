const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Thay thế bằng Token Bot Telegram của bạn
const TELEGRAM_TOKEN = 'THAY_BANG_TOKEN_BOT_CUA_BAN';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const wordsFilePath = path.join(__dirname, 'data', 'words.json');
const configFilePath = path.join(__dirname, 'data', 'config.json');

// Khởi tạo Bot
let bot = null;
try {
  if (TELEGRAM_TOKEN !== 'THAY_BANG_TOKEN_BOT_CUA_BAN') {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    
    // Lắng nghe lệnh /start để lưu chatId
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      config.chatId = chatId;
      fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
      bot.sendMessage(chatId, "Tuyệt vời! Tôi sẽ gửi lời nhắc học từ vựng tiếng Trung cho bạn mỗi ngày. Bạn có thể gõ /hoc để nhận một từ ngẫu nhiên ngay bây giờ.");
    });

    bot.onText(/\/hoc/, (msg) => {
      const chatId = msg.chat.id;
      sendRandomWord(chatId);
    });
  } else {
    console.log("⚠️ Vui lòng cập nhật TELEGRAM_TOKEN trong server.js để sử dụng tính năng nhắc nhở.");
  }
} catch (err) {
  console.log("Lỗi khởi tạo bot:", err.message);
}

// Hàm lấy từ vựng ngẫu nhiên
function sendRandomWord(chatId) {
  try {
    const words = JSON.parse(fs.readFileSync(wordsFilePath, 'utf8'));
    if (words.length > 0) {
      const randomWord = words[Math.floor(Math.random() * words.length)];
      const message = `📚 **Từ vựng hôm nay:**\n\n🇨🇳 Chữ Hán: ${randomWord.hanzi}\n🔊 Pinyin: ${randomWord.pinyin}\n🇻🇳 Nghĩa: ${randomWord.meaning}\n\nHãy vào web để ôn tập thêm nhé!`;
      bot.sendMessage(chatId, message);
    }
  } catch (err) {
    console.error("Lỗi đọc file words.json:", err);
  }
}

// Cron job: Gửi lời nhắc mỗi ngày lúc 8:00 sáng
cron.schedule('0 8 * * *', () => {
  try {
    const config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
    if (config.chatId && bot) {
      sendRandomWord(config.chatId);
    }
  } catch (err) {
    console.error("Lỗi Cron Job:", err);
  }
});

// API Lấy danh sách từ
app.get('/api/words', (req, res) => {
  try {
    const words = JSON.parse(fs.readFileSync(wordsFilePath, 'utf8'));
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi đọc dữ liệu' });
  }
});

// API Thêm từ mới
app.post('/api/words', (req, res) => {
  try {
    const newWord = req.body;
    const words = JSON.parse(fs.readFileSync(wordsFilePath, 'utf8'));
    
    // Tạo ID mới
    const newId = words.length > 0 ? Math.max(...words.map(w => w.id)) + 1 : 1;
    const wordToAdd = {
      id: newId,
      hanzi: newWord.hanzi,
      pinyin: newWord.pinyin,
      meaning: newWord.meaning
    };
    
    words.push(wordToAdd);
    fs.writeFileSync(wordsFilePath, JSON.stringify(words, null, 2));
    
    res.status(201).json(wordToAdd);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lưu dữ liệu' });
  }
});

// Chạy server
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
