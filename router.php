<?php
// router.php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if ($uri !== '/' && file_exists(__DIR__ . '/public' . $uri)) {
    return false; // serve the requested resource as-is
} else if (preg_match('/^\/api\/words/', $uri)) {
    include __DIR__ . '/api.php';
} else {
    include __DIR__ . '/public/index.html';
}
