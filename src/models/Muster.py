# src/models/Muster.py

from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint


class MusterBase(SQLModel):
    name: str = Field(index=True)
    content: str
    owner: str = Field(index=True)


class Muster(MusterBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # Enforce that the combination of name and owner is unique
    __table_args__ = (UniqueConstraint("name", "owner", name="unique_name_for_owner"),)


class MusterCreate(SQLModel):
    name: str
    content: str


class MusterRead(MusterBase):
    id: int


class MusterUpdate(SQLModel):
    name: Optional[str] = None
    content: Optional[str] = None


# This special model will be used for the combined list response
class MusterReadCombined(SQLModel):
    id: Optional[int] = None
    name: str
    content: Optional[str] = None
    owner: Optional[str] = None
    is_predefined: bool
