# File: D:\TN\ai_server\main.py
import re
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline

# Cấu hình Logging cho Đồ án (hiển thị thời gian và tiến trình rõ ràng)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("AI_Server")

app = FastAPI(title="PhoBERT Sentiment Analysis API", version="1.0.0")

# 1. KHỞI TẠO VÀ TẢI MÔ HÌNH PHO-BERT
logger.info("Đang tải mô hình PhoBERT Sentiment Analysis...")
try:
    sentiment_analyzer = pipeline("sentiment-analysis", model="wonrax/phobert-base-vietnamese-sentiment")
    logger.info("Tải mô hình thành công!")
except Exception as e:
    logger.error(f"Lỗi khi tải mô hình: {e}")
    raise RuntimeError("Không thể khởi tạo AI Model")

# 2. CẤU TRÚC DỮ LIỆU ĐẦU VÀO
class ReviewData(BaseModel):
    text: str

# 3. TỐI ƯU HÓA BỘ LỌC TỪ NGỮ ĐỘC HẠI BẰNG REGEX (TRÁNH BẮT NHẦM TỪ)
# Sử dụng \b (Word Boundary) để chỉ bắt chính xác từ đó.
# Ví dụ: \bngu\b sẽ bắt "ngu" nhưng bỏ qua "ngủ" hay "ngụy".
TOXIC_WORDS_PATTERN = re.compile(
    r'\b(dm|vcl|ngu|chó|rác rưởi|đĩ|mẹ mày|địt)\b', 
    re.IGNORECASE | re.UNICODE
)

def check_toxicity(text: str) -> bool:
    """Hàm kiểm tra từ ngữ độc hại sử dụng Regex."""
    return bool(TOXIC_WORDS_PATTERN.search(text))

# 4. API ENDPOINT: PHÂN TÍCH VĂN BẢN (CHỨC NĂNG CHÍNH)
@app.post("/api/analyze")
async def analyze_text(data: ReviewData):
    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Văn bản đầu vào không được để trống")
    
    logger.info(f"Đang xử lý đánh giá: '{data.text[:30]}...'")
    
    try:
        # A. Phân tích cảm xúc bằng PhoBERT
        result = sentiment_analyzer(data.text)[0]
        label = result['label']
        score = result['score'] # Tỷ lệ độ tin cậy (Confidence Score)
        
        # Ánh xạ nhãn sang chuẩn hệ thống
        sentiment = "neutral"
        if label == "POS":
            sentiment = "positive"
        elif label == "NEG":
            sentiment = "negative"
            
        confidence_percent = round(score * 100, 2)
        
        # B. Kiểm tra độc hại (Hỗ trợ tiền xử lý cho Hệ thống chính)
        is_toxic = check_toxicity(data.text)
        
        if is_toxic:
            logger.warning(f"Phát hiện nội dung độc hại! Cảm xúc: {sentiment} ({confidence_percent}%)")
        else:
            logger.info(f"Hoàn tất. Cảm xúc: {sentiment} ({confidence_percent}%)")

        # C. Trả về kết quả
        return {
            "sentiment": sentiment,
            "confidence": confidence_percent,
            "isToxic": is_toxic
        }

    except Exception as e:
        logger.error(f"Lỗi hệ thống khi phân tích: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi nội bộ AI Server")

# 5. API ENDPOINT: HEALTH CHECK (Dùng để chứng minh hệ thống trong Đồ án)
@app.get("/api/status")
async def get_status():
    """Kiểm tra trạng thái hoạt động của mô hình."""
    return {
        "status": "online",
        "model": "wonrax/phobert-base-vietnamese-sentiment",
        "toxicity_filter": "Regex Word Boundaries (Active)"
    }

# Lệnh khởi chạy: uvicorn main:app --port 8000