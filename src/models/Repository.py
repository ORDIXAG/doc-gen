from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Conversation import Conversation
    from src.models.GitDeletedPath import GitDeletedPath
    from src.models.GitMovedPath import GitMovedPath


class RepositoryBase(SQLModel):
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id", index=True, ondelete="CASCADE"
    )
    git: str = Field(index=True, default=None)
    repo_id: int = Field(index=True, default=None)


class Repository(RepositoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    conversation: Optional["Conversation"] = Relationship(back_populates="repository")
    git_deleted_path: List["GitDeletedPath"] = Relationship(
        back_populates="repository",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    git_moved_path: List["GitMovedPath"] = Relationship(
        back_populates="repository",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class RepositoryRead(RepositoryBase):
    id: int
