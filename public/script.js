let words = [];
let currentFlashcardIndex = 0;
let currentQuizWord = null;

const flashcard = document.getElementById('flashcard');
const hanziText = document.getElementById('hanziText');
const pinyinText = document.getElementById('pinyinText');
const meaningText = document.getElementById('meaningText');
const toastContainer = document.getElementById('toastContainer');

document.addEventListener('DOMContentLoaded', () => {
    fetchWords();
    fetchConfig();
    setupTabs();
    setupTheme();
    setupModal();
    
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
    document.getElementById('nextBtn').addEventListener('click', () => changeFlashcard(1));
    document.getElementById('prevBtn').addEventListener('click', () => changeFlashcard(-1));
    document.getElementById('markLearnedBtn').addEventListener('click', markAsLearned);
    document.getElementById('randomBtn').addEventListener('click', () => {
        const learnable = getLearnableWords();
        if(learnable.length > 0) {
            const randomWord = learnable[Math.floor(Math.random() * learnable.length)];
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

    // Filter Dictionary
    document.getElementById('searchInput').addEventListener('input', renderDictionary);
    document.getElementById('hskFilter').addEventListener('change', renderDictionary);
    
    // Bulk Delete
    document.getElementById('bulkDeleteBtn').addEventListener('click', async () => {
        const hsk = document.getElementById('hskFilter').value;
        const msg = hsk === 'All' ? 'Xóa TOÀN BỘ từ vựng?' : `Xóa toàn bộ từ thuộc ${hsk}?`;
        if(!confirm(msg)) return;
        const res = await fetch(`/api/words?hsk=${hsk}`, { method: 'DELETE' });
        if(res.ok) {
            words = hsk === 'All' ? [] : words.filter(w => (w.hsk_level||'None') !== hsk);
            renderDictionary(); renderProgress();
            showToast("Đã xóa hàng loạt thành công");
        }
    });

    setupBulkModal();
});

// --- BULK ADD LOGIC ---
function setupBulkModal() {
    const modal = document.getElementById('bulkAddModal');
    const previewArea = document.getElementById('bulkPreviewArea');
    const previewBody = document.getElementById('bulkPreviewTableBody');
    
    document.getElementById('openBulkAddBtn').addEventListener('click', () => modal.classList.add('active'));
    document.getElementById('closeBulkAddBtn').addEventListener('click', () => {
        modal.classList.remove('active');
        previewArea.style.display = 'none';
        document.getElementById('bulkHanziArea').value = '';
    });

    document.getElementById('previewBulkBtn').addEventListener('click', async () => {
        const lines = document.getElementById('bulkHanziArea').value.split('\n').map(l => l.trim()).filter(l => l);
        if(lines.length === 0) return showToast("Vui lòng nhập ít nhất 1 từ", "error");
        
        previewBody.innerHTML = '<tr><td colspan="3" style="text-align:center">Đang dịch hàng loạt...</td></tr>';
        previewArea.style.display = 'block';
        
        let results = [];
        for(let hanzi of lines) {
            try {
                const res = await fetch(`/api/translate?q=${encodeURIComponent(hanzi)}`);
                const data = res.ok ? await res.json() : { pinyin: '', meaning: '' };
                results.push({ hanzi, pinyin: data.pinyin, meaning: data.meaning });
            } catch(e) { results.push({ hanzi, pinyin: '', meaning: '' }); }
        }
        
        previewBody.innerHTML = '';
        results.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" value="${item.hanzi}" class="bulk-input hanzi-val"></td>
                <td><input type="text" value="${item.pinyin}" class="bulk-input pinyin-val"></td>
                <td><input type="text" value="${item.meaning}" class="bulk-input meaning-val"></td>
            `;
            previewBody.appendChild(tr);
        });
    });

    document.getElementById('saveBulkBtn').addEventListener('click', async () => {
        const rows = Array.from(previewBody.querySelectorAll('tr'));
        const hsk = document.getElementById('bulkHskLevel').value;
        let count = 0;
        
        for(let row of rows) {
            const hanzi = row.querySelector('.hanzi-val').value;
            const pinyin = row.querySelector('.pinyin-val').value;
            const meaning = row.querySelector('.meaning-val').value;
            
            if(!hanzi) continue;
            
            await fetch('/api/words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hanzi, pinyin, meaning, hsk_level: hsk })
            });
            count++;
        }
        
        showToast(`Đã lưu thành công ${count} từ vào HSK ${hsk}`);
        fetchWords();
        document.getElementById('closeBulkAddBtn').click();
    });
}

// --- API ---
async function fetchWords() {
    try {
        const res = await fetch('/api/words');
        if (res.status === 401) return window.location.reload();
        words = await res.json();
        renderDictionary();
        renderProgress();
        const learnable = getLearnableWords();
        if (learnable.length > 0) {
            currentFlashcardIndex = words.indexOf(learnable[0]);
            displayFlashcard();
        } else setEmptyFlashcard();
    } catch (e) { showToast("Lỗi tải dữ liệu", "error"); }
}

// Logic: Học từ là những từ MỚI của ngày hôm nay và chưa thuộc
function getLearnableWords() {
    const today = new Date().toISOString().split('T')[0];
    const todayWords = words.filter(w => !w.is_learned && w.created_at && w.created_at.startsWith(today));
    // Nếu hôm nay không có từ mới, hiện các từ chưa thuộc cũ
    return todayWords.length > 0 ? todayWords : words.filter(w => !w.is_learned);
}

async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        document.getElementById('syncCodeDisplay').textContent = config.sync_code || '------';
        document.getElementById('botNameDisplay').textContent = '@HanziReminderBot'; 
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

function setupTheme() {
    const btn = document.getElementById('themeToggle');
    if(localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
}

function speakWord(text) {
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
}

// --- FLASHCARD ---
function setEmptyFlashcard() {
    hanziText.textContent = "N/A"; pinyinText.textContent = "-";
    meaningText.textContent = "Hôm nay bạn đã học hết từ mới!";
}

function displayFlashcard() {
    const learnable = getLearnableWords();
    if (learnable.length === 0) return setEmptyFlashcard();
    if (currentFlashcardIndex < 0 || currentFlashcardIndex >= words.length || words[currentFlashcardIndex].is_learned) {
        currentFlashcardIndex = words.indexOf(learnable[0]);
    }
    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
        setTimeout(() => updateCardUI(), 300);
    } else updateCardUI();
}

async function updateCardUI() {
    const word = words[currentFlashcardIndex];
    if(!word) return;
    hanziText.textContent = word.hanzi;
    pinyinText.textContent = word.pinyin;
    meaningText.textContent = word.meaning;
    fetch(`/api/words/${word.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ increment_study: true }) });
}

function changeFlashcard(direction) {
    const learnable = getLearnableWords();
    if (learnable.length === 0) return;
    let idx = learnable.indexOf(words[currentFlashcardIndex]);
    idx += direction;
    if (idx >= learnable.length) idx = 0; if (idx < 0) idx = learnable.length - 1;
    currentFlashcardIndex = words.indexOf(learnable[idx]);
    displayFlashcard();
}

async function markAsLearned() {
    const word = words[currentFlashcardIndex]; if(!word) return;
    const res = await fetch(`/api/words/${word.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_learned: true }) });
    if(res.ok) {
        word.is_learned = true; showToast(`Đã thuộc: ${word.hanzi}`);
        const learnable = getLearnableWords();
        if(learnable.length > 0) { currentFlashcardIndex = words.indexOf(learnable[0]); displayFlashcard(); }
        else setEmptyFlashcard();
    }
}

// --- DICTIONARY ---
function renderDictionary() {
    const tbody = document.getElementById('dictTableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const hskLevel = document.getElementById('hskFilter').value;
    
    tbody.innerHTML = '';
    const filtered = words.filter(w => {
        const matchesSearch = w.hanzi.includes(searchTerm) || w.pinyin.toLowerCase().includes(searchTerm) || w.meaning.toLowerCase().includes(searchTerm);
        const matchesHSK = hskLevel === 'All' || w.hsk_level === hskLevel;
        return matchesSearch && matchesHSK;
    });

    filtered.forEach(word => {
        const tr = document.createElement('tr');
        tr.className = word.is_learned ? 'row-learned' : '';
        tr.innerHTML = `
            <td class="hanzi-col">${word.hanzi} <span class="badge-hsk">${word.hsk_level || 'None'}</span></td>
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
    document.getElementById('statTotal').textContent = words.length;
    document.getElementById('statLearned').textContent = learned.length;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('statToday').textContent = words.filter(w => w.created_at && w.created_at.startsWith(today)).length;
    learned.sort((a,b) => new Date(b.last_studied_at) - new Date(a.last_studied_at)).forEach(word => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${word.hanzi}</strong> [${word.hsk_level}]</td><td>${word.last_studied_at ? word.last_studied_at.split(' ')[0] : 'N/A'}</td><td>${word.study_count || 0} lần</td><td><button class="btn-secondary" style="font-size:0.7rem;" onclick="unlearnWord(${word.id})">Học lại</button></td>`;
        tbody.appendChild(tr);
    });
}

async function unlearnWord(id) {
    const res = await fetch(`/api/words/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_learned: false }) });
    if(res.ok) { words.find(w => w.id === id).is_learned = false; renderProgress(); showToast("Đã đưa từ quay lại danh sách học"); }
}

