<?php
// router.php
session_start();
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Các API không cần đăng nhập
$public_api = ['/api/auth/login', '/api/auth/register'];

// Nếu chưa đăng nhập và cố tình vào các trang chính hoặc API quan trọng
if (!isset($_SESSION['user']) && !in_array($uri, $public_api)) {
    if (strpos($uri, '/api/') === 0) {
        // Trả về lỗi 401 nếu là API
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    } else if ($uri === '/' || $uri === '/index.html') {
        // Chuyển hướng về login nếu là trang chủ
        include __DIR__ . '/public/login.html';
        exit;
    }
}

// Serve static files from /public
if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    $file = __DIR__ . '/public' . $uri;
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    $mimeTypes = [
        'css' => 'text/css',
        'js'  => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'html' => 'text/html'
    ];
    if (isset($mimeTypes[$ext])) {
        header('Content-Type: ' . $mimeTypes[$ext]);
    }
    readfile($file);
    exit;
} else if (preg_match('/^\/api\//', $uri)) {
    include __DIR__ . '/api.php';
} else {
    // Mặc định là trang chủ (đã check đăng nhập ở trên)
    include __DIR__ . '/public/index.html';
}
