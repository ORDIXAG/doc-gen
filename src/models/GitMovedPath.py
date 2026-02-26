from typing import Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Repository import Repository


class GitMovedPathBase(SQLModel):
    repository_id: Optional[int] = Field(
        default=None, foreign_key="repository.id", index=True, ondelete="CASCADE"
    )
    old_path: str
    new_path: str


class GitMovedPath(GitMovedPathBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repository: Optional["Repository"] = Relationship(back_populates="git_moved_path")


class GitMovedPathRead(GitMovedPathBase):
    id: int
