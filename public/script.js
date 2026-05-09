let words = [];
let currentIndex = 0;

const flashcard = document.getElementById('flashcard');
const hanziEl = document.getElementById('hanzi');
const pinyinEl = document.getElementById('pinyin');
const meaningEl = document.getElementById('meaning');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const addWordForm = document.getElementById('addWordForm');
const addMessage = document.getElementById('addMessage');

// Lật thẻ
flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
});

// Lấy danh sách từ vựng từ máy chủ
async function fetchWords() {
    try {
        const response = await fetch('/api/words');
        words = await response.json();
        if (words.length > 0) {
            displayWord(0);
        }
    } catch (error) {
        console.error("Lỗi khi lấy từ vựng:", error);
        hanziEl.textContent = "Lỗi";
        pinyinEl.textContent = "Không thể kết nối máy chủ";
    }
}

// Hiển thị từ vựng
function displayWord(index) {
    if (words.length === 0) return;
    
    // Nếu thẻ đang lật thì lật lại
    if (flashcard.classList.contains('flipped')) {
        flashcard.classList.remove('flipped');
        setTimeout(() => updateCardContent(index), 300); // Đợi lật xong rồi mới đổi chữ
    } else {
        updateCardContent(index);
    }
}

function updateCardContent(index) {
    const word = words[index];
    hanziEl.textContent = word.hanzi;
    pinyinEl.textContent = word.pinyin;
    meaningEl.textContent = word.meaning;
}

// Nút Tiếp theo
nextBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra flashcard
    if (words.length === 0) return;
    // Chọn từ ngẫu nhiên (hoặc theo thứ tự tùy thích, ở đây chọn ngẫu nhiên để ôn tập)
    currentIndex = Math.floor(Math.random() * words.length);
    displayWord(currentIndex);
});

// Nút Trước đó
prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (words.length === 0) return;
    currentIndex = currentIndex > 0 ? currentIndex - 1 : words.length - 1;
    displayWord(currentIndex);
});

// Xử lý form Thêm từ mới
addWordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newWord = {
        hanzi: document.getElementById('newHanzi').value,
        pinyin: document.getElementById('newPinyin').value,
        meaning: document.getElementById('newMeaning').value
    };

    try {
        const response = await fetch('/api/words', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newWord)
        });

        if (response.ok) {
            const addedWord = await response.json();
            words.push(addedWord); // Cập nhật mảng hiện tại
            
            // Xoá form và báo thành công
            addWordForm.reset();
            addMessage.textContent = "✅ Đã thêm từ vựng thành công!";
            addMessage.style.color = "var(--secondary)";
            
            setTimeout(() => {
                addMessage.textContent = "";
            }, 3000);
        } else {
            throw new Error("Lỗi Server");
        }
    } catch (error) {
        addMessage.textContent = "❌ Có lỗi xảy ra, không thể lưu từ vựng.";
        addMessage.style.color = "var(--primary)";
    }
});

// Khởi chạy khi trang được load
fetchWords();
