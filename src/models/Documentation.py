from typing import Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Conversation import Conversation


class DocumentationBase(SQLModel):
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id", index=True, ondelete="CASCADE"
    )
    path: str = Field(index=True, default=None)
    content: str = Field(index=True, default=None)
    repo_id: Optional[int] = Field(index=True, default=None)
    muster: str = Field(index=True, default=None)

    def __str__(self):
        """String representation formats the documentation content for the model."""
        return f"Path: {self.path}\nContent: ```Markdown\n{self.content}\n```"


class Documentation(DocumentationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation: Optional["Conversation"] = Relationship(
        back_populates="documentation"
    )


class DocumentationRead(DocumentationBase):
    id: int
