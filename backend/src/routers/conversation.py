from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from src.dependencies.database import get_db
from src.dependencies.config import Config
from src.models.File import File, FileRead
from src.models.Documentation import Documentation, DocumentationRead
from src.models.Conversation import Conversation, ConversationRead
from src.models.ChatHistory import ChatHistory, ChatHistoryRead, ChatHistoryUpdate
from src.models.Repository import Repository
from models.GitDeletedPath import GitDeletedPath
from models.GitMovedPath import GitMovedPath
from src.models.Muster import Muster
from src.models.FileNode import FileNode
from src.util.auth import get_jwt_owner_from_request
from typing import Dict, List, Optional
from pydantic import BaseModel

import os
import re
from openai import OpenAI
import datetime
import github
import json

USER_TOKEN_START = "<dokumentationsgenerator-user>"
USER_TOKEN_END = "</dokumentationsgenerator-user>"
ASSISTANT_TOKEN_START = "<dokumentationsgenerator-assistant>"
ASSISTANT_TOKEN_END = "</dokumentationsgenerator-assistant>"

DELIMITER_TOKENS = [
    USER_TOKEN_START,
    USER_TOKEN_END,
    ASSISTANT_TOKEN_START,
    ASSISTANT_TOKEN_END,
]

progress_store = {}

router = APIRouter()
config = Config()


class ChatMessage(BaseModel):
    message: str
    model_name: Optional[str] = None


