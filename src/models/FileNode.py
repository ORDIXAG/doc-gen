from __future__ import annotations

from typing import Any, List, Optional
from sqlmodel import SQLModel, Field


class FileNode(SQLModel):
    name: str
    path: str
    isFolder: bool
    children: List[FileNode] = Field(default_factory=list)
    originalDoc: Optional[Any] = None
    gitId: Optional[int] = None
