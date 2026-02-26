# Vorlage für Code-Kommentare: `{{Applikationsname}}`

**Version:** `1.0.0`
**Letzte Aktualisierung:** `{{Datum}}`
**Hauptverantwortliche(r):** `{{Name des Entwicklers/Teams}}`

Dieses Dokument dient als Leitfaden und Vorlage für die Kommentierung von Quellcode. Das Ziel ist nicht, jede einzelne Zeile zu kommentieren, sondern Klarheit an Stellen zu schaffen, die nicht selbsterklärend sind.

<!--PROGRESS:Kapitel 1: Leitprinzipien für gute Kommentare-->
## Leitprinzipien für gute Kommentare

> <strong>Merke:</strong> Guter Code ist selbstdokumentierend. Kommentare sind dazu da, das zu erklären, was der Code selbst nicht ausdrücken kann: das **Warum**, nicht das **Was**.

Bevor Sie Kommentare hinzufügen, halten Sie sich bitte an die folgenden Prinzipien:

1.  **Erklären Sie die Absicht ("Why"):** Kommentieren Sie nicht, *was* eine Codezeile tut (z.B. `// i um eins erhöhen`), sondern *warum* sie es tut, falls es nicht offensichtlich ist (z.B. `// Wir müssen den Index manuell erhöhen, da wir eine Legacy-Bibliothek verwenden, die For-Each-Loops nicht unterstützt`).
2.  **Sprachstandards einhalten:** Nutzen Sie die von der Programmiersprache vorgesehenen Standards für Dokumentationskommentare (z.B. JSDoc für JavaScript/TypeScript, GoDoc für Go, JavaDoc für Java, Docstrings für Python). Diese können von Tools zur automatischen Generierung von Dokumentation genutzt werden.
3.  **Komplexe Logik erläutern:** Wenn ein Algorithmus komplex ist, eine bestimmte Geschäftsregel umsetzt oder mathematische Formeln enthält, fügen Sie einen Kommentar hinzu, der das Konzept auf einer höheren Ebene erklärt.
4.  **Workarounds und "Gotchas" markieren:** Wenn Sie einen unkonventionellen Lösungsansatz verwenden mussten, um einen Bug in einer externen Bibliothek zu umgehen oder eine unerwartete Performance-Optimierung vorzunehmen, dokumentieren Sie dies. Das bewahrt zukünftige Entwickler davor, Ihren Code "fälschlicherweise zu korrigieren".
5.  **Halten Sie Kommentare aktuell:** Ein veralteter, falscher Kommentar ist schlimmer als gar kein Kommentar. Wenn Sie Code ändern, stellen Sie sicher, dass auch die zugehörigen Kommentare aktualisiert werden.
6.  **Verwenden Sie `TODO` und `FIXME`:** Markieren Sie Stellen im Code, die noch überarbeitet werden müssen, mit standardisierten Tags.
    *   `// TODO: {{Beschreibung der ausstehenden Arbeit}} (z.B. Ticket-ID: JIRA-123)`
    *   `// FIXME: {{Beschreibung des bekannten Problems und warum es noch existiert}}`

---

<!--PROGRESS:Kapitel 2: Dokumentation der Skripte-->
## Dokumentation der Skripte

Übernehmen sie diese Vorlage, fügen Sie hier für jedes relevante Skript den vollständigen Code ein und ergänzen Sie ihn mit den notwendigen Kommentaren gemäß den oben genannten Prinzipien.

<hr>

### `{{dateiname1.ext}}`

```{{ext}}
/**
 * @file {{dateiname1.ext}}
 * @brief Beschreibt den Zweck dieser Datei in einem Satz.
 * @author {{Name des Entwicklers/Teams}}
 * @date {{Datum}}
 */

// Konstante für einen wichtigen Schwellenwert.
const MAX_LOGIN_ATTEMPTS = 3;

/**
 * Verarbeitet Benutzerdaten und bereitet sie für den Export vor.
 *
 * Diese Funktion aggregiert Daten aus mehreren Quellen und wendet eine komplexe Transformationslogik an.
 *
 * @param {object} userData - Das rohe Benutzerobjekt aus der Datenbank.
 * @param {string} userData.id - Die eindeutige ID des Benutzers.
 * @param {Array<object>} userActivities - Eine Liste der letzten Aktivitäten des Benutzers.
 * @returns {object|null} Ein transformiertes Objekt für den Export oder null, wenn die Daten ungültig sind.
 * @throws {Error} Wirft einen Fehler, wenn die Verbindung zum externen Anreicherungs-Service fehlschlägt.
 */
function processUserDataForExport(userData, userActivities) {
  if (!userData || !userData.id) {
    // Ungültige Eingabedaten führen zu einem sofortigen Abbruch.
    // Ein Loggen ist hier nicht nötig, da dies vom aufrufenden Service erwartet wird.
    return null;
  }

  // TODO: Die Anreicherung sollte in einen separaten, wiederverwendbaren Service
  // ausgelagert werden, sobald das Projekt "DataServices" live geht.
  const enrichedData = enrichWithExternalApi(userData.id);

  let processedData = {};

  // ...
  // [Hier folgt komplexer Code, der selbsterklärend ist und keine Kommentare benötigt]
  // ...

  // WORKAROUND: Das Legacy-Exportsystem erwartet Datumsangaben im non-standard
  // Format "YYYY/MM/DD". Wir müssen das ISO-Datum manuell konvertieren.
  // Dies sollte entfernt werden, sobald das Exportsystem auf Version 3.0 aktualisiert wurde.
  processedData.legacyDate = convertDateToLegacyFormat(enrichedData.timestamp);

  return processedData;
}
```

<hr>
