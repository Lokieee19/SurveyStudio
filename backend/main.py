from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List

from parser_service import parse_input
from xml_generator import generate_xml
from pydantic import BaseModel
from parser_service import smart_block_parser  # 🔥 add this import

app = FastAPI()

# =============================
# 🔹 CORS
# =============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================
# 🔹 PREVIEW ENDPOINT
# ============================

class TextRequest(BaseModel):
    text: str


@app.post("/preview")
async def preview(req: TextRequest):
    try:
        raw_text = req.text

        # 🔥 use correct parser for raw script
        if isinstance(raw_text, str):
            questions = smart_block_parser(raw_text)
        else:
            # fallback (prevents crash)
            questions = []

        return {
            "questions": questions
        }

    except Exception as e:
        print("❌ PREVIEW ERROR:", str(e))
        return {
            "error": str(e),
            "questions": []
        }

# =============================
# 🔹 GENERATE XML ENDPOINT
# =============================
@app.post("/generate")
async def generate(payload: List[Dict]):
    try:
        xml = generate_xml(payload)

        return {
            "xml": xml
        }

    except Exception as e:
        print("❌ XML ERROR:", str(e))
        return {
            "error": str(e),
            "xml": ""
        }