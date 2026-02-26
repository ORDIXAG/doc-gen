from sqlmodel import create_engine, Session
from src.dependencies.config import environment

engine = create_engine(
    environment.DATABASE_URL,
    connect_args=environment.DATABASE_CONNECT_DICT,
    execution_options=environment.EXECUTION_OPTIONS,
)


def get_db():
    with Session(engine) as session:
        yield session
