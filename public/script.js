let words = [];
let currentFlashcardIndex = 0;
let currentQuizWord = null;

// DOM Elements
const flashcard = document.getElementById('flashcard');
const hanziText = document.getElementById('hanziText');
const pinyinText = document.getElementById('pinyinText');
const meaningText = document.getElementById('meaningText');
const toastContainer = document.getElementById('toastContainer');

// --- APP INIT ---
document.addEventListener('DOMContentLoaded', () => {
    fetchWords();
    fetchConfig();
    setupTabs();
    setupTheme();
    setupModal();
    
    // Flashcard events
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
    document.getElementById('nextBtn').addEventListener('click', () => changeFlashcard(1));
    document.getElementById('prevBtn').addEventListener('click', () => changeFlashcard(-1));
    document.getElementById('randomBtn').addEventListener('click', () => {
        if(words.length > 0) {
            currentFlashcardIndex = Math.floor(Math.random() * words.length);
            displayFlashcard();
        }
    });

    // Form events
    document.getElementById('addWordForm').addEventListener('submit', addWord);
    document.getElementById('telegramForm').addEventListener('submit', saveTelegramToken);
    document.getElementById('nextQuizBtn').addEventListener('click', generateQuiz);
});

// --- API FETCH ---
async function fetchWords() {
    try {
        const res = await fetch('/api/words');
        words = await res.json();
        renderDictionary();
        if (words.length > 0) displayFlashcard();
        else setEmptyFlashcard();
    } catch (e) { showToast("Lỗi tải dữ liệu", "error"); }
}

async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        const statusBox = document.getElementById('tgStatus');
        if (config.hasToken) {
            statusBox.innerHTML = `<span style="color:var(--secondary)"><i class="fas fa-check-circle"></i> Token đã được lưu.</span>` + 
                                  (config.chatId ? ` Đã kết nối với Chat ID: ${config.chatId}` : ' Đang chờ bạn chat /start với Bot.');
        } else {
            statusBox.innerHTML = `<span style="color:var(--primary)"><i class="fas fa-exclamation-circle"></i> Chưa cấu hình Token.</span>`;
        }
    } catch (e) { console.error(e); }
}

// --- TABS (SPA) ---
function setupTabs() {
    document.querySelectorAll('.nav-links li').forEach(nav => {
        nav.addEventListener('click', () => {
            // Remove active from all navs & panes
            document.querySelectorAll('.nav-links li').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            // Add active to clicked nav & matching pane
            nav.classList.add('active');
            const targetTab = nav.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if(targetTab === 'quiz') generateQuiz();
        });
    });
}

// --- THEME ---
function setupTheme() {
    const btn = document.getElementById('themeToggle');
    const isDark = localStorage.getItem('darkMode') === 'true';
    if(isDark) document.body.classList.add('dark-mode');
    
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
}

// --- AUDIO TTS ---
function playAudio() {
    const text = hanziText.textContent;
    if (!text || text === '加载') return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
}

// --- FLASHCARD ---
function setEmptyFlashcard() {
    hanziText.textContent = "N/A";
    pinyinText.textContent = "-";
    meaningText.textContent = "Chưa có từ vựng";
}

function displayFlashcard() {
    if (words.length === 0) return setEmptyFlashcard();
    
    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
        setTimeout(() => updateCardUI(), 300);
    } else {
        updateCardUI();
    }
}

function updateCardUI() {
    const word = words[currentFlashcardIndex];
    hanziText.textContent = word.hanzi;
    pinyinText.textContent = word.pinyin;
    meaningText.textContent = word.meaning;
}

function changeFlashcard(direction) {
    if (words.length === 0) return;
    currentFlashcardIndex += direction;
    if (currentFlashcardIndex >= words.length) currentFlashcardIndex = 0;
    if (currentFlashcardIndex < 0) currentFlashcardIndex = words.length - 1;
    displayFlashcard();
}

