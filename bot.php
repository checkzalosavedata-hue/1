<?php
// bot.php
$globalConfigFile = __DIR__ . '/data/global_config.json';
$usersFile = __DIR__ . '/data/users.json';
$usersDir = __DIR__ . '/data/users';

function getGlobalToken() {
    global $globalConfigFile;
    $config = file_exists($globalConfigFile) ? json_decode(file_get_contents($globalConfigFile), true) : [];
    return $config['telegramToken'] ?? '';
}

function sendMessage($chatId, $text) {
    $token = getGlobalToken();
    if (empty($token) || $token === 'THAY_BANG_TOKEN_CHUNG_CUA_BAN') return;
    $url = "https://api.telegram.org/bot$token/sendMessage";
    $data = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'Markdown'];
    $options = ['http' => ['header' => "Content-type: application/x-www-form-urlencoded\r\n", 'method' => 'POST', 'content' => http_build_query($data)]];
    $context = stream_context_create($options);
    @file_get_contents($url, false, $context);
}

function getUpdates($offset) {
    $token = getGlobalToken();
    if (empty($token) || $token === 'THAY_BANG_TOKEN_CHUNG_CUA_BAN') return [];
    $url = "https://api.telegram.org/bot$token/getUpdates?offset=$offset&timeout=30";
    $response = @file_get_contents($url);
    if ($response) { $data = json_decode($response, true); return $data['result'] ?? []; }
    return [];
}

$lastUpdateId = 0;
$lastRemindedDay = ''; 

echo "Telegram Bot ĐA NGƯỜI DÙNG đang chạy...\n";

while (true) {
    $token = getGlobalToken();
    if (!empty($token) && $token !== 'THAY_BANG_TOKEN_CHUNG_CUA_BAN') {
        // 1. Nhận tin nhắn
        $updates = getUpdates($lastUpdateId + 1);
        foreach ($updates as $update) {
            $lastUpdateId = $update['update_id'];
            if (isset($update['message']['text'])) {
                $text = trim($update['message']['text']);
                $chatId = $update['message']['chat']['id'];
                
                // Xử lý /start <sync_code>
                if (preg_match('/^\/start\s+(\d+)$/', $text, $matches)) {
                    $code = (int)$matches[1];
                    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
                    $found = false;
                    foreach ($users as $u) {
                        if (isset($u['sync_code']) && $u['sync_code'] == $code) {
                            $userPath = "$usersDir/{$u['username']}";
                            $config = json_decode(file_get_contents("$userPath/config.json"), true);
                            $config['chatId'] = $chatId;
                            file_put_contents("$userPath/config.json", json_encode($config, JSON_PRETTY_PRINT));
                            sendMessage($chatId, "✅ Chào *{$u['username']}*! Tài khoản của bạn đã được kết nối thành công. Bạn sẽ nhận được nhắc nhở học từ vựng mỗi ngày vào lúc 8h sáng.");
                            $found = true; break;
                        }
                    }
                    if (!$found) sendMessage($chatId, "❌ Mã kết nối không hợp lệ. Vui lòng kiểm tra lại trên Website.");
                } else if ($text === '/hoc' || $text === '/start') {
                    // Tìm user theo Chat ID
                    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
                    $currentUser = null;
                    foreach ($users as $u) {
                        $userConfig = "$usersDir/{$u['username']}/config.json";
                        if (file_exists($userConfig)) {
                            $cfg = json_decode(file_get_contents($userConfig), true);
                            if (isset($cfg['chatId']) && $cfg['chatId'] == $chatId) {
                                $currentUser = $u; break;
                            }
                        }
                    }

                    if ($currentUser) {
                        if ($text === '/hoc') {
                            $words = json_decode(file_get_contents("$usersDir/{$currentUser['username']}/words.json"), true);
                            if (!empty($words)) {
                                $w = $words[array_rand($words)];
                                sendMessage($chatId, "📚 *Từ vựng cho bạn:*\n\n🇨🇳 *{$w['hanzi']}* ({$w['pinyin']})\n🇻🇳 Nghĩa: {$w['meaning']}");
                            } else sendMessage($chatId, "Bạn chưa thêm từ vựng nào!");
                        } else sendMessage($chatId, "Chào mừng quay lại! Gõ /hoc để nhận từ vựng.");
                    } else {
                        sendMessage($chatId, "Chào mừng! Hãy nhập `/start <mã_kết_nối>` để liên kết tài khoản của bạn.");
                    }
                }
            }
        }
        
        // 2. Nhắc nhở 8h sáng cho TẤT CẢ user
        $currentHour = (int)date('H');
        $today = date('Y-m-d');
        if ($currentHour == 8 && $lastRemindedDay !== $today) {
            $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
            foreach ($users as $u) {
                $userPath = "$usersDir/{$u['username']}";
                $config = json_decode(file_get_contents("$userPath/config.json"), true);
                if (isset($config['chatId'])) {
                    $words = json_decode(file_get_contents("$userPath/words.json"), true);
                    if (!empty($words)) {
                        $w = $words[array_rand($words)];
                        sendMessage($config['chatId'], "🔔 *Nhắc nhở học tập:*\n\n🇨🇳 *{$w['hanzi']}* ({$w['pinyin']})\n🇻🇳 Nghĩa: {$w['meaning']}");
                    }
                }
            }
            $lastRemindedDay = $today;
        }
    }
    sleep(2);
}
