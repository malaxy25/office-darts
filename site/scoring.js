// Reine Rechenlogik – ohne Bildschirm, damit sie sich testen lässt (node test/scoring.test.js).
(function (root) {
  // Reihenfolge der Zahlen im Uhrzeigersinn, oben beginnend.
  const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  // Radien in Bildpunkten. Triple- und Double-Ring sind breiter als auf der echten Scheibe,
  // damit man sie auf dem Tablet gut trifft.
  const RINGS = {
    bullIn: 13, bullOut: 28,
    tripleIn: 112, tripleOut: 142,
    doubleIn: 170, doubleOut: 200,
    numbers: 230,
  };

  const MISS = { value: 0, mult: 0, points: 0, label: '0' };

  function hit(value, mult) {
    if (value === 0) return MISS;
    let label;
    if (value === 25) label = mult === 2 ? 'Bull' : '25';
    else label = (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + value;
    return { value, mult, points: value * mult, label };
  }

  // x/y relativ zur Scheibenmitte, y nach unten.
  function hitAt(x, y) {
    const r = Math.hypot(x, y);
    if (r > RINGS.doubleOut) return MISS;
    if (r <= RINGS.bullIn) return hit(25, 2);
    if (r <= RINGS.bullOut) return hit(25, 1);
    const angle = (Math.atan2(x, -y) * 180 / Math.PI + 360 + 9) % 360;
    const value = SEGMENTS[Math.floor(angle / 18) % 20];
    let mult = 1;
    if (r >= RINGS.tripleIn && r <= RINGS.tripleOut) mult = 3;
    else if (r >= RINGS.doubleIn) mult = 2;
    return hit(value, mult);
  }

  // Wohin die Markierung gehört, wenn ein Pfeil auf `h` korrigiert wird. Liegt der alte Punkt
  // schon im richtigen Segment, bleibt die Richtung und nur der Abstand zur Mitte ändert sich.
  // Daneben: keine Markierung (null).
  function positionFor(h, x, y) {
    if (h.value === 0) return null;
    if (h.value === 25 && h.mult === 2) return { x: 0, y: 0 };
    const known = x !== undefined && y !== undefined && (x !== 0 || y !== 0);
    const index = SEGMENTS.indexOf(h.value);
    let angle = known ? (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360 : index * 18;
    if (h.value !== 25 && hitAt(...polar(80, angle)).value !== h.value) angle = index * 18;
    const r0 = known ? Math.hypot(x, y) : 0;
    let r;
    if (h.value === 25) r = (RINGS.bullIn + RINGS.bullOut) / 2;
    else if (h.mult === 3) r = (RINGS.tripleIn + RINGS.tripleOut) / 2;
    else if (h.mult === 2) r = (RINGS.doubleIn + RINGS.doubleOut) / 2;
    else {
      // Single: innen oder aussen – das Feld, das näher beim alten Punkt liegt.
      const inner = (RINGS.bullOut + RINGS.tripleIn) / 2, outer = (RINGS.tripleOut + RINGS.doubleIn) / 2;
      r = Math.abs(r0 - outer) < Math.abs(r0 - inner) ? outer : inner;
    }
    const [px, py] = polar(r, angle);
    return { x: Math.round(px), y: Math.round(py) };
  }

  function polar(r, deg) {
    const a = deg * Math.PI / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  }

  // Wertet die Pfeile einer Aufnahme aus. Ergebnis: neuer Rest, ob überworfen (bust) oder
  // ausgecheckt, und wie viele Pfeile gezählt haben.
  function applyTurn(remaining, darts, doubleOut) {
    let rest = remaining;
    for (let i = 0; i < darts.length; i++) {
      const d = darts[i];
      const next = rest - d.points;
      const finishes = next === 0 && (!doubleOut || d.mult === 2);
      if (next < 0 || (next === 0 && !finishes) || (doubleOut && next === 1)) {
        return { remaining, bust: true, checkout: false, used: i + 1 };
      }
      if (finishes) return { remaining: 0, bust: false, checkout: true, used: i + 1 };
      rest = next;
    }
    return { remaining: rest, bust: false, checkout: false, used: darts.length };
  }

  // Alle möglichen Würfe, beliebte zuerst.
  const ALL = [];
  for (let v = 20; v >= 1; v--) ALL.push(hit(v, 3));
  ALL.push(hit(25, 2), hit(25, 1));
  for (let v = 20; v >= 1; v--) ALL.push(hit(v, 1));
  for (let v = 20; v >= 1; v--) ALL.push(hit(v, 2));
  const FINISH_ORDER = [20, 16, 8, 18, 12, 10, 4, 6, 14, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];
  const DOUBLES = FINISH_ORDER.map(v => hit(v, 2)).concat([hit(25, 2)]);

  // Vorschlag, wie man mit den verbleibenden Pfeilen auscheckt (oder null).
  function checkoutHint(rest, dartsLeft, doubleOut) {
    if (rest <= 0 || dartsLeft <= 0) return null;
    const finals = doubleOut ? DOUBLES : ALL;
    for (const f of finals) if (f.points === rest) return [f];
    if (dartsLeft >= 2) {
      for (const a of ALL) for (const f of finals) {
        if (a.points + f.points === rest) return [a, f];
      }
    }
    if (dartsLeft >= 3) {
      for (const a of ALL) for (const b of ALL) for (const f of finals) {
        if (a.points + b.points + f.points === rest) return [a, b, f];
      }
    }
    return null;
  }

  // ---- Cricket ----

  const CRICKET = [20, 19, 18, 17, 16, 15, 25];

  // marks: pro Person 7 Zahlen (Treffer auf 20 … 15, Bull, höchstens 3), points: pro Person.
  // Wertet die Pfeile von Person p aus. Ergebnis: neue marks/points, ob gewonnen, wie viele Pfeile zählten.
  function applyCricket(marks, points, p, darts) {
    const m = marks.map(row => row.slice());
    const pts = points.slice();
    for (let i = 0; i < darts.length; i++) {
      const d = darts[i];
      const k = CRICKET.indexOf(d.value);
      if (k >= 0) {
        const close = Math.min(d.mult, 3 - m[p][k]);
        m[p][k] += close;
        const open = m.some((row, o) => o !== p && row[k] < 3);
        if (open) pts[p] += (d.mult - close) * d.value;
      }
      const allClosed = m[p].every(n => n === 3);
      if (allClosed && pts.every(x => pts[p] >= x)) {
        return { marks: m, points: pts, win: true, used: i + 1 };
      }
    }
    return { marks: m, points: pts, win: false, used: darts.length };
  }

  // ---- Around the Clock ----

  const CLOCK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];

  // pos: Index in CLOCK, also das nächste Ziel. Double und Triple zählen als ein Treffer.
  function applyClock(pos, darts) {
    let next = pos;
    for (let i = 0; i < darts.length; i++) {
      if (darts[i].value === CLOCK[next]) next++;
      if (next === CLOCK.length) return { pos: next, win: true, used: i + 1 };
    }
    return { pos: next, win: false, used: darts.length };
  }

  // ---- Ranglisten ----

  const ELO_START = 1000;

  function expected(a, b) {
    return 1 / (1 + Math.pow(10, (b - a) / 400));
  }

  // games: [{ players: [id, ...], winner: id, date }], nach Datum sortiert.
  // Bei mehr als zwei Spielenden zählt jedes Paar (Siegerin/Sieger gegen jede Person) anteilig.
  function eloRatings(games) {
    const rating = {}, played = {}, won = {};
    const get = id => (rating[id] ??= ELO_START);
    for (const g of games) {
      const losers = g.players.filter(p => p !== g.winner);
      if (!g.winner || losers.length === 0) continue;
      const deltas = {};
      for (const l of losers) {
        const kw = (played[g.winner] ?? 0) < 10 ? 48 : 32;
        const kl = (played[l] ?? 0) < 10 ? 48 : 32;
        const e = expected(get(g.winner), get(l));
        deltas[g.winner] = (deltas[g.winner] ?? 0) + kw * (1 - e) / losers.length;
        deltas[l] = (deltas[l] ?? 0) - kl * (1 - e) / losers.length;
      }
      for (const id of Object.keys(deltas)) rating[id] = get(id) + deltas[id];
      for (const p of g.players) played[p] = (played[p] ?? 0) + 1;
      won[g.winner] = (won[g.winner] ?? 0) + 1;
    }
    return { rating, played, won };
  }

  function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  // Punkte für ein Spiel gegen jemanden, mit dem man schon `before` Mal gespielt hat.
  function meetPoints(before) {
    return before === 0 ? 10 : Math.max(1, Math.floor(10 / (1 + before)));
  }

  // Zeitraum eines Datums als Zahl (Ortszeit): 'year' → 2026, 'quarter' → Jahr * 4 + 0…3,
  // 'month' → Jahr * 12 + 0…11. Grössere Zahl = späterer Zeitraum.
  function periodOf(date, kind) {
    const d = new Date(date);
    const y = d.getFullYear(), m = d.getMonth();
    if (kind === 'year') return y;
    if (kind === 'quarter') return y * 4 + Math.floor(m / 3);
    return y * 12 + m;
  }
  const monthOf = date => periodOf(date, 'month');

  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September',
    'Oktober', 'November', 'Dezember'];
  function periodLabel(kind, key) {
    if (kind === 'year') return String(key);
    if (kind === 'quarter') return 'Q' + (key % 4 + 1) + ' ' + Math.floor(key / 4);
    return MONTHS[key % 12] + ' ' + Math.floor(key / 12);
  }

  // Erster Tag nach dem Zeitraum – zum Sortieren (Ende) und um abgeschlossene Zeiträume zu erkennen.
  function periodEnd(kind, key) {
    if (kind === 'year') return new Date(key + 1, 0, 1);
    if (kind === 'quarter') return new Date(Math.floor(key / 4), (key % 4) * 3 + 3, 1);
    return new Date(Math.floor(key / 12), key % 12 + 1, 1);
  }

  // Wie oft jedes Paar in den games gespielt hat.
  function pairCounts(games) {
    const counts = {};
    for (const g of games) {
      const ps = g.players;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = pairKey(ps[i], ps[j]);
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    return counts;
  }

  // Die Punkte eines Spiels hängen davon ab, wie oft das Paar im selben Kalendermonat schon gespielt
  // hat – jeden Monat gibt die erste Begegnung wieder 10. Summiert wird über alle games.
  function networkPoints(games) {
    const counts = {}, points = {}, opponents = {};
    for (const g of games) {
      const ps = g.players;
      const month = monthOf(g.date);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = month + ':' + pairKey(ps[i], ps[j]);
        const pts = meetPoints(counts[k] || 0);
        counts[k] = (counts[k] || 0) + 1;
        for (const p of [ps[i], ps[j]]) {
          points[p] = (points[p] || 0) + pts;
          if (!opponents[p]) opponents[p] = new Set();
          opponents[p].add(p === ps[i] ? ps[j] : ps[i]);
        }
      }
    }
    return { points, opponents };
  }

  // ---- Turnier (K.-o.) ----
  // Jede Runde wird neu ausgelost. Bei ungerader Zahl hat jemand ein Freilos – wer noch keines hatte,
  // kommt zuerst dran. Wer verliert, scheidet aus. Aus einem Halbfinal mit vier Personen gibt es den
  // kleinen Final (Platz 3) und den Final. Runde: { size, bye, matches: [{ id, kind?, a, b, winner }] }.
  // rnd: Zufallsfunktion wie Math.random (in den Tests fest, damit sie wiederholbar sind).

  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Name einer Runde nach der Anzahl Personen, die darin noch dabei sind.
  function roundName(size) {
    if (size <= 2) return 'Final';
    if (size <= 4) return 'Halbfinal';
    if (size <= 8) return 'Viertelfinal';
    if (size <= 16) return 'Achtelfinal';
    if (size <= 32) return 'Sechzehntelfinal';
    return 'Runde mit ' + size;
  }

  // Grösse aller Runden bei n Teilnehmenden, z. B. 5 → [5, 3, 2].
  function roundSizes(n) {
    const sizes = [n];
    while (n > 2) { n = Math.ceil(n / 2); sizes.push(n); }
    return sizes;
  }

  // Anzahl Spiele: alle ausser der Siegerin oder dem Sieger scheiden einmal aus, dazu der kleine Final.
  function tourneyGames(n) {
    return n - 1 + (roundSizes(n).indexOf(4) >= 0 ? 1 : 0);
  }

  const loserOf = m => (m.winner === m.a ? m.b : m.a);
  const roundDone = r => r.matches.every(m => m.winner);
  const advancing = r => r.matches.map(m => m.winner).concat(r.bye ? [r.bye] : []);

  function drawRound(t, players, rnd) {
    const ri = t.rounds.length;
    const round = { size: players.length, bye: null, matches: [] };
    if (players.length === 2) {
      const prev = t.rounds[ri - 1];
      if (prev && prev.size === 4) {
        const losers = prev.matches.map(loserOf);
        round.matches.push({ id: ri + '-third', kind: 'third', a: losers[0], b: losers[1], winner: null });
      }
      round.matches.push({ id: ri + '-final', kind: 'final', a: players[0], b: players[1], winner: null });
    } else {
      let rest = shuffle(players, rnd);
      if (rest.length % 2) {
        const byes = id => t.rounds.filter(r => r.bye === id).length;
        const min = Math.min.apply(null, rest.map(byes));
        round.bye = rest.filter(id => byes(id) === min)[0];   // rest ist schon gemischt → zufällig
        rest = rest.filter(id => id !== round.bye);
      }
      for (let i = 0; i < rest.length; i += 2) {
        round.matches.push({ id: ri + '-' + i / 2, a: rest[i], b: rest[i + 1], winner: null });
      }
    }
    t.rounds.push(round);
  }

  function tourneyStart(t, players, rnd) {
    if (players.length < 2) throw new Error('Mindestens zwei Personen');
    t.players = players.slice();
    t.rounds = [];
    t.done = false;
    drawRound(t, t.players, rnd);
    return t;
  }

  function findMatch(t, id) {
    for (const r of t.rounds) for (const m of r.matches) if (m.id === id) return m;
    return null;
  }

  // Trägt den Sieg ein; ist die Runde damit fertig, wird die nächste ausgelost.
  function tourneyResult(t, matchId, winner, rnd) {
    const m = findMatch(t, matchId);
    if (!m || m.winner || (winner !== m.a && winner !== m.b)) throw new Error('Spiel nicht offen');
    m.winner = winner;
    const last = t.rounds[t.rounds.length - 1];
    if (roundDone(last)) {
      if (last.size === 2) t.done = true;
      else drawRound(t, advancing(last), rnd);
    }
    return m;
  }

  // Nimmt einen Sieg zurück (falsch erfasst). Danach ausgeloste Runden fallen weg.
  function tourneyUndo(t, matchId) {
    const ri = t.rounds.findIndex(r => r.matches.some(m => m.id === matchId));
    if (ri < 0) return;
    t.rounds.length = ri + 1;
    const m = findMatch(t, matchId);
    Object.keys(m).forEach(k => { if (['id', 'kind', 'a', 'b'].indexOf(k) < 0) delete m[k]; });
    m.winner = null;
    t.done = false;
  }

  // Rangfolge am Schluss: [1., 2., 3., 4.] – Platz 4 nur mit kleinem Final. Vorher null.
  function tourneyPodium(t) {
    if (!t.done) return null;
    const fin = t.rounds[t.rounds.length - 1].matches;
    const final = fin.find(m => m.kind === 'final');
    const third = fin.find(m => m.kind === 'third');
    const podium = [final.winner, loserOf(final)];
    if (third) podium.push(third.winner, loserOf(third));
    else {
      const prev = t.rounds[t.rounds.length - 2];
      if (prev && prev.size === 3) podium.push(loserOf(prev.matches[0]));
    }
    return podium;
  }

  // Runden, die noch nicht ausgelost sind (nur ihre Grösse).
  function tourneyAhead(t) {
    if (t.done) return [];
    return roundSizes(t.rounds[t.rounds.length - 1].size).slice(1);
  }

  // ---- Geladene Daten prüfen (Sicherungsdatei, Datenbank) ----
  // Was nicht von dieser App stammen kann, wird abgelehnt – so kommt über eine präparierte Datei kein Code
  // in die Seite (IDs landen in HTML-Attributen) und keine unsinnig grossen Texte in die Ansicht.

  const ID = /^[A-Za-z0-9-]{1,40}$/;
  const KEY_NAME = /^[A-Za-z0-9_-]{1,40}$/;
  const ID_KEYS = ['id', 'a', 'b', 'winner', 'bye', 'tournament', 'gameId'];
  const MAX_TEXT = 200;
  const TEXT_LIMITS = { name: 40, banner: 120 };

  function cleanData(data) {
    const fail = what => { throw new Error('Datei ungültig: ' + what); };
    if (!data || typeof data !== 'object' || !Array.isArray(data.players) || !Array.isArray(data.games)) {
      fail('Spielende oder Spiele fehlen');
    }
    if (JSON.stringify(data).length > 2000000) fail('zu gross');
    (function walk(v, key, depth) {
      if (depth > 12) fail('zu tief verschachtelt');
      if (v === null || typeof v === 'boolean') return;
      if (typeof v === 'number') { if (!isFinite(v)) fail('Zahl'); return; }
      if (typeof v === 'string') {
        if (ID_KEYS.indexOf(key) >= 0 && !ID.test(v)) fail('ID');
        if (v.length > MAX_TEXT) fail('Text zu lang');
        return;
      }
      if (Array.isArray(v)) { v.forEach(x => walk(x, key === 'players' ? 'id' : key, depth + 1)); return; }
      if (typeof v !== 'object') fail('Wert');
      Object.keys(v).forEach(k => {
        if (!KEY_NAME.test(k) || k === '__proto__' || k === 'constructor' || k === 'prototype') fail('Feldname');
        walk(v[k], k, depth + 1);
      });
    })(data, '', 0);

    const known = new Set();
    data.players.forEach(p => {
      if (!p || !ID.test(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > TEXT_LIMITS.name) fail('Spielende');
      known.add(p.id);
    });
    const people = (list, min, max) => Array.isArray(list) && list.length >= min && list.length <= max &&
      list.every(id => known.has(id));
    const validDate = d => typeof d === 'string' && !isNaN(Date.parse(d));
    data.games.forEach(g => {
      if (!g || !ID.test(g.id) || !validDate(g.date) || !people(g.players, 2, 4) || g.players.indexOf(g.winner) < 0 ||
          typeof g.mode !== 'string' || g.mode.length > 20) fail('Spiel');
    });
    if (data.settings !== undefined) {
      const s = data.settings;
      if (!s || typeof s !== 'object' || Array.isArray(s)) fail('Einstellungen');
      Object.keys(TEXT_LIMITS).forEach(k => {
        if (s[k] !== undefined && (typeof s[k] !== 'string' || s[k].length > TEXT_LIMITS[k])) fail('Einstellungen');
      });
    }
    if (data.tournaments !== undefined) {
      if (!Array.isArray(data.tournaments)) fail('Turniere');
      data.tournaments.forEach(t => {
        if (!t || !ID.test(t.id) || typeof t.name !== 'string' || t.name.length > 40 || !validDate(t.date) ||
            ['x01', 'cricket', 'clock'].indexOf(t.mode) < 0 || !people(t.players, 2, 64) || !Array.isArray(t.rounds)) fail('Turnier');
        t.rounds.forEach(r => {
          if (!r || !Array.isArray(r.matches) || (r.bye != null && !known.has(r.bye))) fail('Turnier');
          r.matches.forEach(m => {
            if (!m || !known.has(m.a) || !known.has(m.b) || (m.winner != null && m.winner !== m.a && m.winner !== m.b)) fail('Turnier');
          });
        });
      });
    }
    return data;
  }

  // ---- Plausibilität eines Spiels (nur Hinweis, entscheiden muss ein Mensch) ----

  // Weniger Pfeile kann niemand brauchen: höchstens 60 Punkte pro Pfeil (501 → 9, 301 → 6).
  const minDarts = start => Math.max(1, Math.ceil(start / 60));
  const MIN_SECONDS_PER_DART = 2;   // werfen, Pfeile holen, antippen – schneller geht es nur beim Erfinden

  // Gründe, warum ein erfasstes Spiel auffällt – leer, wenn nichts auffällt.
  function suspicious(g) {
    const why = [];
    const i = g.players.indexOf(g.winner);
    const start = parseInt(g.mode, 10);
    if (start > 0 && Array.isArray(g.darts) && g.darts[i] < minDarts(start)) {
      why.push(`${g.darts[i]} Pfeile für ${start} sind unmöglich`);
    }
    const total = Array.isArray(g.darts) ? g.darts.reduce((s, n) => s + n, 0) : 0;
    if (typeof g.secs === 'number' && total && g.secs < total * MIN_SECONDS_PER_DART) {
      why.push(`${total} Pfeile in ${g.secs} Sekunden erfasst`);
    }
    return why;
  }

  const api = {
    SEGMENTS, RINGS, MISS, hit, hitAt, positionFor, applyTurn, checkoutHint,
    CRICKET, applyCricket, CLOCK, applyClock,
    ELO_START, eloRatings, meetPoints, networkPoints, pairCounts, pairKey, monthOf,
    periodOf, periodLabel, periodEnd,
    roundName, roundSizes, tourneyGames, tourneyStart, tourneyResult, tourneyUndo, tourneyPodium,
    tourneyAhead, findMatch, cleanData, minDarts, suspicious,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Darts = api;
})(this);