// --- MODAL & AUTO-TRANSLATE ---
let translateTimeout = null;
function setupModal() {
    const modal = document.getElementById('addWordModal');
    document.getElementById('openAddModalBtn').addEventListener('click', () => { modal.classList.add('active'); document.getElementById('newHanzi').focus(); });
    document.getElementById('closeModalBtn').addEventListener('click', () => modal.classList.remove('active'));
    const hanziInput = document.getElementById('newHanzi');
    const pinyinInput = document.getElementById('newPinyin');
    const meaningInput = document.getElementById('newMeaning');
    const hskInput = document.getElementById('newHskLevel');
    const loadingEl = document.getElementById('translateLoading');
    const manualBtn = document.getElementById('manualTranslateBtn');

    const triggerTranslate = async () => {
        const text = hanziInput.value.trim(); if(!text) return;
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
        clearTimeout(translateTimeout); translateTimeout = setTimeout(triggerTranslate, 800);
    });
}

async function addWord(e) {
    e.preventDefault();
    const newWord = {
        hanzi: document.getElementById('newHanzi').value,
        pinyin: document.getElementById('newPinyin').value,
        meaning: document.getElementById('newMeaning').value,
        hsk_level: document.getElementById('newHskLevel').value
    };
    const res = await fetch('/api/words', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newWord) });
    if(res.ok) {
        const w = await res.json(); words.push(w); renderDictionary(); showToast("Đã thêm từ mới!");
        document.getElementById('addWordForm').reset(); document.getElementById('addWordModal').classList.remove('active');
    }
}

