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
    document.getElementById('markLearnedBtn').addEventListener('click', markAsLearned);
    document.getElementById('randomBtn').addEventListener('click', () => {
        const unlearned = words.filter(w => !w.is_learned);
        if(unlearned.length > 0) {
            const randomWord = unlearned[Math.floor(Math.random() * unlearned.length)];
            currentFlashcardIndex = words.indexOf(randomWord);
            displayFlashcard();
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        const res = await fetch('/api/auth/logout');
        if(res.ok) window.location.reload();
    });

    document.getElementById('addWordForm').addEventListener('submit', addWord);
    document.getElementById('nextQuizBtn').addEventListener('click', generateQuiz);
});

// --- API FETCH ---
async function fetchWords() {
    try {
        const res = await fetch('/api/words');
        if (res.status === 401) return window.location.reload();
        words = await res.json();
        renderDictionary();
        renderProgress();
        if (getUnlearnedWords().length > 0) {
            currentFlashcardIndex = words.indexOf(getUnlearnedWords()[0]);
            displayFlashcard();
        } else {
            setEmptyFlashcard();
        }
    } catch (e) { showToast("Lỗi tải dữ liệu", "error"); }
}

function getUnlearnedWords() {
    return words.filter(w => !w.is_learned);
}

async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        document.getElementById('syncCodeDisplay').textContent = config.sync_code || '------';
        document.getElementById('syncCodeHint').textContent = config.sync_code || 'mã_của_bạn';
        document.getElementById('botNameDisplay').textContent = '@HanziReminderBot'; 
        const statusBox = document.getElementById('tgStatus');
        statusBox.innerHTML = config.chatId ? 
            `<span style="color:var(--secondary)"><i class="fas fa-check-circle"></i> Đã kết nối Telegram!</span>` : 
            `<span style="color:var(--text-light)">Chưa kết nối Telegram. Hãy nhắn mã trên cho Bot.</span>`;
    } catch (e) { console.error(e); }
}

// --- TABS ---
function setupTabs() {
    document.querySelectorAll('.nav-links li').forEach(nav => {
        if(nav.id === 'logoutBtn') return;
        nav.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            nav.classList.add('active');
            const targetTab = nav.getAttribute('data-tab');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            if(targetTab === 'quiz') generateQuiz();
            if(targetTab === 'progress') renderProgress();
            if(targetTab === 'dictionary') renderDictionary();
        });
    });
}

// --- THEME ---
function setupTheme() {
    const btn = document.getElementById('themeToggle');
    if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
}

// --- AUDIO ---
function speakWord(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
}

// --- FLASHCARD ---
function setEmptyFlashcard() {
    hanziText.textContent = "N/A";
    pinyinText.textContent = "-";
    meaningText.textContent = "Đã hết từ cần học!";
}

function displayFlashcard() {
    const unlearned = getUnlearnedWords();
    if (unlearned.length === 0) return setEmptyFlashcard();
    
    // Đảm bảo index hợp lệ
    if (currentFlashcardIndex < 0 || currentFlashcardIndex >= words.length || words[currentFlashcardIndex].is_learned) {
        currentFlashcardIndex = words.indexOf(unlearned[0]);
    }

    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
        setTimeout(() => updateCardUI(), 300);
    } else {
        updateCardUI();
    }
}

async function updateCardUI() {
    const word = words[currentFlashcardIndex];
    if(!word) return;
    hanziText.textContent = word.hanzi;
    pinyinText.textContent = word.pinyin;
    meaningText.textContent = word.meaning;
    
    // Tăng số lần ôn tập
    fetch(`/api/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment_study: true })
    });
}

function changeFlashcard(direction) {
    const unlearned = getUnlearnedWords();
    if (unlearned.length === 0) return;
    
    let idx = unlearned.indexOf(words[currentFlashcardIndex]);
    idx += direction;
    if (idx >= unlearned.length) idx = 0;
    if (idx < 0) idx = unlearned.length - 1;
    
    currentFlashcardIndex = words.indexOf(unlearned[idx]);
    displayFlashcard();
}

async function markAsLearned() {
    const word = words[currentFlashcardIndex];
    if(!word) return;
    try {
        const res = await fetch(`/api/words/${word.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_learned: true })
        });
        if(res.ok) {
            word.is_learned = true;
            showToast(`Đã thuộc từ: ${word.hanzi}`, "success");
            const unlearned = getUnlearnedWords();
            if(unlearned.length > 0) {
                currentFlashcardIndex = words.indexOf(unlearned[0]);
                displayFlashcard();
            } else {
                setEmptyFlashcard();
            }
        }
    } catch(e) { showToast("Lỗi cập nhật", "error"); }
}

