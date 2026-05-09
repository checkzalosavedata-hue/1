<?php
// api.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$usersFile = __DIR__ . '/data/users.json';
$globalConfigFile = __DIR__ . '/data/global_config.json'; // Chứa Bot Token chung

header('Content-Type: application/json');
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$method = $_SERVER['REQUEST_METHOD'];

// Helper: Lấy dữ liệu user hiện tại
function getUserDataPath() {
    if (!isset($_SESSION['user'])) return null;
    $username = $_SESSION['user']['username'];
    $path = __DIR__ . "/data/users/$username";
    if (!file_exists($path)) mkdir($path, 0777, true);
    return $path;
}

// 1. AUTH APIs
if ($uri === '/api/auth/register') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['error' => 'Vui lòng điền đủ tên và mật khẩu']); exit;
    }

    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
    foreach ($users as $u) {
        if ($u['username'] === $username) {
            echo json_encode(['error' => 'Tên người dùng đã tồn tại']); exit;
        }
    }

    $newUser = [
        'id' => count($users) + 1,
        'username' => $username,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'sync_code' => rand(100000, 999999) // Mã kết nối Telegram
    ];
    $users[] = $newUser;
    file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));

    // Tạo thư mục dữ liệu ban đầu cho user
    $userPath = __DIR__ . "/data/users/$username";
    if (!file_exists($userPath)) mkdir($userPath, 0777, true);
    file_put_contents("$userPath/words.json", "[]");
    file_put_contents("$userPath/config.json", json_encode(['chatId' => null, 'sync_code' => $newUser['sync_code']]));

    echo json_encode(['success' => true]);
    exit;
}

if ($uri === '/api/auth/login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
    foreach ($users as $u) {
        if ($u['username'] === $username && password_verify($password, $u['password'])) {
            $_SESSION['user'] = ['id' => $u['id'], 'username' => $u['username']];
            echo json_encode(['success' => true]);
            exit;
        }
    }
    http_response_code(401);
    echo json_encode(['error' => 'Tài khoản hoặc mật khẩu không đúng']);
    exit;
}

if ($uri === '/api/auth/logout') {
    session_destroy();
    echo json_encode(['success' => true]);
    exit;
}

// 2. TRANSLATE API (Public or Auth)
if ($uri === '/api/translate') {
    $q = urlencode($_GET['q'] ?? '');
    if (empty($q)) { echo json_encode(['pinyin' => '', 'meaning' => '']); exit; }
    $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&dt=rm&q=$q";
    $response = @file_get_contents($url);
    if ($response) {
        $data = json_decode($response, true);
        $meaning = ''; foreach ($data[0] as $item) if ($item[0]) $meaning .= $item[0];
            $pinyin = '';
            if (isset($data[0]) && is_array($data[0])) {
                foreach ($data[0] as $item) {
                    // Pinyin (transliteration) thường nằm ở vị trí index 2 hoặc 3 của một mảng mà index 0, 1 là null
                    if (isset($item[2]) && $item[0] === null && $item[1] === null) {
                        $pinyin = $item[2];
                        break;
                    }
                    // Trường hợp khác: nằm ở cuối mảng của item đầu tiên
                    if (isset($item[3]) && is_string($item[3])) {
                        $pinyin = $item[3];
                    }
                }
                // Fallback nếu vẫn không thấy
                if (empty($pinyin)) {
                    $last = end($data[0]);
                    if (isset($last[2])) $pinyin = $last[2];
                    else if (isset($last[3])) $pinyin = $last[3];
                }
            }
            echo json_encode(['meaning' => trim($meaning), 'pinyin' => trim($pinyin)]);
    } else {
        http_response_code(500); echo json_encode(['error' => 'API failed']);
    }
    exit;
}

// 3. USER SPECIFIC APIs (Requires Login)
if (!isset($_SESSION['user'])) {
    http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit;
}

$userPath = getUserDataPath();
$wordsFile = "$userPath/words.json";
$userConfigFile = "$userPath/config.json";

// Handle /api/config
if ($uri === '/api/config') {
    $config = file_exists($userConfigFile) ? json_decode(file_get_contents($userConfigFile), true) : [];
    if ($method === 'GET') {
        echo json_encode([
            'chatId' => $config['chatId'] ?? null,
            'sync_code' => $config['sync_code'] ?? null
        ]);
    } else if ($method === 'POST') {
        // Chỉ cho phép admin hoặc file hệ thống sửa global_config.
        // User bình thường chỉ lưu sync_code của họ
    }
    exit;
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
