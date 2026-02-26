# Fachlich-Technische Dokumentation: `{{Applikationsname}}`

**Version:** `1.0.0`
**Letzte Aktualisierung:** `{{Datum}}`
**Hauptverantwortliche(r):** `{{Name des Entwicklers/Teams}}`

<!--
    HINWEIS FÜR DEN ENTWICKLER:
    Dieses Dokument dient als technische Referenz für andere Entwickler, DevOps-Engineers und zukünftige Maintainer.
    Sei präzise, aber verständlich. Vermeide Jargon, wo es geht, oder erkläre ihn im Glossar.
    Aktualisiere dieses Dokument bei jeder signifikanten Änderung an der Architektur oder Kernlogik.
-->

***

## 1. Einleitung und Überblick

<!--PROGRESS:Kapitel 1.1: Zweck der Applikation-->
### 1.1. Zweck der Applikation
*   **Problem:** {{PROBLEMSTELLUNG}}
*   **Lösung:** {{LÖSUNG_HIGH_LEVEL}}
*   **Kontext:** {{KONTEXT}}

<!--PROGRESS:Kapitel 1.2: Zielgruppe-->
### 1.2. Zielgruppe
{{ZIELGRUPPE}}

<!--PROGRESS:Kapitel 1.3: Kernfunktionen-->
### 1.3. Kernfunktionen
{{KERNFUNKTIONEN_LISTE}}

## 2. Architektur

<!--PROGRESS:Kapitel 2.1: High-Level-Überblick-->
### 2.1. High-Level-Überblick
> **Tipp:** Füge hier ein Diagramm ein (z.B. als Bild oder Mermaid-Diagramm), das die Hauptkomponenten und deren Interaktionen zeigt. Dies ist oft der hilfreichste Teil der gesamten Dokumentation. Dieses Diagramm soll ersetzt oder weggelassen werden:

```mermaid
graph TD
    A[Benutzer/Client] --> B{Load Balancer};
    B --> C[Applikation: {{APPLIKATIONSNAME}}];
    C -- Lese-/Schreibzugriff --> D[(Datenbank)];
    C -- Ruft Daten ab --> E[Externer Service/API];
    C -- Sendet Events --> F((Message Queue));
```

<!--PROGRESS:Kapitel 2.2: Technologie-Stack-->
### 2.2. Technologie-Stack
Eine Liste der primären Technologien, Frameworks und Bibliotheken.

| Bereich        | Technologie/Tool          | Version        | Anmerkung                                    |
|----------------|---------------------------|----------------|----------------------------------------------|
| **Sprache**      | `{{SPRACHE}}`               | `{{SPRACHE_VERSION}}`  |                                              |
| **Framework**    | `{{FRAMEWORK}}`             | `{{FRAMEWORK_VERSION}}`|                                              |
| **Datenbank**    | `{{DATENBANK}}`             | `{{DATENBANK_VERSION}}`|                                              |
| **Caching**      | `{{CACHING_TOOL}}`          | `{{CACHING_VERSION}}`  | Optional, falls verwendet.                   |
| **Laufzeitumg.** | `{{LAUFZEITUMGEBUNG}}`      | `{{LAUFZEIT_VERSION}}` |                                              |
| **Testing**      | `{{TESTING_FRAMEWORK}}`     | `{{TESTING_VERSION}}`  |                                              |

<!--PROGRESS:Kapitel 2.3: Komponenten und Verantwortlichkeiten-->
### 2.3. Komponenten und Verantwortlichkeiten
{{KOMPONENTEN_UND_VERANTWORTLICHKEITEN}}

## 3. Setup und Inbetriebnahme (Lokal)

<!--PROGRESS:Kapitel 3.1: Voraussetzungen-->
### 3.1. Voraussetzungen
{{VORAUSSETZUNGEN_LISTE}}

<!--PROGRESS:Kapitel 3.2: Installation-->
### 3.2. Installation
Schritt-für-Schritt-Anleitung, um das Projekt zum Laufen zu bringen.

1.  **Repository klonen:**
    ```bash
    git clone {{GIT_REPO_URL}}
    cd {{PROJEKTVERZEICHNIS}}
    ```

2.  **Abhängigkeiten installieren:**
    ```bash
    {{BEFEHL_INSTALLATION}}
    ```

3.  **Datenbank und Services starten (falls nötig):**
    ```bash
    {{BEFEHL_SERVICES_STARTEN}}
    ```

<!--PROGRESS:Kapitel 3.3: Konfiguration-->
### 3.3. Konfiguration
Die Applikation wird über Umgebungsvariablen konfiguriert. Kopiere die Vorlage und passe sie an.

```bash
cp .env.example .env
```

**Wichtige Umgebungsvariablen:**

| Variable          | Beschreibung                                    | Standardwert |
|-------------------|-------------------------------------------------|--------------|
| `PORT`            | Der Port, auf dem die Applikation lauscht.        | `{{PORT_DEFAULT}}`         |
| `DATABASE_URL`    | Verbindungs-URL zur Datenbank.                  | `{{DB_URL_DEFAULT}}`     |
| `LOG_LEVEL`       | Das Loglevel (z.B. `debug`, `info`, `warn`).      | `{{LOG_LEVEL_DEFAULT}}`         |
| `EXTERNAL_API_KEY`| API-Schlüssel für den Zugriff auf Service X.      | `{{EXT_API_KEY_DEFAULT}}`     |
<!-- Füge hier weitere wichtige Umgebungsvariablen aus .env.example ein -->