// --- DICTIONARY ---
function renderDictionary() {
    const tbody = document.getElementById('dictTableBody');
    tbody.innerHTML = '';
    words.forEach(word => {
        const tr = document.createElement('tr');
        tr.className = word.is_learned ? 'row-learned' : '';
        tr.innerHTML = `
            <td class="hanzi-col">${word.hanzi} ${word.is_learned ? '✅' : ''}</td>
            <td>${word.pinyin}</td>
            <td>${word.meaning}</td>
            <td>
                <button class="btn-icon delete" onclick="deleteWord(${word.id})"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- PROGRESS ---
function renderProgress() {
    const tbody = document.getElementById('learnedTableBody');
    const learned = words.filter(w => w.is_learned);
    tbody.innerHTML = '';
    
    // Stats
    document.getElementById('statTotal').textContent = words.length;
    document.getElementById('statLearned').textContent = learned.length;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('statToday').textContent = words.filter(w => w.created_at && w.created_at.startsWith(today)).length;

    learned.sort((a,b) => new Date(b.last_studied_at) - new Date(a.last_studied_at)).forEach(word => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${word.hanzi}</strong><br><small>${word.meaning}</small></td>
            <td>${word.last_studied_at ? word.last_studied_at.split(' ')[0] : 'N/A'}</td>
            <td>${word.study_count || 0} lần</td>
            <td>
                <button class="btn-secondary" style="font-size:0.7rem;" onclick="unlearnWord(${word.id})">Học lại</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function unlearnWord(id) {
    try {
        const res = await fetch(`/api/words/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_learned: false })
        });
        if(res.ok) {
            const word = words.find(w => w.id === id);
            word.is_learned = false;
            renderProgress();
            showToast("Đã đưa từ quay lại danh sách học", "success");
        }
    } catch(e) { showToast("Lỗi", "error"); }
}

// --- MODAL & AUTO-TRANSLATE ---
let translateTimeout = null;
function setupModal() {
    const modal = document.getElementById('addWordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', () => {
        modal.classList.add('active');
        document.getElementById('newHanzi').focus();
    });
    document.getElementById('closeModalBtn').addEventListener('click', () => modal.classList.remove('active'));
    
    const hanziInput = document.getElementById('newHanzi');
    const pinyinInput = document.getElementById('newPinyin');
    const meaningInput = document.getElementById('newMeaning');
    const loadingEl = document.getElementById('translateLoading');
    const manualBtn = document.getElementById('manualTranslateBtn');

    const triggerTranslate = async () => {
        const text = hanziInput.value.trim();
        if(!text) return;
        loadingEl.style.display = 'inline-block';
        try {
            const res = await fetch(`/api/translate?q=${encodeURIComponent(text)}`);
            if (res.ok) {
                const data = await res.json();
                if(data.pinyin) pinyinInput.value = data.pinyin;
                if(data.meaning) meaningInput.value = data.meaning;
            }
        } catch(e) { console.error(e); }
        finally { loadingEl.style.display = 'none'; manualBtn.style.display = 'inline-block'; }
    };

    manualBtn.addEventListener('click', triggerTranslate);
    hanziInput.addEventListener('input', () => {
        const text = hanziInput.value.trim();
        if (!text) { pinyinInput.value = ''; meaningInput.value = ''; return; }
        clearTimeout(translateTimeout);
        translateTimeout = setTimeout(triggerTranslate, 800);
    });
}

async function addWord(e) {
    e.preventDefault();
    const newWord = {
        hanzi: document.getElementById('newHanzi').value,
        pinyin: document.getElementById('newPinyin').value,
        meaning: document.getElementById('newMeaning').value
    };
    const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWord)
    });
    if(res.ok) {
        const w = await res.json();
        words.push(w);
        renderDictionary();
        showToast("Đã thêm từ mới!", "success");
        document.getElementById('addWordForm').reset();
        document.getElementById('addWordModal').classList.remove('active');
    }
}

async function deleteWord(id) {
    if(!confirm("Xóa từ này?")) return;
    const res = await fetch(`/api/words/${id}`, { method: 'DELETE' });
    if(res.ok) {
        words = words.filter(w => w.id !== id);
        renderDictionary();
        renderProgress();
        showToast("Đã xóa", "success");
    }
}

// --- QUIZ ---
function generateQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    const quizError = document.getElementById('quizError');
    const optionsContainer = document.getElementById('quizOptions');
    if (words.length < 4) {
        quizContainer.classList.add('hidden');
        quizError.classList.remove('hidden');
        return;
    }
    quizContainer.classList.remove('hidden');
    quizError.classList.add('hidden');
    document.getElementById('nextQuizBtn').classList.add('hidden');
    document.getElementById('quizStatus').textContent = '';
    currentQuizWord = words[Math.floor(Math.random() * words.length)];
    document.getElementById('quizHanzi').textContent = currentQuizWord.hanzi;
    document.getElementById('quizPinyin').textContent = currentQuizWord.pinyin;
    let options = [currentQuizWord.meaning];
    while(options.length < 4) {
        let r = words[Math.floor(Math.random() * words.length)].meaning;
        if(!options.includes(r)) options.push(r);
    }
    options.sort(() => Math.random() - 0.5);
    optionsContainer.innerHTML = '';
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => {
            Array.from(optionsContainer.children).forEach(b => b.style.pointerEvents = 'none');
            if (opt === currentQuizWord.meaning) {
                btn.classList.add('correct');
                document.getElementById('quizStatus').innerHTML = '<span style="color:var(--secondary)">Chính xác!</span>';
            } else {
                btn.classList.add('wrong');
                document.getElementById('quizStatus').innerHTML = `<span style="color:var(--primary)">Sai rồi. Đúng là: ${currentQuizWord.meaning}</span>`;
            }
            document.getElementById('nextQuizBtn').classList.remove('hidden');
        };
        optionsContainer.appendChild(btn);
    });
}

// --- TOAST ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 3000);
    }, 3000);
}
