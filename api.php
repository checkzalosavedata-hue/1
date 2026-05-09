<?php
// api.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$usersFile = __DIR__ . '/data/users.json';
$globalConfigFile = __DIR__ . '/data/global_config.json';

header('Content-Type: application/json');
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$method = $_SERVER['REQUEST_METHOD'];

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
    if (empty($username) || empty($password)) { echo json_encode(['error' => 'Vui lòng điền đủ']); exit; }
    $users = file_exists($usersFile) ? json_decode(file_get_contents($usersFile), true) : [];
    foreach ($users as $u) if ($u['username'] === $username) { echo json_encode(['error' => 'Tên đã tồn tại']); exit; }
    $newUser = [
        'id' => count($users) + 1,
        'username' => $username,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'sync_code' => rand(100000, 999999)
    ];
    $users[] = $newUser;
    file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT));
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
    http_response_code(401); echo json_encode(['error' => 'Sai tài khoản/mật khẩu']); exit;
}

if ($uri === '/api/auth/logout') { session_destroy(); echo json_encode(['success' => true]); exit; }

if ($uri === '/api/auth/reset' && $method === 'POST') {
    if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
    $username = $_SESSION['user']['username'];
    $userPath = __DIR__ . "/data/users/$username";
    if (file_exists("$userPath/words.json")) file_put_contents("$userPath/words.json", "[]");
    if (file_exists("$userPath/config.json")) {
        $config = json_decode(file_get_contents("$userPath/config.json"), true);
        $config['chatId'] = null;
        file_put_contents("$userPath/config.json", json_encode($config));
    }
    echo json_encode(['success' => true]);
    exit;
}

// 2. TRANSLATE API
if ($uri === '/api/translate') {
    $q = $_GET['q'] ?? '';
    if (empty($q)) { echo json_encode(['pinyin' => '', 'meaning' => '']); exit; }
    
    // Sử dụng sl=auto để Google tự nhận diện
    $url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&dt=rm&q=" . urlencode($q);
    $response = @file_get_contents($url);
    
    if ($response) {
        $data = json_decode($response, true);
        $detectedLang = $data[2] ?? 'zh-CN'; // Ngôn ngữ nguồn phát hiện được
        
        $meaning = ''; 
        foreach ($data[0] as $item) if ($item[0]) $meaning .= $item[0];
        
        $pinyin = '';
        if (isset($data[0]) && is_array($data[0])) {
            foreach ($data[0] as $item) {
                if (isset($item[2]) && $item[0] === null) { $pinyin = $item[2]; break; }
                if (isset($item[3]) && is_string($item[3])) $pinyin = $item[3];
            }
        }
        
        // Nếu phát hiện là tiếng Việt, ta cần dịch lại sang tiếng Trung để lấy Hanzi
        if ($detectedLang === 'vi') {
            $urlZh = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=zh-CN&dt=t&dt=rm&q=" . urlencode($q);
            $resZh = json_decode(@file_get_contents($urlZh), true);
            $hanzi = ''; foreach ($resZh[0] as $item) if ($item[0]) $hanzi .= $item[0];
            $pinyinZh = '';
            foreach ($resZh[0] as $item) {
                if (isset($item[2]) && $item[0] === null) { $pinyinZh = $item[2]; break; }
                if (isset($item[3]) && is_string($item[3])) $pinyinZh = $item[3];
            }
            echo json_encode([
                'hanzi' => trim($hanzi), 
                'pinyin' => trim($pinyinZh),
                'meaning' => $q
            ]);
        } else {
            // Là tiếng Trung hoặc ngôn ngữ khác -> Dịch sang tiếng Việt
            echo json_encode(['meaning' => trim($meaning), 'pinyin' => trim($pinyin)]);
        }
    } else { http_response_code(500); echo json_encode(['error' => 'API failed']); }
    exit;
}

// 3. PROTECTED APIs
if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
$userPath = getUserDataPath();
$wordsFile = "$userPath/words.json";
$userConfigFile = "$userPath/config.json";

// Handle /api/config
if ($uri === '/api/config') {
    $config = file_exists($userConfigFile) ? json_decode(file_get_contents($userConfigFile), true) : [];
    if ($method === 'GET') echo json_encode(['chatId' => $config['chatId'] ?? null, 'sync_code' => $config['sync_code'] ?? null]);
    exit;
}

// Handle /api/words
if (strpos($uri, '/api/words') === 0) {
    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];

    if ($method === 'GET') {
        echo json_encode($words);
    } else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $newWord = [
            'id' => count($words) > 0 ? max(array_column($words, 'id')) + 1 : 1,
            'hanzi' => $input['hanzi'] ?? '',
            'pinyin' => $input['pinyin'] ?? '',
            'meaning' => $input['meaning'] ?? '',
            'hsk_level' => $input['hsk_level'] ?? 'None',
            'is_learned' => false,
            'created_at' => date('Y-m-d H:i:s'),
            'study_count' => 0
        ];
        $words[] = $newWord;
        file_put_contents($wordsFile, json_encode($words, JSON_PRETTY_PRINT));
        http_response_code(201); echo json_encode($newWord);
    } else if ($method === 'PATCH') {
        $id = (int)str_replace('/api/words/', '', $uri);
        $input = json_decode(file_get_contents('php://input'), true);
        foreach ($words as &$w) {
            if ($w['id'] === $id) {
                if (isset($input['is_learned'])) $w['is_learned'] = (bool)$input['is_learned'];
                if (isset($input['increment_study'])) $w['study_count'] = ($w['study_count'] ?? 0) + 1;
                $w['last_studied_at'] = date('Y-m-d H:i:s');
                break;
            }
        }
        file_put_contents($wordsFile, json_encode($words, JSON_PRETTY_PRINT));
        echo json_encode(['success' => true]);
    } else if ($method === 'DELETE') {
        $hsk = $_GET['hsk'] ?? null;
        if ($hsk) {
            if ($hsk === 'All') {
                $words = [];
            } else {
                $words = array_filter($words, function($w) use ($hsk) { return ($w['hsk_level'] ?? 'None') !== $hsk; });
            }
            file_put_contents($wordsFile, json_encode(array_values($words), JSON_PRETTY_PRINT));
            echo json_encode(['success' => true]);
        } else {
            $id = (int)str_replace('/api/words/', '', $uri);
            $words = array_filter($words, function($w) use ($id) { return $w['id'] !== $id; });
            file_put_contents($wordsFile, json_encode(array_values($words), JSON_PRETTY_PRINT));
            echo json_encode(['success' => true]);
        }
        exit;
    }
    exit;
}

http_response_code(404); echo json_encode(['error' => 'Not found']);
