# File: D:\TN\ai_server\main.py
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI()

# 1. TẢI MÔ HÌNH PHO-BERT ĐÃ ĐƯỢC HUẤN LUYỆN

# Sử dụng mô hình chuyên phân tích cảm xúc tiếng Việt
sentiment_analyzer = pipeline("sentiment-analysis", model="wonrax/phobert-base-vietnamese-sentiment")


# 2. ĐỊNH NGHĨA DỮ LIỆU ĐẦU VÀO
class ReviewData(BaseModel):
    text: str

# 3. TẠO API ENDPOINT NHẬN YÊU CẦU TỪ NODE.JS
@app.post("/api/analyze")
async def analyze_text(data: ReviewData):
    try:
   
        result = sentiment_analyzer(data.text)[0]
        label = result['label'] # Trả về 'POS' (Tích cực), 'NEG' (Tiêu cực), 'NEU' (Trung lập)
        
     
        sentiment = "neutral"
        if label == "POS":
            sentiment = "positive"
        elif label == "NEG":
            sentiment = "negative"
            
        # Tích hợp bộ lọc từ ngữ thô tục (Kết hợp Cấp độ 1 vào đây cho nhẹ máy)
        toxic_words = ["dm", "vcl", "ngu", "chó", "rác rưởi", "đĩ", "mẹ mày", "địt"]
        text_lower = data.text.lower()
        is_toxic = any(word in text_lower for word in toxic_words)

        # Trả về kết quả cho Node.js
        return {"sentiment": sentiment, "isToxic": is_toxic}

    except Exception as e:
        return {"sentiment": "neutral", "isToxic": False, "error": str(e)}

# Cách chạy server này: uvicorn main:app --port 8000