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

  // pairCounts: wie oft jedes Paar schon gespielt hat (vor dem Zeitraum der games).
  function networkPoints(games, pairCounts = {}) {
    const counts = { ...pairCounts }, points = {}, opponents = {};
    for (const g of games) {
      const ps = g.players;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = pairKey(ps[i], ps[j]);
        const pts = meetPoints(counts[k] ?? 0);
        counts[k] = (counts[k] ?? 0) + 1;
        for (const p of [ps[i], ps[j]]) {
          points[p] = (points[p] ?? 0) + pts;
          (opponents[p] ??= new Set()).add(p === ps[i] ? ps[j] : ps[i]);
        }
      }
    }
    return { points, opponents, counts };
  }

  function pairCounts(games) {
    return networkPoints(games).counts;
  }

  const api = {
    SEGMENTS, RINGS, MISS, hit, hitAt, applyTurn, checkoutHint,
    ELO_START, eloRatings, meetPoints, networkPoints, pairCounts, pairKey,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Darts = api;
})(this);