<!--PROGRESS:Kapitel 3.4: Anwendung starten-->
### 3.4. Anwendung starten
```bash
{{BEFEHL_ANWENDUNG_STARTEN}}
```
Die Applikation ist nun unter `http://localhost:{{PORT}}` erreichbar.

<!--PROGRESS:Kapitel 3.5: Tests ausführen-->
### 3.5. Tests ausführen
```bash
{{BEFEHL_TESTS_AUSFUEHREN}}
```

## 4. API-Dokumentation (falls zutreffend)

> **Hinweis:** Für umfangreiche APIs sollte eine separate Spezifikation (z.B. OpenAPI/Swagger) gepflegt und hier verlinkt werden. Dieser Abschnitt dient als schnelle Referenz.

<!--PROGRESS:Kapitel 4.1: Authentifizierung-->
### 4.1. Authentifizierung
Anfragen an geschützte Endpunkte erfordern einen `Authorization`-Header mit einem Bearer-Token.
`Authorization: Bearer [JWT_TOKEN]`

<!--PROGRESS:Kapitel 4.2: Wichtige Endpunkte-->
### 4.2. Wichtige Endpunkte

<details>
<summary><code>POST /api/v1/resource</code> - Erstellt eine neue Ressource</summary>

*   **Beschreibung:** Erstellt eine neue Ressource basierend auf den übergebenen Daten.
*   **Request Body:**
    ```json
    {
      "name": "Beispiel Ressource",
      "value": 42
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "id": "uuid-1234-abcd",
      "name": "Beispiel Ressource",
      "value": 42,
      "createdAt": "2023-10-27T10:00:00Z"
    }
    ```
*   **Error Response (400 Bad Request):**
    ```json
    {
      "statusCode": 400,
      "message": "Validation failed: 'name' should not be empty"
    }
    ```
</details>

<details>
<summary><code>GET /api/v1/resource/{id}</code> - Ruft eine Ressource ab</summary>

*   **Beschreibung:** Ruft eine spezifische Ressource anhand ihrer ID ab.
*   **URL Parameter:** `id` (string, UUID)
*   **Success Response (200 OK):**
    ```json
    {
      "id": "uuid-1234-abcd",
      "name": "Beispiel Ressource",
      "value": 42,
      "createdAt": "2023-10-27T10:00:00Z"
    }
    ```
*   **Error Response (404 Not Found):**
    ```json
    {
      "statusCode": 404,
      "message": "Resource not found"
    }
    ```
</details>

## 5. Wichtige Konzepte und Logik

<!--PROGRESS:Kapitel 5: Konzepte-->
### 5.1. `[Konzept A, z.B. Status-Management]`
Beschreibe hier eine zentrale oder komplexe Logik der Applikation. Warum wurde sie so implementiert? Welche Zustände gibt es und wie sind die Übergänge?

### 5.2. `[Konzept B, z.B. Caching-Strategie]`
Wie und was wird gecacht? Wann werden Caches invalidiert?

<!--PROGRESS:Kapitel 6: Datenmodell-->
## 6. Datenmodell / Persistenz (falls zutreffend)
Eine Beschreibung des Datenbankschemas.

*   **Tabelle `[table_name_a]`:** Speichert Informationen über [...].
    *   `id` (PK): Eindeutiger Identifikator.
    *   `name` (VARCHAR): Der Name von [...].
    *   `created_at` (TIMESTAMP): Zeitstempel der Erstellung.
*   **Tabelle `[table_name_b]`:** [...]

> **Tipp:** Füge hier ein Entity-Relationship-Diagramm (ERD) ein, um die Beziehungen zwischen den Tabellen zu visualisieren.

## 7. Betrieb und Monitoring

<!--PROGRESS:Kapitel 7: Logging-->
### 7.1. Logging
Logs werden im JSON-Format auf `stdout` geschrieben. Wichtige Log-Felder sind:
*   `level`: `debug`, `info`, `warn`, `error`
*   `timestamp`: Zeitstempel des Logs.
*   `message`: Die Log-Nachricht.
*   `correlationId`: Eine ID, um Anfragen über Systemgrenzen hinweg zu verfolgen.

<!--PROGRESS:Kapitel 7.2: Monitoring & Metriken-->
### 7.2. Monitoring & Metriken
Die Applikation stellt einen `/metrics`-Endpunkt im Prometheus-Format bereit. Wichtige Metriken sind:
*   `http_requests_total`: Anzahl der HTTP-Anfragen.
*   `http_request_duration_seconds`: Latenz der Anfragen.
*   `database_query_errors_total`: Anzahl fehlgeschlagener DB-Abfragen.

<!--PROGRESS:Kapitel 7.3: Troubleshooting-->
### 7.3. Troubleshooting
*   **Problem:** Die Applikation startet nicht und meldet "DATABASE_URL is not set".
    *   **Lösung:** Stelle sicher, dass die `.env`-Datei existiert und die Variable `DATABASE_URL` korrekt gesetzt ist.
*   **Problem:** Anfragen schlagen mit HTTP 503 fehl.
    *   **Lösung:** Prüfe die Verbindung zur Datenbank und zu externen Services. Schaue in die Logs für detailliertere Fehlermeldungen.

## 8. Anhang

<!--PROGRESS:Kapitel 8: Anhang-->
### 8.1. Glossar
*   **`[Fachbegriff A]`:** Definition des Begriffs im Kontext dieser Applikation.
*   **`[Fachbegriff B]`:** Definition...

### 8.2. Ansprechpartner
* `[Name, Team, E-Mail]`