from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from typing import List
from sqlalchemy.exc import IntegrityError
import os

from src.dependencies.database import get_db
from ..models.Muster import (
    Muster,
    MusterCreate,
    MusterRead,
    MusterReadCombined,
    MusterUpdate,
)
from src.util.auth import get_jwt_owner_from_request
from src.dependencies.config import Config

router = APIRouter()
config = Config()


@router.post("/muster", response_model=MusterRead)
def create_muster(
    muster: MusterCreate,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """Creates a new muster, ensuring the name is unique for the user."""
    try:
        owner = get_owner if isinstance(get_owner, str) else get_owner
        db_muster = Muster.model_validate(muster, update={"owner": owner})
        db.add(db_muster)
        db.commit()
        db.refresh(db_muster)
        return db_muster
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A muster with this name already exists for your account.",
        )


@router.get("/muster", response_model=List[MusterReadCombined])
def get_all_muster(
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """
    Gets a combined list of predefined (file-based) and user-owned (DB) muster.
    """
    # 1. Get user-owned muster from the database
    owner = get_owner if isinstance(get_owner, str) else get_owner
    user_muster_db = db.exec(select(Muster).filter(Muster.owner == owner)).all()
    combined_list = [
        MusterReadCombined(**m.model_dump(exclude_none=True), is_predefined=False)
        for m in user_muster_db
    ]

    combined_list = [MusterReadCombined.model_validate(m) for m in combined_list]

    # 2. Get predefined muster from the filesystem
    predefined_muster_names = []
    if os.path.exists(config.muster_directory):
        predefined_muster_names = [
            f.replace(".md", "")
            for f in os.listdir(config.muster_directory)
            if f.endswith(".md")
        ]

    for name in predefined_muster_names:
        combined_list.append(MusterReadCombined(name=name, is_predefined=True))

    return combined_list


@router.get("/muster/predefined/{name}", response_model=MusterReadCombined)
def get_predefined_muster(
    name: str,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """Gets a single predefined muster by its name."""
    predefined_muster_file = os.path.join(config.muster_directory, f"{name}.md")
    if not os.path.exists(predefined_muster_file):
        raise HTTPException(status_code=404, detail="Predefined muster not found")
    with open(predefined_muster_file, "r") as f:
        content = f.read()
    return MusterReadCombined(name=name, content=content, is_predefined=True)


@router.get("/muster/{muster_id}", response_model=MusterRead)
def get_muster_by_id(
    muster_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """Gets a single user-owned muster by its ID."""
    owner = get_owner if isinstance(get_owner, str) else get_owner
    muster = db.get(Muster, muster_id)
    if not muster:
        raise HTTPException(status_code=404, detail="Muster not found")
    if muster.owner != owner:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this muster"
        )
    return muster


@router.put("/muster/{muster_id}", response_model=MusterRead)
def update_muster(
    muster_id: int,
    muster_update: MusterUpdate,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """Updates a muster's name or content."""
    owner = get_owner if isinstance(get_owner, str) else get_owner
    db_muster = db.get(Muster, muster_id)
    if not db_muster:
        raise HTTPException(status_code=404, detail="Muster not found")
    if db_muster.owner != owner:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this muster"
        )

    update_data = muster_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_muster, key, value)

    try:
        db.add(db_muster)
        db.commit()
        db.refresh(db_muster)
        return db_muster
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="A muster with this name already exists."
        )


@router.delete("/muster/{muster_id}", status_code=204)
def delete_muster(
    muster_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    """Deletes a user-owned muster."""
    owner = get_owner if isinstance(get_owner, str) else get_owner
    muster = db.get(Muster, muster_id)
    if muster and muster.owner == owner:
        db.delete(muster)
        db.commit()
    # No error if not found, as the desired state (deleted) is achieved.
    return
