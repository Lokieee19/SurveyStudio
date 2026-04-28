from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, Dict, List

from parser_service import parse_input
from xml_generator import generate_xml

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
# =============================
@app.post("/preview")
async def preview(payload: Dict[str, Any]):
    try:
        questions = parse_input(payload)

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