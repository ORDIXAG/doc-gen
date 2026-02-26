from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, text
import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
import os

from src.routers.conversation import router as documentation_router
from src.routers.model import router as model_router
from src.routers.muster import router as muster_router
from src.dependencies.database import engine
from src.dependencies.config import Config
from src.dependencies.logging_config import setup_logging

config = Config()


def create_db_and_tables():
    existing_tables = [table.name for table in SQLModel.metadata.tables.values()]
    existing_tables = set(table[0] for table in existing_tables)
    if set(SQLModel.metadata.tables.keys()).issubset(existing_tables):
        print("Database ist healthy, keine Aktion erforderlich.")
    else:
        SQLModel.metadata.create_all(engine)


def cleanup_db():
    with Session(engine) as db:
        delete_stmt = (
            SQLModel.metadata.tables["conversation"]
            .delete()
            .where(
                SQLModel.metadata.tables["conversation"].c.last_changed
                < text("datetime('now', '-30 days')")
            )
        )

        result = db.exec(delete_stmt)
        db.commit()
        if result.rowcount:
            print(
                f"Cleanup erfolgerich. {result.rowcount} alte "
                "Konversationen und verbundene Daten gelöscht."
            )


app = FastAPI(root_path="/dokumentationsgenerator_backend")

scheduler = BackgroundScheduler()


def schedule_cleanup():
    cleanup_db()


job = scheduler.add_job(
    schedule_cleanup, "cron", hour=0, minute=0
)  # Daily cleanup at midnight


# Register the startup event handler
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    cleanup_db()
    scheduler.start()
    setup_logging()


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()


# Add CORS middleware
origins = [
    "http://localhost:4200",
    "http://localhost:2320",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(documentation_router)
app.include_router(model_router)
app.include_router(muster_router)


# Root path for health check
@app.get("/health")
async def root():
    return {"message": "FastAPI ist erreichbar und funktionsfähig!"}


@app.get("/actuator/info")
async def actuator_info():
    return  # Dummy endpoint, update if needed in frontend


def start():
    uvicorn.run(
        "src.main:app",
        host="localhost",
        port=int(os.environ.get("PORT", 2320)),
        reload=True,
    )
