// Ausführen: node test/scoring.test.js
const assert = require('assert');
const D = require('../site/scoring.js');

const R = D.RINGS;
const mid = (a, b) => (a + b) / 2;
// Punkt auf Radius r, Winkel in Grad im Uhrzeigersinn ab oben
const at = (r, deg) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)];

assert.strictEqual(D.hitAt(0, 0).label, 'Bull');
assert.strictEqual(D.hitAt(0, -20).label, '25');
assert.strictEqual(D.hitAt(...at(mid(R.tripleIn, R.tripleOut), 0)).label, 'T20');
assert.strictEqual(D.hitAt(...at(mid(R.doubleIn, R.doubleOut), 90)).label, 'D6');
assert.strictEqual(D.hitAt(...at(80, 180)).label, '3');
assert.strictEqual(D.hitAt(...at(80, 270)).label, '11');
assert.strictEqual(D.hitAt(...at(80, 18)).label, '1');
assert.strictEqual(D.hitAt(...at(80, 342)).label, '5');
assert.strictEqual(D.hitAt(...at(R.doubleOut + 5, 0)).points, 0);

const h = D.hit;
// normale Aufnahme
assert.deepStrictEqual(D.applyTurn(501, [h(20, 3), h(20, 3), h(20, 3)], true),
  { remaining: 321, bust: false, checkout: false, used: 3 });
// Checkout mit Double
assert.deepStrictEqual(D.applyTurn(40, [h(20, 2)], true), { remaining: 0, bust: false, checkout: true, used: 1 });
// Bull zählt als Double
assert.strictEqual(D.applyTurn(50, [h(25, 2)], true).checkout, true);
// genau 0 ohne Double: überworfen
assert.strictEqual(D.applyTurn(40, [h(20, 1), h(20, 1)], true).bust, true);
// Single-Out: genügt
assert.strictEqual(D.applyTurn(40, [h(20, 1), h(20, 1)], false).checkout, true);
// Rest 1 bei Double-Out: überworfen
assert.strictEqual(D.applyTurn(21, [h(20, 1)], true).bust, true);
// unter 0: überworfen, Rest unverändert
assert.deepStrictEqual(D.applyTurn(30, [h(20, 1), h(20, 1)], true), { remaining: 30, bust: true, checkout: false, used: 2 });

// Finish-Vorschläge
assert.deepStrictEqual(D.checkoutHint(40, 1, true).map(x => x.label), ['D20']);
assert.deepStrictEqual(D.checkoutHint(170, 3, true).map(x => x.label), ['T20', 'T20', 'Bull']);
assert.strictEqual(D.checkoutHint(169, 3, true), null);
assert.strictEqual(D.checkoutHint(41, 1, true), null);
assert.strictEqual(D.checkoutHint(41, 2, true).length, 2);

// Vernetzung: 10, 5, 3, 2, 2, 1 …
assert.deepStrictEqual([0, 1, 2, 3, 4, 9, 50].map(D.meetPoints), [10, 5, 3, 2, 2, 1, 1]);
const g = (a, b, w = a, date = '2026-10-14T12:00:00') => ({ players: [a, b], winner: w, date });
const net = D.networkPoints([g('a', 'b'), g('a', 'b'), g('a', 'c')]);
assert.strictEqual(net.points.a, 25);
assert.strictEqual(net.points.b, 15);
assert.strictEqual(net.points.c, 10);
// neuer Monat: erste Begegnung gibt wieder 10, die Punkte werden weiter summiert
const nov = D.networkPoints([g('a', 'b'), g('a', 'b'), g('a', 'b', 'a', '2026-11-02T12:00:00')]);
assert.strictEqual(nov.points.a, 25);
// Anzahl Spiele pro Paar über alle Zeit
assert.deepStrictEqual(D.pairCounts([g('a', 'b'), g('b', 'a', 'b', '2025-01-01T12:00:00')]), { 'a|b': 2 });

// Elo: Sieg gegen Gleichstarke, neue Spielende K=48
const elo = D.eloRatings([g('a', 'b')]);
assert.strictEqual(elo.rating.a, 1024);
assert.strictEqual(elo.rating.b, 976);
assert.strictEqual(elo.won.a, 1);
// Summe bleibt gleich bei gleichem K
const elo3 = D.eloRatings([{ players: ['a', 'b', 'c'], winner: 'a' }]);
assert.ok(Math.abs(elo3.rating.a + elo3.rating.b + elo3.rating.c - 3000) < 1e-9);

