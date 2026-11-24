# office-darts

Eine kleine Website für die Dartscheibe im Büro: Spielregeln, Hausregeln, Resultate, Ranglisten –
und Vorschläge, mit wem man als Nächstes spielen könnte. Ziel ist nicht nur Spass, sondern dass
Leute zusammen spielen, die sich im Arbeitsalltag sonst kaum begegnen.

> **Status:** Tablet-App im Ordner [`site/`](site/) – Treffer auf der Scheibe antippen, Resultat und
> Ranglisten ergeben sich daraus. Tests: `node test/scoring.test.js`. Weiteres in [PLAN.md](PLAN.md).

## Grundsätze

1. **Spielzeit ist keine Arbeitszeit.** Gespielt wird in der Pause oder vor bzw. nach der Arbeit.
   Wer spielt, ist ausgestempelt bzw. erfasst die Zeit nicht als Arbeitszeit. Das steht auf jeder
   Seite gut sichtbar – nicht im Kleingedruckten.
2. **Freiwillig.** Niemand muss mitspielen, niemand muss in einer Rangliste erscheinen.
3. **Rücksicht.** Lärm, Sicherheitsabstand, Pfeile wegräumen – die Hausregeln gelten für alle.
4. **Datenschutz.** Nur so viele Daten wie nötig. Mitmachen per Opt-in, Spitzname statt echtem
   Namen möglich, auf Wunsch gelöscht (Schweizer revDSG): Löschen geht über die Admin-PIN; ältere
   Stände in Neon bereinigt `darts_forget` (Befehl wird beim Löschen angezeigt). Heruntergeladene
   Sicherungsdateien enthalten den Namen weiterhin – darum nur so viele aufbewahren wie nötig.
5. **Begegnungen zählen.** Ein Spiel mit jemandem, mit dem man selten oder noch nie gespielt hat,
   gibt einen Bonus.

## Was die Website kann (geplant)

- **Info:** Regeln der gängigen Spiele (501, Cricket, Around the Clock), Hausregeln und der Hinweis
  zur Arbeitszeit.
- **Resultate erfassen:** Wer gegen wen, welches Spiel, wer hat gewonnen – in wenigen Sekunden am Handy.
- **Zwei Ranglisten:**
  - **Können** – eine Elo-Wertung: Wer gegen Stärkere gewinnt, steigt mehr.
  - **Vernetzung** – Punkte für neue und seltene Gegnerinnen und Gegner.
- **Vorschläge:** «Spiel doch mal gegen …» – bevorzugt Personen, mit denen man selten oder nie spielt,
  ähnlich stark ist und die in letzter Zeit aktiv waren.

## Versionen

Die Version steht in keiner Datei. Bei jedem Push auf `main` laufen die Tests; hat sich die App
(`site/`, `test/`) seit dem letzten Tag geändert, erstellt `.github/workflows/release.yml` Tag und
GitHub-Release: Patch +1, mit `[minor]` bzw. `[major]` im Commit-Betreff die entsprechende Stelle.
Release-Notes = Commit-Betreffe (also aussagekräftig schreiben, ohne Versionsnummer). Die App zeigt
die Version aus dem neuesten Release. Render deployt jeden Push selbst; Cache-Control `no-cache`
ist dort als Header gesetzt, darum gibt es kein `?v=` an CSS/JS.

## Sicherheit

Das Tablet hängt offen im Büro – geschützt ist, was Spass-Sabotage verhindert:
- **Admin-PIN** (beim ersten Öffnen der Einstellungen festgelegt, dort änderbar; vergessen → mit dem Neon-Zugang neu
  setzen) für Einstellungen, Löschen von Spielenden, Turnier abbrechen und Annullieren.
- **Geladene Daten werden geprüft** (Sicherungsdatei, Neon): fremde IDs, zu lange Texte oder unbekannte Personen
  werden abgelehnt; alles, was angezeigt wird, ist escaped; eine Content-Security-Policy lässt nur eigene Skripte
  und Verbindungen zu Neon und GitHub zu.
- **Neon:** Der Tablet-Benutzer darf nur `darts_save` aufrufen und lesen. Die Datenbank prüft Form und Grösse und
  behält 200 Stände plus einen pro Tag während eines Jahres – Spam kann die Geschichte nicht löschen.
- **Erfundene Resultate:** «Letzte Spiele» in der Rangliste markiert Unmögliches (zu wenige Pfeile, zu schnell
  erfasst); Annullieren mit PIN.
- **Kiosk-Modus** auf dem Tablet (Bildschirmfixierung), damit niemand an Adresszeile und Browser kommt.

## Mitmachen

Ideen und Rückmeldungen gerne als Issue. Der Plan mit den offenen Fragen steht in [PLAN.md](PLAN.md).

## Lizenz

MIT – siehe [LICENSE](LICENSE).