# Conversations
@router.get("/conversation", response_model=List[ConversationRead])
def get_conversations(
    request: Request,
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversations = db.exec(
        select(Conversation)
        .filter(Conversation.owner == request_owner)
        .offset(offset)
        .limit(limit)
    ).all()
    return conversations


@router.get("/conversation/{conversation_id}", response_model=ConversationRead)
def get_conversation(
    request: Request,
    conversation_id: int,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.exec(
        select(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.owner == request_owner,
        )
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.post("/conversation", response_model=Conversation)
def create_conversation(
    conversation: Conversation,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation.last_changed = datetime.datetime.now()
    conversation.owner = request_owner
    db_conversation = Conversation.model_validate(conversation)
    db.add(db_conversation)
    db.commit()
    db.refresh(db_conversation)
    return db_conversation


@router.put("/conversation/{conversation_id}")
def update_conversation(
    conversation_id: int,
    updated_conversation: Conversation,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation_to_update = db.get(Conversation, conversation_id)

    if not conversation_to_update:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation_to_update.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    conversation_to_update.owner = updated_conversation.owner
    conversation_to_update.last_changed = datetime.datetime.now()
    conversation_to_update.name = updated_conversation.name

    db.commit()
    db.refresh(conversation_to_update)

    return conversation_to_update


@router.delete("/conversation/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation_to_delete = db.get(Conversation, conversation_id)

    if not conversation_to_delete:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conversation_to_delete.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(conversation_to_delete)
    db.commit()

    return


# Files
@router.get("/conversation/{conversation_id}/files", response_model=List[File])
def get_files_for_conversation(
    conversation_id: int,
    request: Request,
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    conversation = db.get(Conversation, conversation_id)
    request_owner = get_owner

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    files = db.exec(
        select(File)
        .filter(File.conversation_id == conversation_id)
        .offset(offset)
        .limit(limit)
    ).all()

    repositories = db.exec(
        select(Repository).filter(Repository.conversation_id == conversation_id)
    ).all()

    git_files = []
    for repository in repositories:
        git, repo_id = repository.git, repository.repo_id

        g = github.Github(config.github_token)

        try:
            project = g.get_repo(f"{git}/{repo_id}")
        except github.UnknownObjectException:
            raise HTTPException(
                status_code=401,
                detail="Der Applikation ist kein Zugriff auf das Repository gewährt.",
            )

        git_files += fetch_git_files(repository, project, config, conversation_id, db)
    git_files = [File.model_validate(f) for f in git_files]

    return files + git_files


@router.get("/conversation/{conversation_id}/files/{file_id}", response_model=FileRead)
def get_specific_file_for_conversation(
    conversation_id: int,
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    # Currently doesn't work with Git files as those don't have file id's
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    file = db.exec(
        select(File).filter(
            File.id == file_id,
            File.conversation_id == conversation_id,
        )
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.post("/conversation/{conversation_id}/files", response_model=File)
def create_file(
    conversation_id: int,
    file: File,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    file_type = file.path.split("/")[-1].split(".")[-1]
    file.file_type = file_type

    if not any(file.path.endswith(t) for t in config.supported_types.keys()):
        raise HTTPException(
            status_code=204,
            detail=f"File type for '{file.path}' is not supported. Supported types: {config.supported_types.keys()}",
        )

    db_file = File.model_validate(file)
    conversation.files.append(db_file)
    update_conversation_last_changed(conversation_id, db)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@router.put("/conversation/{conversation_id}/files/{file_id}")
async def update_file(
    conversation_id: int,
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    file_to_update = db.get(File, file_id)
    body_json = await request.json()

    if not file_to_update:
        raise HTTPException(status_code=404, detail="File not found")
    if not body_json.get("updated_file"):
        raise HTTPException(status_code=400, detail="Updated file incomplete")

    updated_file = FileRead(**body_json["updated_file"])

    file_type = updated_file.path.split("/")[-1].split(".")[-1]
    updated_file.file_type = file_type

    if not any(updated_file.path.endswith(t) for t in config.supported_types.keys()):
        raise HTTPException(
            status_code=204,
            detail=f"File type for '{updated_file.path}' is not supported. Supported types: {config.supported_types.keys()}",
        )

    file_to_update.path = updated_file.path
    file_to_update.content = updated_file.content
    file_to_update.file_type = updated_file.file_type

    db.commit()
    db.refresh(file_to_update)

    update_conversation_last_changed(conversation_id, db)

    return file_to_update


@router.delete("/conversation/{conversation_id}/files/{file_id_or_null}")
def delete_file(
    conversation_id: int,
    file_id_or_null: str,
    path: str,
    git_id_or_null: str,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    file_id: int = int(file_id_or_null) if file_id_or_null != "null" else None
    git_id: int = int(git_id_or_null) if git_id_or_null != "null" else None

    if file_id:
        result = db.exec(
            select(File).filter(
                File.id == file_id, File.conversation_id == conversation_id
            )
        ).first()
        if not result:
            raise HTTPException(status_code=404, detail="File not found")

        conversation.files.remove(result)
        db.delete(result)
    else:
        if not git_id:
            raise HTTPException(
                status_code=400, detail="Git id is required to delete git files"
            )
        deleted_file = GitDeletedPath(repository_id=git_id, path=path)
        db.add(deleted_file)
    db.commit()

    update_conversation_last_changed(conversation_id, db)

    return {"message": "File deleted successfully"}


@router.delete("/conversation/{conversation_id}/directory", status_code=205)
def delete_directory(
    conversation_id: int,
    path: str,
    git_id_or_null: str,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    git_id: int = int(git_id_or_null) if git_id_or_null != "null" else None

    if not git_id:
        # Find and delete all files in the directory
        files = db.exec(
            select(File).filter(
                File.conversation_id == conversation_id, File.path.like(f"%{path}%")
            )
        ).all()

        if not files:
            raise HTTPException(status_code=404, detail="Directory not found")

        for file in files:
            db.delete(file)
    else:
        deleted_directory = GitDeletedPath(repository_id=git_id, path=path)
        db.add(deleted_directory)
    db.commit()

    update_conversation_last_changed(conversation_id, db)

    return


@router.put("/conversation/{conversation_id}/move_tree")
async def move_tree(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    update_conversation_last_changed(conversation_id, db)

    body_json = await request.json()

    if not body_json.get("node"):
        raise HTTPException(status_code=400, detail="node incomplete")
    if body_json.get("target_path") == None:  # Could be empty string
        raise HTTPException(status_code=400, detail="target_path incomplete")

    node = FileNode(**body_json["node"])
    target_path = body_json["target_path"]

    files_to_update: list[File] = []

    def move_tree_func(node: FileNode, target_path: str):
        normalized_target = target_path.rstrip("/")

        if getattr(node, "isFolder", False):
            for child in getattr(node, "children", []):
                child_target = (
                    f"{normalized_target}/{node.name}"
                    if normalized_target
                    else node.name
                )
                move_tree_func(child, child_target)
        else:
            file = db.exec(
                select(File).filter(
                    File.conversation_id == conversation_id,
                    File.path == node.path,
                )
            ).first()
            if not file:
                return  # if not found, could be a git file

            new_path = (
                f"{normalized_target}/{node.name}" if normalized_target else node.name
            )
            file.path = new_path
            files_to_update.append(file)

    try:
        if node.gitId:
            target_path = target_path.strip("/")
            target_path = f"{target_path}/{node.name}"
            git_moved_path = GitMovedPath(
                repository_id=node.gitId, old_path=node.path, new_path=target_path
            )
            db.add(git_moved_path)
            db.commit()
        else:
            move_tree_func(node, target_path)

            for f in files_to_update:
                db.add(f)
            if files_to_update:
                db.commit()

        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Documentation
@router.get(
    "/conversation/{conversation_id}/documentations",
    response_model=List[DocumentationRead],
)
def get_documentations_for_conversation(
    conversation_id: int,
    request: Request,
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    documentations = db.exec(
        select(Documentation)
        .filter(Documentation.conversation_id == conversation_id)
        .offset(offset)
        .limit(limit)
    ).all()
    return documentations


@router.get(
    "/conversation/{conversation_id}/documentations/{documentation_id}",
    response_model=DocumentationRead,
)
def get_specific_documentation_for_conversation(
    conversation_id: int,
    documentation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    documentation = db.exec(
        select(Documentation).filter(
            Documentation.id == documentation_id,
            Documentation.conversation_id == conversation_id,
        )
    ).first()
    if not documentation:
        raise HTTPException(status_code=404, detail="Documentation not found")
    return documentation


@router.post(
    "/conversation/{conversation_id}/documentations", response_model=Documentation
)
def create_documentation(
    conversation_id: int,
    documentation: Documentation,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db_documentation = Documentation.model_validate(documentation)
    conversation.documentation.append(db_documentation)
    db.add(db_documentation)
    db.commit()
    db.refresh(db_documentation)
    update_conversation_last_changed(conversation_id, db)
    return db_documentation


@router.put("/conversation/{conversation_id}/documentations/{documentation_id}")
def update_documentation(
    conversation_id: int,
    documentation_id: int,
    updated_documentation: Documentation,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    documentation_to_update = db.get(Documentation, documentation_id)

    if not documentation_to_update:
        raise HTTPException(status_code=404, detail="Documentation not found")

    documentation_to_update.path = updated_documentation.path
    documentation_to_update.content = updated_documentation.content

    db.commit()
    db.refresh(documentation_to_update)

    update_conversation_last_changed(conversation_id, db)

    return documentation_to_update


@router.delete("/conversation/{conversation_id}/documentations/{documentation_id}")
def delete_documentation(
    conversation_id: int,
    documentation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    documentation_to_delete = db.get(Documentation, documentation_id)

    if not documentation_to_delete:
        raise HTTPException(status_code=404, detail="Documentation not found")

    db.delete(documentation_to_delete)
    db.commit()

    update_conversation_last_changed(conversation_id, db)

    return {"message": "Documentation deleted successfully"}


# Github
@router.post(
    "/conversation/{conversation_id}/repository/{git_group}/{repo_id}",
    response_model=List[File],
)
def add_repository(
    conversation_id: int,
    git_group: str,
    repo_id: str,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    g = github.Github(auth=github.Auth.Token(config.github_token))

    try:
        project = g.get_repo(f"{git_group}/{repo_id}")
    except github.GithubException:
        raise HTTPException(
            status_code=401,
            detail="Der Applikation ist kein Zugriff auf das Repository gewährt.",
        )
    except github.UnknownObjectException:
        raise (
            HTTPException(
                status_code=404,
                detail="Das Repository konnte nicht gefunden werden.",
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Don't add git files to the database
    repository = Repository(
        conversation_id=conversation_id, git=git_group, repo_id=repo_id
    )
    conversation.repository = repository
    db.add(repository)
    db.commit()

    files_data = fetch_git_files(repository, project, config, conversation_id, db)
    files_data = [File.model_validate(f) for f in files_data]
    return files_data


# Documentation Generation
async def generate_and_stream_documentation(
    conversation_id: int,
    owner: str,
    db: Session,
    request: Request,
    repo_id: Optional[int] = None,
    model_name: Optional[str] = None,
    muster_id: Optional[int] = None,
    muster_name: Optional[str] = None,
):
    """
    An asynchronous generator that yields progress updates and the final documentation.
    """
    try:
        model_index = next(
            (
                i
                for i, model in enumerate(config.available_models)
                if model["name"] == model_name
            ),
            None,
        )

        # --- 1. GATHER ALL THE NECESSARY CONTENT ---
        files = get_files_for_conversation(
            conversation_id, request, db=db, get_owner=owner
        )

        if not files:
            yield create_sse_message({"status": "error", "message": "No files found"})
            return

        muster_content = ""
        if muster_id:
            muster_db = db.get(Muster, muster_id)
            if not muster_db or muster_db.owner != owner:
                yield create_sse_message(
                    {
                        "status": "error",
                        "message": "Custom muster not found or access denied",
                    }
                )
                return
            muster_content = muster_db.content
            muster_name = muster_db.name
        elif muster_name:
            muster_path = os.path.join(config.muster_directory, f"{muster_name}.md")
            if not os.path.exists(muster_path):
                yield create_sse_message(
                    {"status": "error", "message": "Predefined muster not found"}
                )
                return
            with open(muster_path, "r") as f:
                muster_content = f.read()
        else:
            yield create_sse_message(
                {
                    "status": "error",
                    "message": "A muster_id or muster_name must be provided",
                }
            )
            return

        chapters = re.findall(r"<!--PROGRESS:(.*?)-->", muster_content)
        total_chapters = (
            len(chapters) if len(chapters) > 0 else 1
        )  # Avoid division by zero

        muster_content = muster_content.replace(
            "{{Datum}}", datetime.datetime.now().strftime("%d.%m.%Y")
        )
        muster_content = muster_content.replace("{{Name des Entwicklers/Teams}}", owner)

        # --- 2. CONSTRUCT THE PROMPT FOR THE MODEL ---
        repository_content = "\n\n".join([str(f) for f in files])

        # flake8: noqa
        system_prompt = f"""Sie sind ein hochpräziser technischer Redakteur mit der Expertise eines erfahrenen Softwareentwicklers. Ihre Aufgabe ist es, eine fachlich-technische, maximal ausführliche Dokumentation für ein Software-Repository zu erstellen.

Ihre Arbeit unterliegt den folgenden unverhandelbaren Regeln:

---

# 1. GRUNDSATZ DER WAHRHEIT (Source of Truth)
Sie verwenden **ausschließlich** Informationen, die direkt aus den bereitgestellten `QUELLCODE-DATEIEN DES REPOSITORIES` ableitbar sind.  
Zulässige Informationsquellen sind: Dateinamen, Code, Kommentare, Metadateien (z. B. package.json, go.mod, pom.xml), Konfigurationsdateien, Projektstruktur und Klartextinhalte.

---

# 2. ZERO HALLUCINATION (KEINE ERFUNDENEN INFORMATIONEN)
Sie dürfen **niemals** Informationen erfinden, interpolieren oder schätzen.

Für jeden Platzhalter im Format `{{PLATZHALTER}}` gilt:

- **Wenn die Information im Repository vorhanden ist → füllen.**
- **Wenn die Information nicht ableitbar ist → Platzhalter entfernen.**
- Sie geben **keine Beispielwerte**, **keine Defaults**, **keine Mustertexte**, **keine generischen APIs** aus, wenn diese nicht im Code vorkommen.
- Beispiel- oder Dummy-Inhalte aus dem Muster werden konsequent entfernt, wenn sie nicht durch Code abgedeckt sind.

---

# 3. STRIKTE MUSTER-BINDUNG
Sie folgen **exakt** Struktur, Überschriften, Reihenfolge und Format des gegebenen `DOKUMENTATIONSGLIEDERUNG (MUSTER)`:

- Keine neuen Kapitel hinzufügen.
- Keine Kapitel umbenennen, außer falls in Klammern dabei steht "(falls zutreffend)".
- Keine Kapitel weglassen, außer wenn sie leer wären.
- **Alle Platzhalter im Format `{{...}}` müssen verarbeitet werden** wie unter Abschnitt 2 beschrieben.
- Alle `<!--PROGRESS:...-->` Tokens müssen unverändert übernommen werden.
- Musterkommentare wie `(falls zutreffend)` oder Beispiel-Abschnitte, die nicht zum Repository passen, werden **gelöscht**.

---

# 4. MAXIMALE VERBOSITÄT
Formulieren Sie **ausführlich, detailliert und erklärend**.  
Jeder gefüllte Abschnitt soll:

- Hintergründe und technische Zusammenhänge erläutern.
- Entscheidungen und Logiken aus dem Code ausführlich beschreiben.
- Komponentenzwecke und Interaktionen verständlich erklären.
- Komplexe Vorgänge in klarer, präziser Sprache darstellen.

Erklärungen müssen tief gehen, aber **niemals spekulativ** werden: Sie dürfen nur vertiefen, was tatsächlich im Code existiert oder logisch aus Code-Strukturen folgt.

---

# 5. MERMAID-DIAGRAMM-REGELN
Zur Fehlervermeidung müssen Mermaid-Diagramme folgende Regeln einhalten:

- **KEINE runden Klammern `(` oder `)` in Labels oder Knotennamen.**
- Beschreibungen nur mit Worten, Bindestrichen, Unterstrichen oder Doppelpunkten.
- Keine erklärenden Sätze oder Zusatztexte im Knoten selbst.
- Beschreibende Texte gehören in den Fließtext, nicht in Diagramm-Labels.

---

# 6. ARBEITSABLAUF
1. **Muster vollständig lesen und verstehen.**  
2. **Repository-Inhalte analysieren und alle ableitbaren Fakten extrahieren.**
3. **Dokumentation Abschnitt für Abschnitt erzeugen** und das Muster vollständig ausfüllen.

Die Ausgabe muss **reines Markdown** sein und ausschließlich die generierte Dokumentation enthalten, mit der ersten Überschrift aus dem Muster beginnend."""

        prompt_content = f"""### DOKUMENTATIONSGLIEDERUNG (MUSTER) ###

{muster_content}

### QUELLCODE-DATEIEN DES REPOSITORIES ###

{repository_content}

### IHRE AUSGABE ###

Erstellen Sie die vollständige Dokumentation im Markdown-Format. Die Ausgabe darf nur die generierte Markdown-Dokumentation enthalten, beginnend mit der ersten Überschrift aus dem Muster.
Entfernen Sie alle Beispielinhalte aus dem Muster, wenn sie nicht im Repository vorkommen. Ersetzen Sie nur Platzhalter, niemals Beispieltexte."""

        # --- 3. SEND THE REQUEST TO THE MODEL AND STREAM THE RESPONSE ---
        model = config.available_models[
            model_index if model_index else config.use_model_index
        ]

        client = OpenAI(base_url=model["endpoint"], api_key=config.api_key)

        full_response = ""
        chapters_completed = 0
        with client.chat.completions.stream(
            model=model["deployment_name"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_content},
            ],
            **model["client_args_documentation"],
        ) as stream:
            for event in stream:
                if hasattr(event, "chunk") and event.chunk.choices:
                    delta = event.chunk.choices[0].delta
                    if delta and delta.content:
                        content = delta.content
                        full_response += content

                        # Check for progress tokens
                        for i, chapter in enumerate(chapters):
                            if (
                                f"<!--PROGRESS:{chapter}-->" in full_response
                                and i + 1 > chapters_completed
                            ):
                                chapters_completed = i + 1
                                progress = int(
                                    (chapters_completed / total_chapters) * 100
                                )
                                yield create_sse_message(
                                    {
                                        "status": "generating",
                                        "progress": progress,
                                        "chapter": chapter,
                                    }
                                )

                        # Yield the generated content chunk to the frontend
                        yield create_sse_message(
                            {"status": "content", "chunk": content}
                        )

        if not full_response:
            raise Exception("No response from the model")

        # --- 4. SAVE THE FINAL DOCUMENTATION ---
        documentation = Documentation(
            conversation_id=conversation_id,
            path=f"documentation {muster_name}.md",
            content=full_response,
            repo_id=repo_id,
            muster=muster_content,
        )
        documentation = Documentation.model_validate(documentation)
        conversation = db.get(Conversation, conversation_id)
        conversation.documentation.append(documentation)
        db.add(documentation)
        db.commit()
        db.refresh(documentation)

        yield create_sse_message(
            {"status": "complete", "documentation_id": documentation.id}
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        # Ensure the error message is properly JSON-escaped
        yield create_sse_message({"status": "error", "message": str(e)})


@router.get(
    "/conversation/{conversation_id}/generate_documentation_stream",
)
async def generate_documentation_stream(
    conversation_id: int,
    request: Request,
    repo_id: Optional[int] = None,
    model_name: Optional[str] = None,
    muster_id: Optional[int] = None,
    muster_name: Optional[str] = None,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    update_conversation_last_changed(conversation_id, db)

    return StreamingResponse(
        generate_and_stream_documentation(
            conversation_id,
            request_owner,
            db,
            request,
            repo_id,
            model_name,
            muster_id,
            muster_name,
        ),
        media_type="text/event-stream",
    )


# Chat
async def stream_chat_response(
    conversation_id: int,
    user_message: str,
    model_name: Optional[str],
    db: Session,
    owner: str,
    request: Request,
):
    """
    An async generator that streams the chat response from the model.
    """
    # --- 0. SECURITY CHECK: Verify conversation ownership ---
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        # Use a specific error message format the frontend can parse
        payload = {"status": "error", "message": "Conversation not found"}
        yield f"data: {json.dumps(payload)}\n\n"
        return
    if conversation.owner != owner:
        payload = {"status": "error", "message": "Access denied to conversation"}
        yield f"data: {json.dumps(payload)}\n\n"
        return

    model_index = next(
        (
            i
            for i, model in enumerate(config.available_models)
            if model["name"] == model_name
        ),
        None,
    )

    # --- 1. GATHER CONTEXT: Files, Documentations, and History ---
    files = get_files_for_conversation(conversation_id, request, db=db, get_owner=owner)
    documentations = db.exec(
        select(Documentation).filter(Documentation.conversation_id == conversation_id)
    ).all()
    # Filter out custom delimiter tokens from user input to prevent injection
    for token in DELIMITER_TOKENS:
        user_message = user_message.replace(token, "")

    # Fetch existing history from the database
    db_history = db.exec(
        select(ChatHistory).filter(ChatHistory.conversation_id == conversation_id)
    ).first()
    history = parse_history_from_db(db_history.content) if db_history else []

    # Format the context for the prompt
    files_content = "\n\n".join([str(f) for f in files])
    docs_content = "\n\n".join([str(doc) for doc in documentations])

    # --- 2. CONSTRUCT THE PROMPT ---
    system_prompt = """Sie sind ein hilfreicher und erfahrener Software-Entwicklungs-Assistent.
Ihre Aufgabe ist es, Fragen basierend auf den bereitgestellten Kontext zu beantworten, der Quellcode-Dateien und bestehende Dokumentation umfasst.
Seien Sie knapp, genau und geben Sie Beispiele an Code, wenn dies hilfreich ist.
"""

    # We create a condensed context message to prepend to the history
    context_prompt = f"""### CONTEXT START ###

#### SOURCE CODE FILES ####
{files_content}

#### EXISTING DOCUMENTATION ####
{docs_content}

### CONTEXT END ###

Basierend auf dem Kontext oben, beantworten Sie bitte die folgende Frage.
"""

    # Construct the full message list for the API
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": context_prompt,
        },  # Provide context as a user message
    ]
    messages.extend(history)  # Add previous turns of the conversation
    messages.append(
        {"role": "user", "content": user_message}
    )  # Add the new user message

    # --- 3. SEND REQUEST TO THE MODEL AND STREAM ---
    model = config.available_models[
        model_index if model_index else config.use_model_index
    ]

    client = OpenAI(base_url=model["endpoint"], api_key=config.api_key)

    try:
        full_response = ""
        with client.chat.completions.stream(
            model=model["deployment_name"],
            messages=messages,
            **model["client_args_chat"],
        ) as stream:
            for event in stream:
                if hasattr(event, "chunk") and event.chunk.choices:
                    delta = event.chunk.choices[0].delta
                    if delta and delta.content:
                        content = delta.content
                        full_response += content
                        yield create_sse_message(
                            {"status": "content", "chunk": content}
                        )

        # --- 4. PERSIST THE NEW CHAT TURN TO THE DATABASE ---
        if not db_history:
            # Create a new history entry if one doesn't exist
            db_history = ChatHistory(conversation_id=conversation_id, content="")
            conversation.chat_history.append(db_history)
            db.add(db_history)

        # Append the new turn to the existing content
        new_turn = (
            f"{USER_TOKEN_START}{user_message}{USER_TOKEN_END}"
            f"{ASSISTANT_TOKEN_START}{full_response}{ASSISTANT_TOKEN_END}"
        )
        db_history.content += new_turn
        db.commit()

        yield f"data: {json.dumps({'status': 'complete'})}\n\n"

    except Exception as e:
        import traceback

        traceback.print_exc()
        yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"


@router.post("/conversation/{conversation_id}/chat")
async def chat_with_model(
    conversation_id: int,
    message: ChatMessage,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return StreamingResponse(
        stream_chat_response(
            conversation_id,
            message.message,
            message.model_name,
            db,
            request_owner,
            request,
        ),
        media_type="text/event-stream",
    )


@router.get("/conversation/{conversation_id}/chat_history", response_model=ChatHistory)
def get_chat_history(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    chat_history = db.exec(
        select(ChatHistory).filter(ChatHistory.conversation_id == conversation_id)
    ).first()
    if not chat_history:
        # It's not an error if history doesn't exist, just return an empty one.
        return ChatHistory(id=None, conversation_id=conversation_id, content="")
    return chat_history


@router.put(
    "/conversation/{conversation_id}/chat_history", response_model=ChatHistoryRead
)
def update_chat_history(
    conversation_id: int,
    history_update: ChatHistoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    chat_history = db.exec(
        select(ChatHistory).filter(ChatHistory.conversation_id == conversation_id)
    ).first()
    if not chat_history:
        # If it doesn't exist, create it (upsert behavior)
        chat_history = ChatHistory(
            conversation_id=conversation_id, content=history_update.content
        )
        conversation.chat_history.append(chat_history)
        db.add(chat_history)
    else:
        chat_history.content = history_update.content

    db.commit()
    db.refresh(chat_history)
    return chat_history


@router.delete("/conversation/{conversation_id}/chat_history", status_code=204)
def delete_chat_history(
    conversation_id: int,
    request: Request,
    db: Session = Depends(get_db),
    get_owner=Depends(get_jwt_owner_from_request),
):
    request_owner = get_owner
    conversation = db.get(Conversation, conversation_id)

    if not conversation or conversation.owner != request_owner:
        raise HTTPException(status_code=403, detail="Unauthorized")

    chat_history = db.exec(
        select(ChatHistory).filter(ChatHistory.conversation_id == conversation_id)
    ).first()
    if chat_history:
        db.delete(chat_history)
        db.commit()
    return


# Helper Functions
def parse_history_from_db(content: str) -> List[Dict[str, str]]:
    """Parses a delimited string from the DB into an OpenAI-compatible message list."""
    history = []
    pattern = re.compile(
        f"({USER_TOKEN_START}(.*?){USER_TOKEN_END}|{ASSISTANT_TOKEN_START}(.*?){ASSISTANT_TOKEN_END})",
        re.DOTALL,
    )
    matches = pattern.finditer(content)
    for match in matches:
        if match.group(2) is not None:  # User message
            history.append({"role": "user", "content": match.group(2)})
        elif match.group(3) is not None:  # Assistant message
            history.append({"role": "assistant", "content": match.group(3)})
    return history


def update_conversation_last_changed(
    conversation_id: int, db: Session = Depends(get_db)
):
    conversation = db.get(Conversation, conversation_id)
    conversation.last_changed = datetime.datetime.now()
    db.commit()


def create_sse_message(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def fetch_git_files(repository, repo, config, conversation_id, db, path=""):
    deleted_paths = db.exec(
        select(GitDeletedPath).filter(GitDeletedPath.repository_id == repository.id)
    )
    deleted_paths = [path.path for path in deleted_paths]

    moved_paths = list(
        db.exec(
            select(GitMovedPath).filter(GitMovedPath.repository_id == repository.id)
        )
    )

    files_data = []
    supported_types = config.supported_types.keys()
    contents = repo.get_contents(path)
    while contents:
        file_content = contents.pop(0)
        if file_content.type == "dir":
            contents.extend(repo.get_contents(file_content.path))
        elif any(file_content.path.endswith(ext) for ext in supported_types):
            content = file_content.decoded_content.decode("utf-8", errors="replace")
            if not content:
                continue
            file_handle_split = file_content.name.split(".")
            files_data.append(
                File(
                    conversation_id=conversation_id,
                    path=file_content.path,
                    content=content,
                    file_type=(
                        file_handle_split[-1] if len(file_handle_split) > 1 else ""
                    ),
                    git_id=repository.id,
                )
            )

    # Move Files
    _removed_path = True
    while _removed_path:
        _removed_path = False
        for moved_path in moved_paths:
            for file in files_data:
                if moved_path.old_path in file.path:
                    file.path = file.path.replace(
                        moved_path.old_path, moved_path.new_path
                    ).strip("/")
                    did_move = True
            if did_move:
                moved_paths.remove(moved_path)
                _removed_path = True
                break

    # Remove Files
    files_to_remove = []
    for file in files_data:
        if any(file.path.startswith(path) for path in deleted_paths):
            files_to_remove.append(file)
    files_data = list(filter(lambda item: item not in files_to_remove, files_data))

    return files_data
