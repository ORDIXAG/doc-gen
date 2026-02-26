# Anwendung: Dokumentationsgenerator

Für eine Übersicht der Routen des Backends, siehe http://localhost:2320/dokumentationsgenerator_backend/docs nachdem das Backend gestartet worden ist.

## Prerequesits

Ein GitHub Token und der richtige OpenAI API Key sind als Secret erforderlich.
Um die Anwendung lokal zu nutzen, müssen diese als Environment Variablen abgesetzt sein, wie z.B:

```bash
export OPENAI_API_KEY="..."
export GITHUB_TOKEN="..."
```

*Hinweis: Der GitHub Token ist nicht notwendig, kann aber zu Rate-Limit-Problemen führen, falls dieser nicht angegeben wird.*

## Starten der Anwendung

```bash
pip install poetry
```

```bash
poetry lock
```

```bash
poetry install
```

```bash
poetry run start
```

## 🧪 Anwendung testen

### Code-Qualität

**Code Qualität prüfen & automatische Bereinigung**

```bash
pip install black flake8
flake8 .
black .
```

### Unit-Tests & Komponenten-Tests

```bash
pytest
```

## Docker

```bash
docker build -t dokumentationsgenerator .

docker run -p 2320:2320 dokumentationsgenerator
```