async function deleteWord(id) {
    if(!confirm("Xóa từ này?")) return;
    const res = await fetch(`/api/words/${id}`, { method: 'DELETE' });
    if(res.ok) { words = words.filter(w => w.id !== id); renderDictionary(); renderProgress(); showToast("Đã xóa"); }
}

// --- QUIZ (Sử dụng TOÀN BỘ từ vựng) ---
function generateQuiz() {
    const quizContainer = document.getElementById('quizContainer');
    const quizError = document.getElementById('quizError');
    const optionsContainer = document.getElementById('quizOptions');
    if (words.length < 4) { quizContainer.classList.add('hidden'); quizError.classList.remove('hidden'); return; }
    quizContainer.classList.remove('hidden'); quizError.classList.add('hidden');
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
        const btn = document.createElement('button'); btn.className = 'quiz-option'; btn.textContent = opt;
        btn.onclick = () => {
            Array.from(optionsContainer.children).forEach(b => b.style.pointerEvents = 'none');
            if (opt === currentQuizWord.meaning) { btn.classList.add('correct'); document.getElementById('quizStatus').innerHTML = '<span style="color:var(--secondary)">Chính xác!</span>'; }
            else { btn.classList.add('wrong'); document.getElementById('quizStatus').innerHTML = `<span style="color:var(--primary)">Sai rồi. Đúng là: ${currentQuizWord.meaning}</span>`; }
            document.getElementById('nextQuizBtn').classList.remove('hidden');
        };
        optionsContainer.appendChild(btn);
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 3000); }, 3000);
}
