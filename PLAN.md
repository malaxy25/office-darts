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
- Ranglisten «Können» (Elo) und «Vernetzung» pro Quartal, «Mit wem noch nie?».
- Daten bleiben im Browser des Tablets (localStorage). Sicherung als JSON herunterladen/laden.
- Reine statische Seite → gratis als Render Static Site, schläft nie.

Später möglich: Daten zusätzlich an Neon senden, damit Ranglisten auch am Handy sichtbar sind.

## Phase 2 – Resultate und Ranglisten

- **Anmelden:** einfach halten. Varianten (zu entscheiden):
  - Login über das Firmenkonto (Microsoft 365) – kein eigenes Passwort, nur Mitarbeitende.
  - Oder ein Link per E-Mail an die Firmenadresse («Magic Link»).
- **Profil:** Spitzname, optional echter Name, Opt-in für die Ranglisten, «alles löschen».
- **Resultat erfassen:** zwei Spielende, Spielart, Sieger. Die Gegnerin oder der Gegner bestätigt mit
  einem Klick – so gibt es keine erfundenen Siege.
- **Rangliste «Können»:** Elo (Start 1000, K-Faktor 32, bei neuen Spielenden höher).
- **Rangliste «Vernetzung»:** Punkte pro bestätigtem Spiel, abhängig davon, wie selten das Paar
  zusammen spielt:
  - erstes Spiel gegeneinander: **10 Punkte**
  - danach `max(1, 10 / (1 + Anzahl bisheriger Spiele))` – also 5, 3, 2, … und mindestens 1
  - optional: Bonus, wenn die beiden aus verschiedenen Teams kommen (nur falls Teams erfasst werden)
  Getrennt von «Können», damit die Elo-Wertung fair bleibt.
- **Saison:** Ranglisten pro Quartal neu, die Gesamtstatistik bleibt.

## Phase 3 – Vorschläge «Mit wem spiele ich?»

Für jede Person eine kurze Liste mit Vorschlägen. Bewertung pro möglichem Gegenüber:

```
Vorschlag = Seltenheit × Aktivität × Spannung
  Seltenheit = 1 / (1 + Spiele miteinander)          → neue Begegnungen zuerst
  Aktivität  = hat in den letzten 30 Tagen gespielt   → (1.0 / 0.5 / 0.2)
  Spannung   = ähnlich stark (Elo-Abstand klein)      → exp(-(Elo-Abstand / 300)²)
```

- Nur Personen, die Vorschläge erlauben (Opt-in).
- «Heute im Büro» (freiwillig anklicken) erhöht die Chance, vorgeschlagen zu werden.
- Kein Druck: keine Benachrichtigungen ohne Einwilligung.

## Technik

Alles soll **kostenlos** bleiben (Stand Oktober 2026):

- **Infoseite (Phase 1):** Render **Static Site** – gratis, schläft nie, lädt sofort.
- **App (Phase 2/3):** **Python** (FastAPI oder Flask) mit HTML-Seiten vom Server, wenig JavaScript,
  als Render **Web Service** (gratis). Der schläft nach 15 Minuten ohne Besuch ein; der erste Aufruf
  danach dauert etwa eine Minute. Falls das stört: während der Bürozeiten alle 10 Minuten anpingen
  (750 Gratis-Stunden pro Monat reichen dafür).
- **Datenbank:** **Neon** (Postgres, gratis: 0.5 GB pro Projekt, ohne Ablaufdatum, ohne Kreditkarte).
  Nicht Render Postgres – die Gratis-Datenbank läuft dort nach 30 Tagen ab und wird gelöscht. Und keine
  Datei-Datenbank (SQLite) auf Render: die Gratis-Instanz hat keine bleibende Festplatte.
- **Tests** für die Wertungen (Elo, Vernetzungspunkte, Vorschläge) von Anfang an.

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
2. **Anmeldung:** Microsoft-365-Login (braucht eine App-Registrierung durch die IT) oder Magic Link?
3. **Namen in der Rangliste:** Spitzname als Standard, echter Name nur auf Wunsch?
4. **Teams/Abteilungen** erfassen für den Vernetzungs-Bonus – ja oder nein?
5. **Wer betreut** Website und Daten (Löschanfragen, Saisonwechsel)?
6. **Domain:** eigene Subdomain oder Render-Adresse?
