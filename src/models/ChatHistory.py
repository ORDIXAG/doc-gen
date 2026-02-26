from typing import Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Conversation import Conversation


class ChatHistoryBase(SQLModel):
    conversation_id: int = Field(
        foreign_key="conversation.id", unique=True, index=True, ondelete="CASCADE"
    )
    # The entire chat history is stored as a single text block with custom delimiters.
    content: str = Field(default="")


class ChatHistory(ChatHistoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation: Optional["Conversation"] = Relationship(back_populates="chat_history")


class ChatHistoryRead(ChatHistoryBase):
    id: int


class ChatHistoryUpdate(SQLModel):
    content: str
