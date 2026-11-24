# Backlog Office Darts

## Stand (24.11.2026)

- **Zuletzt (24.11.2026):** Härtung für den Einsatz bei Tocco: Admin-PIN, Prüfung geladener Daten, CSP,
  «Letzte Spiele» mit Annullieren und Plausibilität, neues Neon-SQL. Vorher (23.11.): Turniermodus (K.-o. mit Freilos, kleiner Final, grafischer Plan). Vorher: ☰-Menü, automatische Versionierung, Neon.
- **Nächster Schritt:** neues Tablet einrichten, sobald es da ist: Huawei MatePad 10.4 (gebraucht, Galaxus, bestellt 24.11.;
  HarmonyOS ohne Google, Huawei-Browser). Altes Blackview Tab 9 ist defekt. Einrichten: Seite als Icon auf den
  Startbildschirm, «Dauerhaft speichern», Admin-PIN festlegen (beim ersten Öffnen der Einstellungen), Neon-Zugang
  eintragen, Sicherung laden; danach Turnier am Gerät testen.
  **Kiosk:** App vom Startbildschirm starten (Vollbild, keine Adresszeile), Bildschirmfixierung von HarmonyOS
  einschalten (in den Sicherheits-Einstellungen, heisst «Bildschirmfixierung» oder «App-Fixierung»; Lösen nur mit
  Entsperr-Code), USB-Debugging aus, Gerätesperre mit eigenem Code. Menüpfad am Gerät prüfen.
  Phase 2/3 (Konten, Anmeldung) verworfen 23.11. – erfasst wird auf dem Tablet.
- **Andrea, einmal in Neon:** das SQL unter Einstellungen → «Datenbank einrichten» ab `create or replace function`
  im SQL-Editor ausführen (darts_save mit Prüfung und Aufbewahrung nach Zeit, darts_forget, Benutzer einschränken).
  Den Datenbanknamen in `revoke temporary on database neondb` anpassen, falls er anders heisst.
- **GitHub:** Branch-Schutz für `main` einschalten (kein Force-Push, kein Löschen).
- **Offene Fragen an Andrea:** keine
- **Voraussetzungen / Startcheck:** keiner. Push löst ein Release aus.

## Offen

Die Phasen und Ideen stehen in `PLAN.md`; hier nur, was konkret ansteht.

- Ranglisten aus Neon auch am Handy anzeigen (`PLAN.md`, «Später möglich»)
- Turnier am echten Tablet testen (Plan bei vielen Personen, Hochformat)
- Ideen Turnier: «Best of 3» für den Final
