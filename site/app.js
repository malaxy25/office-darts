/* global Darts */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---- Speicher (nur auf diesem Gerät) ----

  const KEY = 'officeDarts.v1';
  const KEY_GAME = 'officeDarts.current';
  const KEY_BACKUP = 'officeDarts.lastBackup';
  // Zugang zur Datenbank – bewusst nicht in db, damit er nicht in der Sicherungsdatei landet.
  const KEY_CLOUD = 'officeDarts.cloud';

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* voll oder gesperrt – weiterspielen geht trotzdem */ }
  }

  let db = load(KEY, { players: [], games: [] });
  let game = load(KEY_GAME, null);
  const saveDb = () => { save(KEY, db); cloudChanged(); };
  const saveGame = () => save(KEY_GAME, game);

  // Einstellungen liegen in db und kommen so mit in die Sicherung.
  const DEFAULTS = {
    name: 'Office Darts',
    banner: 'Spielzeit ist keine Arbeitszeit – bitte als Pause erfassen.',
    mode: '301',
    out: 'single',
  };
  const setting = k => db.settings && k in db.settings ? db.settings[k] : DEFAULTS[k];

  const activePlayers = () => db.players.filter(p => !p.deleted);
  const playerName = id => (db.players.find(p => p.id === id) || { name: '?' }).name;

  // ---- Ansichten ----

  function show(view) {
    $$('.tabs button[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const id = view === 'play' ? (game ? 'view-play' : 'view-setup') : 'view-' + view;
    $$('main.view').forEach(m => { m.hidden = m.id !== id; });
    document.body.classList.toggle('playing', id === 'view-play');
    $('#btn-abort').hidden = id !== 'view-play';
    if (id === 'view-setup') renderSetup();
    if (id === 'view-play') renderPlay();
    if (view === 'ranking') renderRanking();
    if (view === 'players') renderPlayers();
    if (view === 'settings') renderSettings();
  }
  $$('.tabs button[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

  // ---- Neues Spiel ----

  let picked = [];

  function renderSetup() {
    const players = activePlayers();
    picked = picked.filter(id => players.some(p => p.id === id));
    $('#setup-empty').hidden = players.length > 0;
    // Wer als Erstes gewählt ist, sieht bei allen anderen, wie viele Vernetzungspunkte ein Spiel bringt.
    const month = Darts.monthOf(new Date());
    const counts = Darts.pairCounts(db.games.filter(g => Darts.monthOf(g.date) === month));
    const me = picked[0];
    const bonus = id => Darts.meetPoints(counts[Darts.pairKey(me, id)] || 0);
    const best = Math.max(0, ...players.filter(p => !picked.includes(p.id)).map(p => bonus(p.id)));
    $('#setup-players').innerHTML = players.map(p => {
      const i = picked.indexOf(p.id);
      let badge = '';
      if (me && i < 0) {
        const b = bonus(p.id);
        badge = `<span class="badge ${b === best ? 'best' : ''}">${b === best ? '★ ' : ''}+${b}</span>`;
      }
      return `<button data-id="${p.id}" class="${i >= 0 ? 'on' : ''}">` +
        (i >= 0 ? `<span class="order">${i + 1}</span>` : '') + esc(p.name) + badge + '</button>';
    }).join('');
    $('#setup-hint').textContent = me
      ? `+Punkte: was ein Spiel ${playerName(me)} in der Rangliste «Vernetzung» bringt. ★ = am meisten.`
      : 'Spielende in Wurfreihenfolge antippen (2–4).';
    $('#setup-start').disabled = picked.length < 2;
    const days = backupDue();
    $('#setup-backup').hidden = days === null;
    if (days !== null) $('#setup-backup').textContent = backupText(days) + ' – unter «Einstellungen» sichern.';
  }

  $('#setup-players').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = b.dataset.id;
    if (picked.includes(id)) picked = picked.filter(x => x !== id);
    else if (picked.length < 4) picked.push(id);
    renderSetup();
  });

  // Spielarten: 'x01' (501/301), 'cricket', 'clock' (Around the Clock).
  const MODE_NAMES = { cricket: 'Cricket', clock: 'Around the Clock' };
  const isX01 = g => !g.mode || g.mode === 'x01';
  const settingsOf = g => ({ mode: g.mode || 'x01', start: g.start, doubleOut: g.doubleOut });

  function startGame(players, s) {
    game = {
      id: uid(),
      mode: s.mode,
      start: s.start,
      doubleOut: s.doubleOut,
      players,
      thrown: players.map(() => 0),   // gezählte Pfeile
      current: 0,
      darts: [],
      startedAt: new Date().toISOString(),
    };
    if (s.mode === 'cricket') {
      game.marks = players.map(() => Darts.CRICKET.map(() => 0));
      game.points = players.map(() => 0);
    } else if (s.mode === 'clock') {
      game.pos = players.map(() => 0);  // Index des nächsten Ziels
    } else {
      game.rest = players.map(() => s.start);
      game.scored = players.map(() => 0);  // erzielte Punkte
    }
    saveGame();
    show('play');
  }

  const setupMode = () => {
    const v = $('#setup-mode').value;
    return MODE_NAMES[v] ? v : 'x01';
  };
  $('#setup-mode').addEventListener('change', () => {
    $('#setup-out-label').hidden = setupMode() !== 'x01';
  });

  $('#setup-start').addEventListener('click', () => {
    const mode = setupMode();
    startGame(picked.slice(), {
      mode,
      start: mode === 'x01' ? Number($('#setup-mode').value) : 0,
      doubleOut: $('#setup-out').value === 'double',
    });
  });

  // ---- Scheibe ----

  const SVG = 'http://www.w3.org/2000/svg';
  const board = $('#board');

  function pt(r, deg) {
    const a = deg * Math.PI / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  }
  function sector(r1, r2, a1, a2) {
    const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
    return `M${x1},${y1}A${r2},${r2} 0 0 1 ${x2},${y2}L${x3},${y3}A${r1},${r1} 0 0 0 ${x4},${y4}Z`;
  }
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVG, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawBoard() {
    const R = Darts.RINGS;
    const css = getComputedStyle(document.documentElement);
    const c = name => css.getPropertyValue(name).trim();
    el('circle', { r: R.numbers, fill: '#0c0c0c', class: 'seg' }, board);
    Darts.SEGMENTS.forEach((n, i) => {
      const a1 = i * 18 - 9, a2 = a1 + 18;
      const dark = i % 2 === 0;
      const plain = dark ? c('--board-dark') : c('--board-light');
      const ring = dark ? c('--board-red') : c('--board-green');
      el('path', { d: sector(R.bullOut, R.tripleIn, a1, a2), fill: plain, class: 'seg', 'data-v': n }, board);
      el('path', { d: sector(R.tripleIn, R.tripleOut, a1, a2), fill: ring, class: 'seg', 'data-v': n }, board);
      el('path', { d: sector(R.tripleOut, R.doubleIn, a1, a2), fill: plain, class: 'seg', 'data-v': n }, board);
      el('path', { d: sector(R.doubleIn, R.doubleOut, a1, a2), fill: ring, class: 'seg', 'data-v': n }, board);
      const [x, y] = pt((R.doubleOut + R.numbers) / 2, i * 18);
      el('text', { x, y, class: 'num', 'data-v': n }, board).textContent = n;
    });
    el('circle', { r: R.bullOut, fill: c('--board-green'), class: 'seg', 'data-v': 25 }, board);
    el('circle', { r: R.bullIn, fill: c('--board-red'), class: 'seg', 'data-v': 25 }, board);
    for (const r of [R.bullIn, R.bullOut, R.tripleIn, R.tripleOut, R.doubleIn, R.doubleOut]) {
      el('circle', { r, class: 'wire' }, board);
    }
    for (let i = 0; i < 20; i++) {
      const [x1, y1] = pt(R.bullOut, i * 18 - 9), [x2, y2] = pt(R.doubleOut, i * 18 - 9);
      el('line', { x1, y1, x2, y2, class: 'wire' }, board);
    }
    el('g', { id: 'marks' }, board);
  }

  function boardPoint(e) {
    const p = board.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(board.getScreenCTM().inverse());
  }

  board.addEventListener('click', e => {
    if (!game || turnClosed()) return;
    const { x, y } = boardPoint(e);
    const h = Darts.hitAt(x, y);
    addDart({ ...h, x: Math.round(x), y: Math.round(y) });
    const f = el('circle', { cx: x, cy: y, r: 26, fill: '#fff', class: 'flash' }, board);
    setTimeout(() => f.remove(), 400);
  });

  // ---- Laufendes Spiel ----

  // Wertet die Pfeile der laufenden Aufnahme aus. Immer dabei: used (gezählte Pfeile), win.
  function result() {
    const p = game.current;
    if (game.mode === 'cricket') return Darts.applyCricket(game.marks, game.points, p, game.darts);
    if (game.mode === 'clock') return Darts.applyClock(game.pos[p], game.darts);
    const r = Darts.applyTurn(game.rest[p], game.darts, game.doubleOut);
    r.win = r.checkout;
    return r;
  }
  const turnClosed = () => {
    const r = result();
    return game.darts.length >= 3 || r.bust || r.win;
  };

  function addDart(d) {
    game.darts.push(d);
    saveGame();
    renderPlay();
  }

  $('#btn-miss').addEventListener('click', () => {
    if (game && !turnClosed()) addDart({ ...Darts.MISS });
  });
  $('#btn-undo').addEventListener('click', () => {
    if (!game || game.darts.length === 0) return;
    game.darts.pop();
    saveGame();
    renderPlay();
  });

  // Pfeil antippen → Feld korrigieren (Single/Double/Triple oder 0).
  let editing = -1;
  $('#darts').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) {
      const i = Number(b.dataset.i);
      editing = editing === i ? -1 : i;
      renderPlay();
      return;
    }
    const m = e.target.closest('[data-mult]');
    if (m && editing >= 0) {
      const d = game.darts[editing];
      const mult = Number(m.dataset.mult);
      const fixed = mult === 0 ? { ...Darts.MISS } : Darts.hit(d.value || 20, d.value === 25 ? Math.min(mult, 2) : mult);
      // Markierung auf der Scheibe ins korrigierte Feld verschieben.
      game.darts[editing] = { ...fixed, ...Darts.positionFor(fixed, d.x, d.y) };
      editing = -1;
      game.darts = game.darts.slice(0, result().used);
      saveGame();
      renderPlay();
    }
  });

  $('#btn-confirm').addEventListener('click', () => {
    if (!game) return;
    const before = JSON.parse(JSON.stringify(game));
    const r = result();
    const p = game.current;
    game.thrown[p] += r.used;
    if (game.mode === 'cricket') {
      game.marks = r.marks;
      game.points = r.points;
    } else if (game.mode === 'clock') {
      game.pos[p] = r.pos;
    } else if (!r.bust) {
      game.scored[p] += game.rest[p] - r.remaining;
      game.rest[p] = r.remaining;
    }
    game.darts = [];
    editing = -1;
    if (r.win) {
      finishGame(game.players[p], before);
      return;
    }
    game.current = (p + 1) % game.players.length;
    saveGame();
    renderPlay();
  });

  $('#btn-abort').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.dataset.armed) {
      game = null;
      saveGame();
      delete b.dataset.armed;
      b.textContent = 'Spiel abbrechen';
      show('play');
    } else {
      b.dataset.armed = '1';
      b.textContent = 'Wirklich abbrechen? Nochmals tippen.';
      setTimeout(() => { delete b.dataset.armed; b.textContent = 'Spiel abbrechen'; }, 4000);
    }
  });

  const avg = i => game.thrown[i] ? (game.scored[i] / game.thrown[i] * 3).toFixed(1) : '–';
  const target = pos => pos >= Darts.CLOCK.length ? '✓' : Darts.CLOCK[pos] === 25 ? 'Bull' : Darts.CLOCK[pos];
  const sum = a => a.reduce((s, n) => s + n, 0);

  function scoreCard(i, p, sub, pts) {
    return `<div class="score ${i === p ? 'current' : ''}"><span class="name">${esc(playerName(game.players[i]))}` +
      `<span class="avg">${sub}</span></span><span class="pts">${pts}</span></div>`;
  }

  // Cricket: Felder als Zeilen, Spielende als Spalten. / = 1 Treffer, ✕ = 2, eingekreist = geschlossen.
  function cricketTable(p, r) {
    const sym = n => n === 0 ? '' : n === 1 ? '/' : n === 2 ? '✕' : '<span class="closed">✕</span>';
    const cls = i => i === p ? 'current' : '';
    let html = '<table class="cricket"><tr><th></th>' +
      game.players.map((id, i) => `<th class="${cls(i)}">${esc(playerName(id))}</th>`).join('') + '</tr>';
    html += '<tr class="total"><td></td>' + r.points.map((n, i) => `<td class="${cls(i)}">${n}</td>`).join('') + '</tr>';
    Darts.CRICKET.forEach((v, k) => {
      const done = r.marks.every(row => row[k] === 3);
      html += `<tr class="${done ? 'done' : ''}"><td class="field">${v === 25 ? 'Bull' : v}</td>` +
        r.marks.map((row, i) => `<td class="${cls(i)}">${sym(row[k])}</td>`).join('') + '</tr>';
    });
    return html + '</table>';
  }

  function renderScores(p, r) {
    let html;
    if (game.mode === 'cricket') {
      html = cricketTable(p, r);
    } else if (game.mode === 'clock') {
      html = game.players.map((id, i) => scoreCard(i, p, 'Ziel', target(i === p ? r.pos : game.pos[i]))).join('');
    } else {
      html = game.players.map((id, i) => scoreCard(i, p, `Ø ${avg(i)}`, i === p && !r.bust ? r.remaining : game.rest[i])).join('');
    }
    $('#scores').innerHTML = html;
    $('#scores').classList.toggle('has-table', game.mode === 'cricket');
  }

  function turnText(p, r, closed) {
    const n = game.darts.length;
    if (game.mode === 'cricket') {
      if (r.win) return 'Gewonnen! 🎯';
      if (!n) return 'Es zählen 15–20 und Bull.';
      const gained = r.points[p] - game.points[p];
      return `Aufnahme: ${sum(r.marks[p]) - sum(game.marks[p])} Treffer` + (gained ? ` · +${gained} Punkte` : '');
    }
    if (game.mode === 'clock') {
      if (r.win) return 'Durch! 🎯';
      return `Ziel: ${target(r.pos)}` + (n ? ` · Aufnahme: ${r.pos - game.pos[p]} Treffer` : '');
    }
    if (r.bust) return 'Überworfen – die Aufnahme zählt nicht.';
    if (r.checkout) return 'Ausgecheckt! 🎯';
    const pts = game.darts.reduce((s, d) => s + d.points, 0);
    const hint = Darts.checkoutHint(r.remaining, 3 - n, game.doubleOut);
    return (n ? `Aufnahme: ${pts}` : '') +
      (hint && !closed ? `${n ? ' · ' : ''}Finish: ${hint.map(h => h.label).join(' – ')}` : '');
  }

  // Felder, die gerade nichts bringen, abdunkeln: bei Around the Clock alles ausser dem Ziel,
  // bei Cricket 1–14 und was alle geschlossen haben.
  function highlightBoard(r) {
    let active = null;
    if (game.mode === 'clock') active = r.win ? [] : [Darts.CLOCK[r.pos]];
    else if (game.mode === 'cricket') active = Darts.CRICKET.filter((v, k) => !r.marks.every(row => row[k] === 3));
    $$('#board [data-v]').forEach(s => {
      s.classList.toggle('dim', active !== null && active.indexOf(Number(s.getAttribute('data-v'))) < 0);
    });
  }

  function renderPlay() {
    if (!game) return;
    const p = game.current;
    const r = result();
    const closed = game.darts.length >= 3 || r.bust || r.win;

    renderScores(p, r);

    $('#turn-name').textContent = playerName(game.players[p]);
    $('#turn-rest').textContent = game.mode === 'cricket' ? r.points[p]
      : game.mode === 'clock' ? target(r.pos)
      : r.bust ? game.rest[p] : r.remaining;

    let html = '';
    for (let i = 0; i < 3; i++) {
      const d = game.darts[i];
      if (d) {
        html += `<button class="dart ${r.bust && i === r.used - 1 ? 'void' : ''}" data-i="${i}">` +
          esc(d.label) + (isX01(game) ? `<small>${d.points}</small>` : '') + '</button>';
      } else {
        html += `<div class="dart button empty">${i + 1}</div>`;
      }
    }
    if (editing >= 0 && game.darts[editing]) {
      const v = game.darts[editing].value;
      html += '<div class="mult-pick" style="grid-column: 1 / -1">' +
        (v === 25
          ? '<button data-mult="1">25</button><button data-mult="2">Bull</button>'
          : `<button data-mult="1">${v || 20}</button><button data-mult="2">D${v || 20}</button><button data-mult="3">T${v || 20}</button>`) +
        '<button data-mult="0">Daneben</button></div>';
    }
    $('#darts').innerHTML = html;

    const info = $('#turn-info');
    info.className = 'turn-info';
    if (r.bust) info.classList.add('bust');
    else if (r.win) info.classList.add('win');
    info.textContent = turnText(p, r, closed);

    $('#btn-confirm').disabled = !closed;
    $('#btn-confirm').textContent = r.win ? 'Sieg bestätigen' : 'Bestätigen – nächste Person';
    $('#btn-miss').disabled = closed;
    $('#btn-undo').disabled = game.darts.length === 0;

    highlightBoard(r);

    const marks = $('#marks');
    marks.innerHTML = '';
    game.darts.forEach((d, i) => {
      if (d.x === undefined) return;
      const g = el('g', { class: 'mark' }, marks);
      el('circle', { cx: d.x, cy: d.y, r: 11 }, g);
      el('text', { x: d.x, y: d.y }, g).textContent = i + 1;
    });
  }

  // before: das Spiel vor der letzten Aufnahme – für «Zurück ins Spiel», falls falsch erfasst.
  function finishGame(winner, before) {
    const g = game;
    const i = g.players.indexOf(winner);
    const x01 = isX01(g);
    const entry = {
      id: g.id,
      date: new Date().toISOString(),
      mode: x01 ? String(g.start) + (g.doubleOut ? '' : ' SO') : MODE_NAMES[g.mode],
      players: g.players,
      winner,
      darts: g.thrown,
    };
    if (x01) entry.avg = g.players.map((_, j) => Number((g.thrown[j] ? g.scored[j] / g.thrown[j] * 3 : 0).toFixed(1)));
    if (g.mode === 'cricket') entry.points = g.points;
    db.games.push(entry);
    saveDb();
    game = null;
    saveGame();
    $('#win-title').textContent = `${playerName(winner)} gewinnt!`;
    $('#win-text').textContent = `${g.thrown[i]} Pfeile` +
      (x01 ? ` · Ø ${(g.scored[i] / g.thrown[i] * 3).toFixed(1)} pro Aufnahme` : '') +
      (g.mode === 'cricket' ? ` · ${g.points[i]} Punkte` : '');
    $('#win').hidden = false;
    $('#win-rematch').onclick = () => {
      $('#win').hidden = true;
      // Revanche: Reihenfolge rotiert, damit jemand anderes beginnt.
      startGame(g.players.slice(1).concat(g.players[0]), settingsOf(g));
    };
    $('#win-back').onclick = () => {
      $('#win').hidden = true;
      db.games = db.games.filter(x => x.id !== g.id);
      saveDb();
      game = before;
      saveGame();
      show('play');
    };
    $('#win-new').onclick = () => {
      $('#win').hidden = true;
      picked = [];
      show('play');
    };
  }

  // ---- Rangliste ----

  // Filter: rankKind 'all', 'year', 'quarter' oder 'month'; rankKey der gewählte Zeitraum.
  // Wer den Tab öffnet, sieht immer zuerst «Gesamt».
  let rankKind = 'all', rankKey = null;
  $$('[data-kind]').forEach(b => b.addEventListener('click', () => {
    rankKind = b.dataset.kind;
    rankKey = null;
    renderRanking();
  }));
  $('#rank-period').addEventListener('change', e => {
    rankKey = Number(e.target.value);
    renderRanking();
  });

  // Zeiträume, in denen gespielt wurde, neueste zuerst.
  function periodsWithGames(kind) {
    const keys = [];
    db.games.forEach(g => {
      const k = Darts.periodOf(g.date, kind);
      if (keys.indexOf(k) < 0) keys.push(k);
    });
    return keys.sort((a, b) => b - a);
  }

  // Beste in Elo und Vernetzung; bei Gleichstand alle.
  function bestOf(games) {
    const active = id => activePlayers().some(p => p.id === id);
    const top = scores => {
      const ids = Object.keys(scores).filter(active);
      const max = Math.max.apply(null, ids.map(id => Math.round(scores[id])));
      return { ids: ids.filter(id => Math.round(scores[id]) === max), value: max };
    };
    return { elo: top(Darts.eloRatings(games).rating), net: top(Darts.networkPoints(games).points) };
  }

  function renderHonors(sorted) {
    const now = new Date();
    const rows = [];
    ['year', 'quarter', 'month'].forEach((kind, order) => {
      periodsWithGames(kind).forEach(key => {
        const end = Darts.periodEnd(kind, key);
        if (end > now) return;   // nur abgeschlossene Zeiträume
        const games = sorted.filter(g => Darts.periodOf(g.date, kind) === key);
        rows.push({ kind, key, end, order, best: bestOf(games) });
      });
    });
    // Neueste zuerst; endet ein Jahr, Quartal und Monat am selben Tag, kommt das Jahr zuerst.
    rows.sort((a, b) => b.end - a.end || a.order - b.order);
    const names = t => t.ids.length ? t.ids.map(id => esc(playerName(id))).join(', ') + ` <span class="hint">(${t.value})</span>` : '–';
    $('#table-honors').innerHTML = rows.length
      ? '<tr><th>Zeitraum</th><th>Können</th><th>Vernetzung</th></tr>' +
        rows.map(r => `<tr class="${r.kind}"><td>${Darts.periodLabel(r.kind, r.key)}</td>` +
          `<td>${names(r.best.elo)}</td><td>${names(r.best.net)}</td></tr>`).join('')
      : '<tr><td class="hint">Die ersten Einträge kommen, sobald ein Monat mit Spielen vorbei ist.</td></tr>';
  }

  function renderRanking() {
    $$('[data-kind]').forEach(x => x.classList.toggle('active', x.dataset.kind === rankKind));
    const sel = $('#rank-period');
    sel.hidden = rankKind === 'all';
    if (rankKind !== 'all') {
      const keys = periodsWithGames(rankKind);
      if (!keys.length) keys.push(Darts.periodOf(new Date(), rankKind));
      if (rankKey === null || keys.indexOf(rankKey) < 0) rankKey = keys[0];
      sel.innerHTML = keys.map(k => `<option value="${k}">${Darts.periodLabel(rankKind, k)}</option>`).join('');
      sel.value = String(rankKey);
    }
    const sorted = db.games.slice().sort((a, b) => a.date.localeCompare(b.date));
    const games = rankKind === 'all' ? sorted : sorted.filter(g => Darts.periodOf(g.date, rankKind) === rankKey);
    const players = activePlayers();
    renderHonors(sorted);

    const elo = Darts.eloRatings(games);
    const eloRows = players.filter(p => elo.played[p.id])
      .map(p => ({ p, r: elo.rating[p.id], n: elo.played[p.id], w: elo.won[p.id] || 0 }))
      .sort((a, b) => b.r - a.r);
    $('#table-elo').innerHTML = eloRows.length
      ? '<tr><th>#</th><th>Name</th><th class="num">Elo</th><th class="num">Spiele</th><th class="num">Siege</th></tr>' +
        eloRows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.p.name)}</td><td class="num">${Math.round(x.r)}</td>` +
          `<td class="num">${x.n}</td><td class="num">${x.w}</td></tr>`).join('')
      : '<tr><td class="hint">Noch keine Spiele.</td></tr>';

    // Vernetzung: das Gedächtnis «wie oft schon gegeneinander» beginnt jeden Kalendermonat neu.
    const net = Darts.networkPoints(games);
    const netRows = players.filter(p => net.points[p.id])
      .map(p => ({ p, pts: net.points[p.id], opp: net.opponents[p.id].size }))
      .sort((a, b) => b.pts - a.pts);
    $('#table-net').innerHTML = netRows.length
      ? '<tr><th>#</th><th>Name</th><th class="num">Punkte</th><th class="num">Gegenüber</th></tr>' +
        netRows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.p.name)}</td><td class="num">${x.pts}</td>` +
          `<td class="num">${x.opp}</td></tr>`).join('')
      : '<tr><td class="hint">Noch keine Spiele.</td></tr>';

    const all = Darts.pairCounts(sorted);
    const never = [];
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      if (!all[Darts.pairKey(players[i].id, players[j].id)]) never.push(`${esc(players[i].name)} – ${esc(players[j].name)}`);
    }
    $('#never').innerHTML = never.length
      ? never.slice(0, 30).map(s => `<span>${s}</span>`).join('')
      : '<p class="hint">Alle haben schon gegeneinander gespielt. 🎉</p>';
  }

  // Zweimal tippen zum Löschen – kein Popup, das auf dem Tablet hängen bleibt.
  function twoTap(button, action) {
    if (button.dataset.armed) {
      action();
    } else {
      const label = button.textContent;
      button.dataset.armed = '1';
      button.textContent = 'Sicher?';
      button.classList.add('danger');
      setTimeout(() => {
        if (!button.isConnected || !button.dataset.armed) return;
        delete button.dataset.armed;
        button.textContent = label;
        button.classList.remove('danger');
      }, 3000);
    }
  }

  // ---- Spielende ----

  function renderPlayers() {
    $('#player-list').innerHTML = activePlayers().map(p => {
      const n = db.games.filter(g => g.players.includes(p.id)).length;
      return `<li><span>${esc(p.name)} <span class="hint">· ${n} Spiele</span></span>` +
        `<button class="del" data-player="${p.id}">Löschen</button></li>`;
    }).join('') || '<li class="hint">Noch niemand erfasst.</li>';
  }

  $('#add-player').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#new-name').value.trim();
    if (!name) return;
    if (activePlayers().some(p => p.name.toLowerCase() === name.toLowerCase())) {
      $('#new-name').setCustomValidity('Diesen Namen gibt es schon.');
      $('#new-name').reportValidity();
      return;
    }
    db.players.push({ id: uid(), name });
    saveDb();
    $('#new-name').value = '';
    renderPlayers();
  });
  $('#new-name').addEventListener('input', e => e.target.setCustomValidity(''));

  // Löschen entfernt den Namen; die Spiele bleiben anonym, damit die Wertung der anderen stimmt.
  $('#player-list').addEventListener('click', e => {
    const b = e.target.closest('[data-player]');
    if (!b) return;
    twoTap(b, () => {
      const p = db.players.find(x => x.id === b.dataset.player);
      p.deleted = true;
      p.name = 'Gelöscht';
      saveDb();
      renderPlayers();
    });
  });

  // ---- Einstellungen ----

  const DAY = 24 * 3600 * 1000;

  // Tage seit der letzten Sicherung, falls seit über 14 Tagen ungesicherte Spiele da sind – sonst null.
  // Ohne Sicherung zählt das älteste Spiel.
  function backupDue() {
    const last = load(KEY_BACKUP, null);
    const unsaved = db.games.filter(g => !last || g.date > last);
    if (!unsaved.length) return null;
    const since = last || unsaved.reduce((m, g) => g.date < m ? g.date : m, unsaved[0].date);
    const days = Math.floor((Date.now() - new Date(since).getTime()) / DAY);
    return days >= 14 ? days : null;
  }
  function backupText(days) {
    return load(KEY_BACKUP, null) ? `Letzte Sicherung vor ${days} Tagen` : 'Noch nie gesichert';
  }

  function applySettings() {
    document.title = setting('name');
    $('#brand').textContent = setting('name');
    $('#banner').textContent = setting('banner');
    $('#banner').hidden = !setting('banner');
    $('#setup-mode').value = setting('mode');
    $('#setup-out').value = setting('out');
    $('#setup-out-label').hidden = setupMode() !== 'x01';
  }

  function renderSettings() {
    $('#set-mode').value = setting('mode');
    $('#set-out').value = setting('out');
    $('#set-name').value = setting('name');
    $('#set-banner').value = setting('banner');
    if (document.activeElement !== $('#cloud-url')) $('#cloud-url').value = cloud.url;
    renderCloud();
    renderPersist();
    const last = load(KEY_BACKUP, null);
    $('#backup-status').textContent = last
      ? `Letzte Sicherung: ${new Date(last).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}`
      : 'Noch nie gesichert.';
  }

  [['#set-mode', 'mode'], ['#set-out', 'out'], ['#set-name', 'name'], ['#set-banner', 'banner']]
    .forEach(([sel, key]) => $(sel).addEventListener('change', e => {
      if (!db.settings) db.settings = {};
      const v = e.target.value.trim();
      // Leerer Name heisst Standard; leeres Banner heisst kein Banner.
      db.settings[key] = key === 'name' && !v ? DEFAULTS.name : v;
      saveDb();
      applySettings();
      renderSettings();
    }));

  function clearData(all) {
    db.games = [];
    if (all) db.players = [];
    saveDb();
    game = null;
    saveGame();
    picked = [];
    save(KEY_BACKUP, null);
  }
  $('#btn-clear-games').addEventListener('click', e => {
    const b = e.currentTarget;
    twoTap(b, () => { clearData(false); delete b.dataset.armed; b.classList.remove('danger'); b.textContent = 'Spiele gelöscht ✓'; });
  });
  $('#btn-clear-all').addEventListener('click', e => {
    const b = e.currentTarget;
    twoTap(b, () => { clearData(true); delete b.dataset.armed; b.classList.remove('danger'); b.textContent = 'Alles gelöscht ✓'; });
  });

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `office-darts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    save(KEY_BACKUP, new Date().toISOString());
    renderSettings();
  });

  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.players) || !Array.isArray(data.games)) throw new Error('format');
      db = data;
      saveDb();
      applySettings();
      renderSettings();
      e.target.value = '';
      e.target.parentElement.firstChild.textContent = 'Geladen ✓';
    } catch (err) {
      e.target.parentElement.firstChild.textContent = 'Datei ungültig';
    }
  });

  // ---- Dauerhaft speichern ----
  // Ohne diese Erlaubnis darf der Browser die Daten bei Platzmangel wegräumen.
  // Safari 12 kennt navigator.storage nicht – dort hilft «Zum Home-Bildschirm».

  async function renderPersist() {
    const s = navigator.storage;
    const status = $('#persist-status');
    const button = $('#btn-persist');
    if (!s || !s.persisted) {
      status.textContent = 'Dieser Browser kann das nicht. Tipp: die Seite zum Home-Bildschirm hinzufügen.';
      button.hidden = true;
      return;
    }
    const on = await s.persisted();
    status.textContent = on
      ? 'Dauerhaft gespeichert ✓ – der Browser räumt die Daten nicht von selbst weg.'
      : 'Nicht dauerhaft: bei wenig Platz darf der Browser die Daten löschen.';
    button.hidden = on;
  }
  $('#btn-persist').addEventListener('click', async () => {
    const ok = await navigator.storage.persist();
    await renderPersist();
    if (!ok) $('#persist-status').textContent = 'Abgelehnt. Tipp: die Seite zum Home-Bildschirm hinzufügen und nochmals versuchen.';
  });

  // ---- Datenbank (Neon) ----
  // Neon nimmt SQL per HTTPS an; ein eigener Server ist nicht nötig. Jeder Stand wird als neue Zeile
  // angehängt (darts_save), das Tablet darf nichts ändern oder löschen – siehe Einrichtung in index.html.

  let cloud = load(KEY_CLOUD, { url: '', last: null, dirty: false });
  let cloudTimer = null;
  let cloudError = '';

  function neonEndpoint(url) {
    const m = /^postgres(?:ql)?:\/\/[^@\/]+@([^\/:?]+)/.exec(url.trim());
    if (!m) throw new Error('Verbindung ungültig – sie beginnt mit postgresql:// und enthält @');
    return 'https://' + m[1].replace(/^[^.]+\./, 'api.') + '/sql';
  }

  async function neonQuery(query, params) {
    // Ohne Content-Type: application/json wäre für Neon eine nicht erlaubte Kopfzeile (CORS).
    const res = await fetch(neonEndpoint(cloud.url), {
      method: 'POST',
      headers: { 'Neon-Connection-String': cloud.url.trim(), 'Neon-Raw-Text-Output': 'true' },
      body: JSON.stringify({ query, params: params || [] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || 'Fehler ' + res.status);
    return body.rows || [];
  }

  function saveCloud() { save(KEY_CLOUD, cloud); }

  // Nach jeder Änderung kurz warten – mehrere Änderungen hintereinander gehen in einem Rutsch.
  function cloudChanged() {
    if (!cloud.url) return;
    cloud.dirty = true;
    saveCloud();
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudPush, 3000);
  }

  async function cloudPush() {
    clearTimeout(cloudTimer);
    if (!cloud.url) return;
    try {
      await neonQuery('select darts_save($1::jsonb)', [JSON.stringify(db)]);
      cloud.dirty = false;
      cloud.last = new Date().toISOString();
      cloudError = '';
      saveCloud();
      save(KEY_BACKUP, cloud.last);
    } catch (err) {
      cloudError = err.message;
    }
    if (!$('#view-settings').hidden) renderSettings();
    return !cloudError;
  }

  function renderCloud() {
    const when = d => new Date(d).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });
    let text;
    if (!cloud.url) text = 'Keine Datenbank eingetragen – alles bleibt nur auf diesem Gerät.';
    else if (cloudError) text = 'Hochladen fehlgeschlagen: ' + cloudError + '. Wird bei der nächsten Änderung nochmals versucht.';
    else if (cloud.dirty) text = 'Änderungen noch nicht hochgeladen.';
    else text = cloud.last ? 'Zuletzt hochgeladen: ' + when(cloud.last) : 'Verbunden, noch nichts hochgeladen.';
    $('#cloud-status').textContent = text;
    $('#cloud-status').classList.toggle('warn', !!cloudError);
    $('#btn-cloud-push').disabled = !cloud.url;
    $('#btn-cloud-pull').disabled = !cloud.url;
  }

  $('#btn-cloud-save').addEventListener('click', async e => {
    const b = e.currentTarget;
    const url = $('#cloud-url').value.trim();
    cloud.url = url;
    cloudError = '';
    saveCloud();
    if (!url) { b.textContent = 'Entfernt ✓'; renderSettings(); return; }
    b.textContent = 'Teste …';
    try {
      neonEndpoint(url);
      await neonQuery('select count(*) from darts_backup');
      b.textContent = 'Verbunden ✓';
    } catch (err) {
      cloudError = err.message;
      b.textContent = 'Speichern und testen';
    }
    renderSettings();
  });

  $('#btn-cloud-push').addEventListener('click', async e => {
    const b = e.currentTarget;
    b.textContent = 'Lade hoch …';
    b.textContent = await cloudPush() ? 'Hochgeladen ✓' : 'Jetzt hochladen';
  });

  $('#btn-cloud-pull').addEventListener('click', e => {
    const b = e.currentTarget;
    twoTap(b, async () => {
      delete b.dataset.armed;
      b.classList.remove('danger');
      b.textContent = 'Lade …';
      try {
        const rows = await neonQuery('select data, created_at from darts_backup order by id desc limit 1');
        if (!rows.length) throw new Error('Noch nichts in der Datenbank');
        const data = JSON.parse(rows[0].data);
        if (!Array.isArray(data.players) || !Array.isArray(data.games)) throw new Error('Stand ungültig');
        db = data;
        save(KEY, db);
        cloud.dirty = false;
        saveCloud();
        applySettings();
        b.textContent = 'Geladen ✓';
      } catch (err) {
        cloudError = err.message;
        b.textContent = 'Von der Datenbank laden';
      }
      renderSettings();
    });
  });

  window.addEventListener('online', () => { if (cloud.dirty) cloudPush(); });

  // ---- Bildschirm wach halten ----
  // Das Tablet hängt an der Scheibe; der Bildschirm soll nicht ausgehen.
  // Android/Chrome gibt die Sperre frei, sobald die Seite verdeckt ist – daher neu anfordern.

  let wakeLock = null;
  async function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      wakeLock = null;
    }
  }
  document.addEventListener('visibilitychange', keepAwake);
  document.addEventListener('click', keepAwake);

  // ---- Start ----

  drawBoard();
  applySettings();
  show('play');
  keepAwake();
  if (cloud.dirty) cloudPush();
})();
