from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import os
import logging

# Logic Imports
from .database import engine, Base, SessionLocal
# We import init_db specifically to sync templates
from .crud import init_db 
# Import the API router logic
from . import main_api 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cv_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC ---
    logger.info("🚀 Server Starting...")
    
    # 1. Initialize Database Tables
    Base.metadata.create_all(bind=engine)
    
    # 2. Create DB Session
    db = SessionLocal()
    
    try:
        # 3. SYNC IMMORTAL TEMPLATES
        # This inserts the Hardcoded Templates into Postgres
        init_db.sync_templates(db)
        logger.info("✅ Templates Synced.")
    except Exception as e:
        logger.error(f"❌ Template Sync Failed: {e}")
    finally:
        # 4. Close DB Session
        db.close()
        
    logger.info("✅ Startup Complete.")
    yield
    # --- SHUTDOWN LOGIC ---
    logger.info("🛑 Server Shutting Down.")

app = FastAPI(title="AI CV Builder", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# ROUTER SETUP: Include the API router with prefix '/api'
# ------------------------------------------------------------------
app.include_router(main_api.router, prefix="/api")

# ------------------------------------------------------------------
# STATIC FILES (FRONTEND) - ROOT HANDLERS
# ------------------------------------------------------------------
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(request: Request, full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs"):
            return await request.app.router.handle_request(request)
            
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    def root(): return {"status": "Backend Running (No Frontend Build Found)"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
