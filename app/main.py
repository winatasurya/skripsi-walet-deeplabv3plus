import os
import shutil
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
from app.inference import BirdNestSegmenter

UPLOAD_DIR = os.path.join("app", "uploads")
RESULT_DIR = os.path.join("app", "results")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULT_DIR, exist_ok=True)

segmenter = BirdNestSegmenter()

app = FastAPI(
    title="API Deteksi Kontaminasi Sarang Walet",
    description="Backend API untuk segmentasi kotoran pada sarang burung walet menggunakan DeepLabV3+",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
def get_status():
    """Cek status server dan model."""
    try:
        import tensorflow as tf
        gpus = tf.config.list_physical_devices('GPU')
        device = "GPU" if gpus else "CPU"
    except ImportError:
        device = "CPU"
    
    return {
        "status": "online",
        "has_real_model": segmenter.has_real_model,
        "model_path": segmenter.model_path,
        "model_load_time_ms": segmenter.model_load_time_ms,
        "device": device,
        "framework": "TensorFlow/Keras + FastAPI",
        "message": "Model aktif" if segmenter.has_real_model else "Mock mode aktif"
    }

@app.post("/api/detect")
async def detect_contamination(file: UploadFile = File(...)):
    """Upload gambar sarang walet dan jalankan segmentasi kotoran."""
    extension = file.filename.split(".")[-1].lower()
    if extension not in ["jpg", "jpeg", "png"]:
        raise HTTPException(
            status_code=400, 
            detail="Format tidak didukung. Gunakan JPG, JPEG, atau PNG."
        )
        
    try:
        contents = await file.read()
        
        safe_filename = f"upload_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, safe_filename)
        with open(filepath, "wb") as f:
            f.write(contents)
            
        result = segmenter.run_inference(contents)
        
        # Simpan hasil overlay
        import base64
        overlay_data = result["images"]["overlay"].split(",")[-1]
        result_filepath = os.path.join(RESULT_DIR, f"result_{file.filename}")
        with open(result_filepath, "wb") as f:
            f.write(base64.b64decode(overlay_data))
            
        result["filename"] = file.filename
        return result
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses citra: {str(e)}"
        )

# Serve frontend static files dari Vite build
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "frontend", "dist")
ASSETS_DIR = os.path.join(DIST_DIR, "assets")

if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/{path_name:path}")
    async def serve_frontend(path_name: str):
        file_path = os.path.join(DIST_DIR, path_name)
        if path_name and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    @app.get("/")
    def read_root():
        return {
            "message": "API aktif (frontend/dist tidak ditemukan)",
            "documentation": "/docs"
        }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
