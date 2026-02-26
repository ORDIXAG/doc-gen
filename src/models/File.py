from typing import Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Conversation import Conversation


class FileBase(SQLModel):
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id", index=True, ondelete="CASCADE"
    )
    path: str = Field(index=True, default=None)
    content: str = Field(index=True, default=None)
    file_type: str = Field(index=True, default=None)
    git_id: Optional[int] = Field(index=True, default=None)

    def __str__(self):
        """String representation formats the file content for the model."""
        return f"Path: {self.path}\nContent: ```{self.file_type}\n{self.content}\n```"


class File(FileBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation: Optional["Conversation"] = Relationship(back_populates="files")


class FileRead(FileBase):
    id: int
