from typing import Optional
from sqlmodel import Field, Relationship, SQLModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.models.Repository import Repository


class GitDeletedPathBase(SQLModel):
    repository_id: Optional[int] = Field(
        default=None, foreign_key="repository.id", index=True, ondelete="CASCADE"
    )
    path: str


class GitDeletedPath(GitDeletedPathBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    repository: Optional["Repository"] = Relationship(back_populates="git_deleted_path")


class GitDeletedPathRead(GitDeletedPathBase):
    id: int