console.log('Alle Tests bestanden.');

// Korrektur: Markierung landet im korrigierten Feld
const moved = (h, x, y) => { const p = D.positionFor(h, x, y); return D.hitAt(p.x, p.y).label; };
const [x19, y19] = at(80, 11 * 18);                       // Single 19 (innen)
assert.strictEqual(moved(h(19, 2), x19, y19), 'D19');
assert.strictEqual(moved(h(19, 3), x19, y19), 'T19');
assert.strictEqual(moved(h(19, 1), ...at(185, 11 * 18)), '19'); // D19 → Single
assert.strictEqual(moved(h(20, 3), x19, y19), 'T20');      // falsches Segment → ins richtige
assert.strictEqual(moved(h(25, 2), x19, y19), 'Bull');
assert.strictEqual(moved(h(25, 1), x19, y19), '25');
assert.strictEqual(moved(h(7, 2), undefined, undefined), 'D7'); // ohne alten Punkt
assert.strictEqual(D.positionFor(D.MISS, x19, y19), null);
// gleiche Richtung bleibt erhalten, wenn das Segment stimmt
const p19 = D.positionFor(h(19, 3), ...at(80, 11 * 18 + 5));
assert.ok(Math.abs((Math.atan2(p19.x, -p19.y) * 180 / Math.PI + 360) % 360 - (11 * 18 + 5)) < 1);

console.log('Korrektur-Tests bestanden.');

// Cricket
const zero = () => [0, 0, 0, 0, 0, 0, 0];
let c = D.applyCricket([zero(), zero()], [0, 0], 0, [h(20, 3), h(20, 2), h(1, 3)]);
assert.deepStrictEqual(c.marks[0], [3, 0, 0, 0, 0, 0, 0]);
assert.strictEqual(c.points[0], 40);                       // T20 schliesst, D20 bringt 40
assert.strictEqual(c.used, 3);
// geschlossen beim Gegenüber: keine Punkte mehr
c = D.applyCricket([[3, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0]], [0, 0], 1, [h(20, 3)]);
assert.strictEqual(c.points[1], 0);
// Bull: 25 zählt einfach, Bull doppelt
c = D.applyCricket([[0, 0, 0, 0, 0, 0, 2], zero()], [0, 0], 0, [h(25, 2)]);
assert.strictEqual(c.marks[0][6], 3);
assert.strictEqual(c.points[0], 25);
// Sieg: alles zu und gleich viele Punkte
const almost = [3, 3, 3, 3, 3, 3, 2];
c = D.applyCricket([almost, zero()], [0, 0], 0, [h(25, 1), h(20, 1)]);
assert.strictEqual(c.win, true);
assert.strictEqual(c.used, 1);
// alles zu, aber weniger Punkte: noch nicht gewonnen
c = D.applyCricket([almost, zero()], [0, 30], 0, [h(25, 1)]);
assert.strictEqual(c.win, false);
// … mit Punkten auf einem offenen Feld des Gegenübers schon
c = D.applyCricket([almost, zero()], [0, 30], 0, [h(25, 1), h(20, 2)]);
assert.strictEqual(c.win, true);
assert.strictEqual(c.points[0], 40);
// zu dritt: Punkte, solange noch jemand das Feld offen hat
c = D.applyCricket([[3, 0, 0, 0, 0, 0, 0], [3, 0, 0, 0, 0, 0, 0], zero()], [0, 0, 0], 0, [h(20, 1)]);
assert.strictEqual(c.points[0], 20);

// Around the Clock
assert.deepStrictEqual(D.applyClock(0, [h(1, 1), h(2, 3), h(5, 1)]), { pos: 2, win: false, used: 3 });
assert.strictEqual(D.applyClock(0, [h(1, 3)]).pos, 1);        // Triple zählt als ein Treffer
assert.strictEqual(D.applyClock(19, [h(20, 1), h(25, 1)]).win, true);
assert.strictEqual(D.applyClock(20, [h(25, 2), h(20, 1)]).used, 1);

console.log('Cricket- und Around-the-Clock-Tests bestanden.');
