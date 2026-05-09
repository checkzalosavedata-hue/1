<?php
$wordsFile = __DIR__ . '/data/words.json';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($wordsFile)) {
        echo file_get_contents($wordsFile);
    } else {
        echo '[]';
    }
} else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $words = file_exists($wordsFile) ? json_decode(file_get_contents($wordsFile), true) : [];
    
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
}
