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
  const saveDb = () => save(KEY, db);
  const saveGame = () => save(KEY_GAME, game);

  const activePlayers = () => db.players.filter(p => !p.deleted);
  const playerName = id => (db.players.find(p => p.id === id) || { name: '?' }).name;

  // ---- Ansichten ----

  function show(view) {
    $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const id = view === 'play' ? (game ? 'view-play' : 'view-setup') : 'view-' + view;
    $$('main.view').forEach(m => { m.hidden = m.id !== id; });
    $('.footer').hidden = id === 'view-play';
    if (id === 'view-setup') renderSetup();
    if (id === 'view-play') renderPlay();
    if (view === 'ranking') renderRanking();
    if (view === 'players') renderPlayers();
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));

  // ---- Neues Spiel ----

  let picked = [];

  function renderSetup() {
    const players = activePlayers();
    picked = picked.filter(id => players.some(p => p.id === id));
    $('#setup-empty').hidden = players.length > 0;
    // Wer als Erstes gewählt ist, sieht bei allen anderen, wie viele Vernetzungspunkte ein Spiel bringt.
    const counts = Darts.pairCounts(db.games);
    const me = picked[0];
    const bonus = id => Darts.meetPoints(counts[Darts.pairKey(me, id)] ?? 0);
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
  }

  $('#setup-players').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = b.dataset.id;
    if (picked.includes(id)) picked = picked.filter(x => x !== id);
    else if (picked.length < 4) picked.push(id);
    renderSetup();
  });

  function startGame(players, start, doubleOut) {
    game = {
      id: uid(),
      start,
      doubleOut,
      players,
      rest: players.map(() => start),
      thrown: players.map(() => 0),   // gezählte Pfeile
      scored: players.map(() => 0),   // erzielte Punkte
      current: 0,
      darts: [],
      startedAt: new Date().toISOString(),
    };
    saveGame();
    show('play');
  }

  $('#setup-start').addEventListener('click', () => {
    startGame(picked.slice(), Number($('#setup-mode').value), $('#setup-out').value === 'double');
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
    el('circle', { r: R.numbers + 10, fill: '#0c0c0c', class: 'seg' }, board);
    Darts.SEGMENTS.forEach((n, i) => {
      const a1 = i * 18 - 9, a2 = a1 + 18;
      const dark = i % 2 === 0;
      const plain = dark ? c('--board-dark') : c('--board-light');
      const ring = dark ? c('--board-red') : c('--board-green');
      el('path', { d: sector(R.bullOut, R.tripleIn, a1, a2), fill: plain, class: 'seg' }, board);
      el('path', { d: sector(R.tripleIn, R.tripleOut, a1, a2), fill: ring, class: 'seg' }, board);
      el('path', { d: sector(R.tripleOut, R.doubleIn, a1, a2), fill: plain, class: 'seg' }, board);
      el('path', { d: sector(R.doubleIn, R.doubleOut, a1, a2), fill: ring, class: 'seg' }, board);
      const [x, y] = pt((R.doubleOut + R.numbers + 10) / 2, i * 18);
      el('text', { x, y, class: 'num' }, board).textContent = n;
    });
    el('circle', { r: R.bullOut, fill: c('--board-green'), class: 'seg' }, board);
    el('circle', { r: R.bullIn, fill: c('--board-red'), class: 'seg' }, board);
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

  const result = () => Darts.applyTurn(game.rest[game.current], game.darts, game.doubleOut);
  const turnClosed = () => {
    const r = result();
    return game.darts.length >= 3 || r.bust || r.checkout;
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
      game.darts[editing] = { ...fixed, x: d.x, y: d.y };
      editing = -1;
      game.darts = game.darts.slice(0, Darts.applyTurn(game.rest[game.current], game.darts, game.doubleOut).used);
      saveGame();
      renderPlay();
    }
  });

  $('#btn-confirm').addEventListener('click', () => {
    if (!game) return;
    const r = result();
    const p = game.current;
    game.thrown[p] += r.used;
    if (!r.bust) {
      game.scored[p] += game.rest[p] - r.remaining;
      game.rest[p] = r.remaining;
    }
    game.darts = [];
    editing = -1;
    if (r.checkout) {
      finishGame(game.players[p]);
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

  function renderPlay() {
    if (!game) return;
    const p = game.current;
    const r = result();
    const closed = game.darts.length >= 3 || r.bust || r.checkout;

    $('#scores').innerHTML = game.players.map((id, i) =>
      `<div class="score ${i === p ? 'current' : ''}"><span class="name">${esc(playerName(id))}` +
      `<span class="avg">Ø ${avg(i)}</span></span><span class="pts">${game.rest[i]}</span></div>`
    ).join('');

    $('#turn-name').textContent = playerName(game.players[p]);
    $('#turn-rest').textContent = r.bust ? game.rest[p] : r.remaining;

    let html = '';
    for (let i = 0; i < 3; i++) {
      const d = game.darts[i];
      if (d) {
        html += `<button class="dart ${r.bust && i === r.used - 1 ? 'void' : ''}" data-i="${i}">` +
          `${esc(d.label)}<small>${d.points}</small></button>`;
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
    if (r.bust) {
      info.textContent = 'Überworfen – die Aufnahme zählt nicht.';
      info.classList.add('bust');
    } else if (r.checkout) {
      info.textContent = 'Ausgecheckt! 🎯';
      info.classList.add('win');
    } else {
      const sum = game.darts.reduce((s, d) => s + d.points, 0);
      const hint = Darts.checkoutHint(r.remaining, 3 - game.darts.length, game.doubleOut);
      info.textContent = (game.darts.length ? `Aufnahme: ${sum}` : '') +
        (hint && !closed ? `${game.darts.length ? ' · ' : ''}Finish: ${hint.map(h => h.label).join(' – ')}` : '');
    }

    $('#btn-confirm').disabled = !closed;
    $('#btn-confirm').textContent = r.checkout ? 'Sieg bestätigen' : 'Bestätigen – nächste Person';
    $('#btn-miss').disabled = closed;
    $('#btn-undo').disabled = game.darts.length === 0;

    const marks = $('#marks');
    marks.innerHTML = '';
    game.darts.forEach((d, i) => {
      if (d.x === undefined) return;
      const g = el('g', { class: 'mark' }, marks);
      el('circle', { cx: d.x, cy: d.y, r: 11 }, g);
      el('text', { x: d.x, y: d.y }, g).textContent = i + 1;
    });
  }

  function finishGame(winner) {
    const g = game;
    db.games.push({
      id: g.id,
      date: new Date().toISOString(),
      mode: String(g.start) + (g.doubleOut ? '' : ' SO'),
      players: g.players,
      winner,
      darts: g.thrown,
      avg: g.players.map((_, i) => Number((g.thrown[i] ? g.scored[i] / g.thrown[i] * 3 : 0).toFixed(1))),
    });
    saveDb();
    game = null;
    saveGame();
    const i = g.players.indexOf(winner);
    $('#win-title').textContent = `${playerName(winner)} gewinnt!`;
    $('#win-text').textContent = `${g.thrown[i]} Pfeile · Ø ${(g.scored[i] / g.thrown[i] * 3).toFixed(1)} pro Aufnahme`;
    $('#win').hidden = false;
    $('#win-rematch').onclick = () => {
      $('#win').hidden = true;
      // Revanche: Reihenfolge rotiert, damit jemand anderes beginnt.
      startGame(g.players.slice(1).concat(g.players[0]), g.start, g.doubleOut);
    };
    $('#win-new').onclick = () => {
      $('#win').hidden = true;
      picked = [];
      show('play');
    };
  }

  // ---- Rangliste ----

  let season = 'quarter';
  $$('[data-season]').forEach(b => b.addEventListener('click', () => {
    season = b.dataset.season;
    $$('[data-season]').forEach(x => x.classList.toggle('active', x === b));
    renderRanking();
  }));

  function quarterStart(d = new Date()) {
    return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  }

  function renderRanking() {
    const sorted = db.games.slice().sort((a, b) => a.date.localeCompare(b.date));
    const from = season === 'quarter' ? quarterStart().toISOString() : '';
    const before = sorted.filter(g => g.date < from);
    const games = sorted.filter(g => g.date >= from);
    const players = activePlayers();

    const elo = Darts.eloRatings(games);
    const eloRows = players.filter(p => elo.played[p.id])
      .map(p => ({ p, r: elo.rating[p.id], n: elo.played[p.id], w: elo.won[p.id] || 0 }))
      .sort((a, b) => b.r - a.r);
    $('#table-elo').innerHTML = eloRows.length
      ? '<tr><th>#</th><th>Name</th><th class="num">Elo</th><th class="num">Spiele</th><th class="num">Siege</th></tr>' +
        eloRows.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.p.name)}</td><td class="num">${Math.round(x.r)}</td>` +
          `<td class="num">${x.n}</td><td class="num">${x.w}</td></tr>`).join('')
      : '<tr><td class="hint">Noch keine Spiele.</td></tr>';

    // Vernetzung: frühere Begegnungen zählen mit, damit ein «neues Quartal» keine neuen Erstbegegnungen erfindet.
    const net = Darts.networkPoints(games, Darts.pairCounts(before));
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

    const recent = sorted.slice(-15).reverse();
    $('#table-games').innerHTML = recent.length
      ? '<tr><th>Datum</th><th>Spiel</th><th>Spielende</th><th>Sieg</th><th></th></tr>' +
        recent.map(g => `<tr><td>${new Date(g.date).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}</td>` +
          `<td>${esc(g.mode)}</td><td>${g.players.map(id => esc(playerName(id))).join(', ')}</td>` +
          `<td>${esc(playerName(g.winner))}</td><td class="num"><button class="del" data-game="${g.id}">Löschen</button></td></tr>`).join('')
      : '<tr><td class="hint">Noch keine Spiele.</td></tr>';
  }

  // Zweimal tippen zum Löschen – kein Popup, das auf dem Tablet hängen bleibt.
  function twoTap(button, action) {
    if (button.dataset.armed) {
      action();
    } else {
      button.dataset.armed = '1';
      button.textContent = 'Sicher?';
      button.classList.add('danger');
      setTimeout(() => {
        if (!button.isConnected) return;
        delete button.dataset.armed;
        button.textContent = 'Löschen';
        button.classList.remove('danger');
      }, 3000);
    }
  }

  $('#table-games').addEventListener('click', e => {
    const b = e.target.closest('[data-game]');
    if (!b) return;
    twoTap(b, () => {
      db.games = db.games.filter(g => g.id !== b.dataset.game);
      saveDb();
      renderRanking();
    });
  });

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

  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `office-darts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#file-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.players) || !Array.isArray(data.games)) throw new Error('format');
      db = data;
      saveDb();
      renderPlayers();
      e.target.value = '';
      e.target.parentElement.firstChild.textContent = 'Geladen ✓';
    } catch (err) {
      e.target.parentElement.firstChild.textContent = 'Datei ungültig';
    }
  });

  // ---- Start ----

  drawBoard();
  show('play');
})();
