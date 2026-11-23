# Plan

In kleinen Schritten, jeder für sich nützlich. Die Firma wird nur in der Konfiguration der laufenden
Website genannt (Name, Logo, interne Regeln), nicht im öffentlichen Code.

## Phase 1 – Infoseite

Eine statische Seite, sofort einsetzbar, auch ohne Ranglisten:

- **Spielzeit ist keine Arbeitszeit** – als Banner oben auf jeder Seite.
- **Spielregeln** kurz und mit Beispielen:
  - **501** (Double-Out, wahlweise Single-Out für Einsteigende)
  - **Cricket** (15–20 und Bull schliessen, Punkte sammeln)
  - **Around the Clock** (1 bis 20 der Reihe nach – gut für Anfängerinnen und Anfänger)
- **Hausregeln:** Wurflinie 2.37 m, Scheibenmitte 1.73 m hoch; niemand zwischen Linie und Scheibe;
  Lautstärke; Pfeile zurück in den Halter; defekte Pfeile melden.
- **Erste Schritte:** Wie man ausbullt, wer beginnt, wie gezählt wird.

## Phase 1b – Tablet an der Scheibe (umgesetzt, Ordner `site/`)

Ein Tablet hängt neben der Scheibe. Dort werden die Treffer direkt erfasst, das Resultat ergibt sich
von selbst – kein Login, keine Bestätigung nötig (das Gegenüber steht ja daneben).

- Scheibe antippen, wo die drei Pfeile stecken → «Bestätigen» → nächste Person.
- 501/301, Double-Out oder Single-Out, Überworfen-Regel, Finish-Vorschlag, Korrigieren pro Pfeil.
- Cricket (Tafel mit / ✕ und geschlossenen Feldern) und Around the Clock (Ziel auf der Scheibe hell).
  Alle Spielarten zählen gemeinsam für die Ranglisten.
- Ranglisten «Können» (Elo) und «Vernetzung» – Standard «Gesamt», Filter nach Jahr, Quartal oder Monat –,
  Ehrentafel mit den Besten jedes abgeschlossenen Zeitraums, «Mit wem noch nie?».
- Einstellungen: Sicherung (mit Erinnerung nach 14 Tagen), vorgewähltes Spiel, Name, Banner, Neu beginnen.
- Bildschirm bleibt an, solange die App offen ist (Wake Lock).
- Daten bleiben im Browser des Tablets (localStorage). Sicherung als JSON herunterladen/laden.
- Speicher: «Dauerhaft speichern» (Browser räumt nicht von selbst auf) und optional Neon – nach jeder
  Änderung wird der ganze Stand angehängt (Benutzer `darts_tablet` darf nur anhängen und lesen, die
  letzten 200 Stände bleiben). Zugang nur auf dem Tablet eingetragen, nicht im Code.
- Reine statische Seite → gratis als Render Static Site, schläft nie.

- **Turnier (K.-o.):** Teilnehmende aus der Liste wählen, Name, Spielart (Standard 301), Schalter «zählt für
  die Ranglisten» (Standard aus). Jede Runde neu ausgelost, bei ungerader Zahl ein Freilos (wer am wenigsten
  hatte), Anwurf ausgelost, kleiner Final um Platz 3 und Final, kampflos weiter möglich. Plan als Spalten
  pro Runde mit Resultaten (Rest und Ø bzw. Punkte), Podest am Schluss, Kacheln aller Turniere (Plan wieder ansehen), Turnierliste in der Rangliste.

Später möglich: Ranglisten aus Neon auch am Handy anzeigen.

## Verworfen: Phase 2 und 3 (23.11.2026)

Eigene Konten mit Anmeldung (Microsoft 365 oder Magic Link), Resultate am Handy erfassen mit Bestätigung
und Vorschläge «Mit wem spiele ich?». Andrea: nicht nötig – erfasst wird
gemeinsam auf dem Tablet bei der Scheibe, die Ranglisten (Elo, Vernetzung) und die Neon-Sicherung laufen dort schon.

## Technik

Alles soll **kostenlos** bleiben (Stand Oktober 2026):

- **Infoseite (Phase 1):** Render **Static Site** – gratis, schläft nie, lädt sofort.
- **Datenbank:** **Neon** (Postgres, gratis: 0.5 GB pro Projekt, ohne Ablaufdatum, ohne Kreditkarte).
  Nicht Render Postgres – die Gratis-Datenbank läuft dort nach 30 Tagen ab und wird gelöscht. Und keine
  Datei-Datenbank (SQLite) auf Render: die Gratis-Instanz hat keine bleibende Festplatte.
- **Tests** für Wertung und Turnier: `node test/scoring.test.js`.

## Backlog

- [ ] **Läuft auch auf alten iPads (iOS 12 / Safari 12)**, z. B. iPad Air 1 (ME988). Keine
  Geräteerkennung, sondern ein Code für alle Geräte:
  - JavaScript ohne `??` und `??=` (startet sonst auf Safari 12 gar nicht); `file.text()` durch
    `FileReader` ersetzen.
  - CSS mit Ersatzregeln: `clamp()` (Spaltenbreite im Querformat), `inset` (Sieg-Fenster),
    `gap` bei Flexbox (Abstände der Knöpfe), `display: contents` (Erfassung im Hochformat), `dvh`.
  - Schlusstest auf dem echten Gerät (Safari 12 lässt sich hier nicht nachstellen).

## Offene Fragen

1. **Freigabe:** Geschäftsleitung bzw. HR – Aufhängen der Scheibe, Ort, und die Formulierung
   «Spielzeit ist keine Arbeitszeit» (wie wird das erfasst: ausstempeln, Pause?).
2. **Wer betreut** Website und Daten (Löschanfragen, Saisonwechsel)?
3. **Domain:** eigene Subdomain oder Render-Adresse?
