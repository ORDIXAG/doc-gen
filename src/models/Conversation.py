from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime
from sqlalchemy import TIMESTAMP

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.File import File
    from src.models.ChatHistory import ChatHistory
    from src.models.Documentation import Documentation
    from src.models.Repository import Repository


class ConversationBase(SQLModel):
    name: str = Field(index=True, default=None)
    last_changed: datetime = Field(default=TIMESTAMP(timezone=True))
    owner: str = Field(index=True, default=None)


class Conversation(ConversationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    files: List["File"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    chat_history: List["ChatHistory"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    documentation: List["Documentation"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    repository: Optional["Repository"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class ConversationRead(ConversationBase):
    id: int
