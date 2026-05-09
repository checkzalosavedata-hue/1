<?php
$wordsFile = __DIR__ . '/data/words.json';
$configFile = __DIR__ . '/data/config.json';

function getToken() {
    global $configFile;
    $config = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : [];
    return $config['telegramToken'] ?? '';
}

function sendMessage($chatId, $text) {
    $token = getToken();
    if (empty($token)) return;
    $url = "https://api.telegram.org/bot$token/sendMessage";
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
    $token = getToken();
    if (empty($token)) return [];
    $url = "https://api.telegram.org/bot$token/getUpdates?offset=$offset&timeout=30";
    $response = @file_get_contents($url);
    if ($response) {
        $data = json_decode($response, true);
        return $data['result'] ?? [];
    }
    return [];
}

$lastUpdateId = 0;
$lastRemindedDay = ''; 

echo "Telegram Bot (PHP) đang chạy chờ Token từ Web...\n";

while (true) {
    $token = getToken();
    if (!empty($token) && $token !== 'THAY_BANG_TOKEN_BOT_CUA_BAN') {
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
                    sendMessage($chatId, "Tuyệt vời! Tôi sẽ gửi lời nhắc học từ vựng cho bạn mỗi ngày.\nCác lệnh hỗ trợ:\n/hoc - Nhận 1 từ ngẫu nhiên\n/quiz - Làm bài trắc nghiệm");
                } else if ($text === '/hoc') {
                    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];
                    if (count($words) > 0) {
                        $word = $words[array_rand($words)];
                        $msg = "📚 *Từ vựng hôm nay:*\n\n🇨🇳 Chữ Hán: {$word['hanzi']}\n🔊 Pinyin: {$word['pinyin']}\n🇻🇳 Nghĩa: {$word['meaning']}\n\nHãy vào web để ôn tập thêm nhé!";
                        sendMessage($chatId, $msg);
                    } else {
                        sendMessage($chatId, "Bạn chưa thêm từ vựng nào vào danh sách!");
                    }
                } else if ($text === '/quiz') {
                    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];
                    if (count($words) >= 4) {
                        $word = $words[array_rand($words)];
                        $msg = "🧠 *Câu hỏi Quiz:*\n\nTừ này có nghĩa là gì?\n🇨🇳 *{$word['hanzi']}* ({$word['pinyin']})\n\n(Chức năng trả lời trực tiếp trên Telegram sẽ được cập nhật sau. Hãy tự nhẩm nghĩa trong đầu nhé!)";
                        sendMessage($chatId, $msg);
                    } else {
                        sendMessage($chatId, "Bạn cần thêm ít nhất 4 từ vựng để chơi Quiz!");
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