// --- DICTIONARY ---
function renderDictionary() {
    const tbody = document.getElementById('dictTableBody');
    const emptyState = document.getElementById('emptyDict');
    const table = document.querySelector('.dict-table');
    
    tbody.innerHTML = '';
    if (words.length === 0) {
        emptyState.classList.remove('hidden');
        table.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    table.classList.remove('hidden');

    words.forEach(word => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="hanzi-col">${word.hanzi}</td>
            <td>${word.pinyin}</td>
            <td>${word.meaning}</td>
            <td>
                <button class="btn-icon listen" onclick="speakWord('${word.hanzi}')" title="Nghe"><i class="fas fa-volume-up"></i></button>
                <button class="btn-icon delete" onclick="deleteWord(${word.id})" title="Xóa"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function speakWord(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.getElementById('dictTableBody').querySelectorAll('tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
});

// --- ADD WORD MODAL ---
function setupModal() {
    const modal = document.getElementById('addWordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', () => modal.classList.add('active'));
    document.getElementById('closeModalBtn').addEventListener('click', () => modal.classList.remove('active'));
}

async function addWord(e) {
    e.preventDefault();
    const newWord = {
        hanzi: document.getElementById('newHanzi').value,
        pinyin: document.getElementById('newPinyin').value,
        meaning: document.getElementById('newMeaning').value
    };

    try {
        const res = await fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newWord)
        });
        if(res.ok) {
            const w = await res.json();
            words.push(w);
            renderDictionary();
            if(words.length === 1) displayFlashcard(); // Init if first word
            
            document.getElementById('addWordForm').reset();
            document.getElementById('addWordModal').classList.remove('active');
            showToast("Đã thêm từ mới!", "success");
        }
    } catch(err) { showToast("Lỗi thêm từ", "error"); }
}

async function deleteWord(id) {
    if(!confirm("Bạn có chắc muốn xóa từ này?")) return;
    try {
        const res = await fetch(`/api/words/${id}`, { method: 'DELETE' });
        if(res.ok) {
            words = words.filter(w => w.id !== id);
            renderDictionary();
            currentFlashcardIndex = 0;
            displayFlashcard();
            showToast("Đã xóa từ vựng", "success");
        }
    } catch(e) { showToast("Lỗi xóa từ", "error"); }
}

// --- QUIZ ---
function generateQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    const quizError = document.getElementById('quizError');
    const optionsContainer = document.getElementById('quizOptions');
    const statusText = document.getElementById('quizStatus');
    const nextBtn = document.getElementById('nextQuizBtn');

    if (words.length < 4) {
        quizContainer.classList.add('hidden');
        quizError.classList.remove('hidden');
        return;
    }
    quizContainer.classList.remove('hidden');
    quizError.classList.add('hidden');
    nextBtn.classList.add('hidden');
    statusText.textContent = '';
    
    // Choose correct word
    currentQuizWord = words[Math.floor(Math.random() * words.length)];
    document.getElementById('quizHanzi').textContent = currentQuizWord.hanzi;
    document.getElementById('quizPinyin').textContent = currentQuizWord.pinyin;

    // Generate 3 wrong options
    let options = [currentQuizWord.meaning];
    while(options.length < 4) {
        let randomW = words[Math.floor(Math.random() * words.length)];
        if(!options.includes(randomW.meaning)) options.push(randomW.meaning);
    }
    
    // Shuffle options
    options.sort(() => Math.random() - 0.5);

    optionsContainer.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => checkQuizAnswer(btn, opt);
        optionsContainer.appendChild(btn);
    });
}

function checkQuizAnswer(btn, selectedMeaning) {
    const statusText = document.getElementById('quizStatus');
    const optionsContainer = document.getElementById('quizOptions');
    const nextBtn = document.getElementById('nextQuizBtn');
    
    // Disable all options
    Array.from(optionsContainer.children).forEach(b => b.style.pointerEvents = 'none');

    if (selectedMeaning === currentQuizWord.meaning) {
        btn.classList.add('correct');
        statusText.innerHTML = '<span style="color:var(--secondary)">🎉 Chính xác!</span>';
        
        // Firework effect (simple)
        showToast("Giỏi quá!", "success");
    } else {
        btn.classList.add('wrong');
        statusText.innerHTML = `<span style="color:var(--primary)">❌ Sai rồi. Nghĩa đúng là: ${currentQuizWord.meaning}</span>`;
        // Highlight correct option
        Array.from(optionsContainer.children).forEach(b => {
            if(b.textContent === currentQuizWord.meaning) b.classList.add('correct');
        });
    }
    
    nextBtn.classList.remove('hidden');
}

// --- SETTINGS ---
async function saveTelegramToken(e) {
    e.preventDefault();
    const token = document.getElementById('tgToken').value;
    if(!token) return;

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramToken: token })
        });
        if(res.ok) {
            showToast("Đã lưu Token thành công!", "success");
            fetchConfig(); // Refresh status
            document.getElementById('tgToken').value = '';
        }
    } catch(err) { showToast("Lỗi lưu cấu hình", "error"); }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
