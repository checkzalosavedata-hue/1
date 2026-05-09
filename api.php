<?php
$wordsFile = __DIR__ . '/data/words.json';
$configFile = __DIR__ . '/data/config.json';

header('Content-Type: application/json');
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$method = $_SERVER['REQUEST_METHOD'];

// Handle /api/config
if ($uri === '/api/config') {
    if ($method === 'GET') {
        $config = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : [];
        // Xóa Token để bảo mật, chỉ trả về cờ để biết đã có token hay chưa
        $hasToken = !empty($config['telegramToken']) && $config['telegramToken'] !== 'THAY_BANG_TOKEN_BOT_CUA_BAN';
        echo json_encode(['hasToken' => $hasToken, 'chatId' => $config['chatId'] ?? null]);
        exit;
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $config = file_exists($configFile) ? json_decode(file_get_contents($configFile), true) : [];
        $config['telegramToken'] = $input['telegramToken'] ?? $config['telegramToken'] ?? '';
        file_put_contents($configFile, json_encode($config, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        exit;
    }
}

// Handle /api/words
if (strpos($uri, '/api/words') === 0) {
    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];

    if ($method === 'GET') {
        echo json_encode($words);
        exit;
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $newId = count($words) > 0 ? max(array_column($words, 'id')) + 1 : 1;
        $newWord = [
            'id' => $newId,
            'hanzi' => $input['hanzi'] ?? '',
            'pinyin' => $input['pinyin'] ?? '',
            'meaning' => $input['meaning'] ?? ''
        ];
        $words[] = $newWord;
        file_put_contents($wordsFile, json_encode($words, JSON_PRETTY_PRINT));
        http_response_code(201);
        echo json_encode($newWord);
        exit;
    } else if ($method === 'DELETE') {
        $id = (int)str_replace('/api/words/', '', $uri);
        $words = array_filter($words, function($w) use ($id) { return $w['id'] !== $id; });
        file_put_contents($wordsFile, json_encode(array_values($words), JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
        exit;
    }
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
