<?php
$telegramToken = 'THAY_BANG_TOKEN_BOT_CUA_BAN';
$wordsFile = __DIR__ . '/data/words.json';
$configFile = __DIR__ . '/data/config.json';

function sendMessage($chatId, $text) {
    global $telegramToken;
    $url = "https://api.telegram.org/bot$telegramToken/sendMessage";
    $data = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'Markdown'];
    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data)
        ]
    ];
    $context  = stream_context_create($options);
    @file_get_contents($url, false, $context);
}

function getUpdates($offset) {
    global $telegramToken;
    $url = "https://api.telegram.org/bot$telegramToken/getUpdates?offset=$offset&timeout=30";
    $response = @file_get_contents($url);
    if ($response) {
        $data = json_decode($response, true);
        return $data['result'] ?? [];
    }
    return [];
}

$lastUpdateId = 0;
$lastRemindedDay = ''; // Bắt đầu trống để có thể nhắc ngay nếu đến giờ

echo "Telegram Bot (PHP) đang chạy...\n";
if ($telegramToken === 'THAY_BANG_TOKEN_BOT_CUA_BAN') {
    echo "⚠️ Vui lòng cập nhật TELEGRAM_TOKEN trong bot.php để sử dụng bot.\n";
}

while (true) {
    if ($telegramToken !== 'THAY_BANG_TOKEN_BOT_CUA_BAN') {
        // 1. Nhận tin nhắn mới
        $updates = getUpdates($lastUpdateId + 1);
        foreach ($updates as $update) {
            $lastUpdateId = $update['update_id'];
            if (isset($update['message']['text'])) {
                $text = $update['message']['text'];
                $chatId = $update['message']['chat']['id'];
                
                if ($text === '/start') {
                    $config = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : [];
                    $config['chatId'] = $chatId;
                    file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
                    sendMessage($chatId, "Tuyệt vời! Tôi sẽ gửi lời nhắc học từ vựng cho bạn mỗi ngày. Gõ /hoc để nhận một từ ngay bây giờ.");
                } else if ($text === '/hoc') {
                    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];
                    if (count($words) > 0) {
                        $word = $words[array_rand($words)];
                        $msg = "📚 *Từ vựng hôm nay:*\n\n🇨🇳 Chữ Hán: {$word['hanzi']}\n🔊 Pinyin: {$word['pinyin']}\n🇻🇳 Nghĩa: {$word['meaning']}\n\nHãy vào web để ôn tập thêm nhé!";
                        sendMessage($chatId, $msg);
                    }
                }
            }
        }
        
        // 2. Cron job (Nhắc nhở lúc 8h sáng)
        $currentHour = (int)date('H');
        $today = date('Y-m-d');
        if ($currentHour == 8 && $lastRemindedDay !== $today) {
            $config = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : [];
            if (isset($config['chatId'])) {
                $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];
                if (count($words) > 0) {
                    $word = $words[array_rand($words)];
                    $msg = "🔔 *Nhắc nhở học tập mỗi ngày:*\n\n🇨🇳 Chữ Hán: {$word['hanzi']}\n🔊 Pinyin: {$word['pinyin']}\n🇻🇳 Nghĩa: {$word['meaning']}";
                    sendMessage($config['chatId'], $msg);
                }
            }
            $lastRemindedDay = $today;
        }
    }
    sleep(2);
}
