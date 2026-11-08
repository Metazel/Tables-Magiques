/* Tables Magiques — logique pure (aucun accès au DOM). Exposée sous window.TM / module.exports. */
(function (root) {
  'use strict';

  var DAY = 86400000;
  var SOCLE = [1, 2, 5, 10];
  var SESSION_SIZE = 8;
  var MAX_REASKS = 2;
  var MASTER_BOX = 6;          // boîte 6 = maîtrisé
  var TREASURE_BOX = 3;        // pièce de collection débloquée à partir de cette boîte
  var BOX_DAYS = [0, 1, 1, 2, 4, 8, 15];   // boîte 1 : revue le lendemain (jamais deux paliers le même jour)
  var NEW_PER_DAY = 4;
  var WORLDS = ['foret', 'ocean', 'espace'];
  var STORE_KEY = 'tables-magiques-v1';

  var CHAPTERS = [
    { id: 'x4', table: 4, others: [3, 4, 6, 7, 8, 9], title: 'Les doubles', hint: 'La table de 4, c’est le double de la table de 2' },
    { id: 'x3', table: 3, others: [3, 6, 7, 8, 9], title: 'Le 3', hint: 'La table de 3, c’est la table de 2, et encore une fois' },
    { id: 'x9', table: 9, others: [6, 7, 8, 9], title: 'Le 9', hint: 'La table de 9, c’est la table de 10, moins une fois' },
    { id: 'x6', table: 6, others: [6, 7, 8], title: 'Le 6', hint: 'La table de 6, c’est la table de 5, et encore une fois' },
    { id: 'x8', table: 8, others: [7, 8], title: 'Le 8', hint: 'La table de 8, c’est le double de la table de 4' },
    { id: 'x7', table: 7, others: [7], title: 'Le 7', hint: 'La table de 7, c’est la table de 5 plus la table de 2' }
  ];

  // ---------- Faits ----------
  var FACTS = [];
  var FACT_BY_ID = Object.create(null);
  var FACT_BY_PAIR = Object.create(null);
  function isFact(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(FACT_BY_ID, id); }
  CHAPTERS.forEach(function (ch, ci) {
    ch.others.forEach(function (b) {
      var f = { id: ch.table + 'x' + b, a: ch.table, b: b, answer: ch.table * b, chapter: ci, kind: 'learn' };
      FACTS.push(f);
      FACT_BY_ID[f.id] = f;
      FACT_BY_PAIR[pairKey(f.a, f.b)] = f;
    });
  });

  var SOCLE_FACTS = [];
  for (var x = 1; x <= 10; x++) {
    for (var y = x; y <= 10; y++) {
      if (SOCLE.indexOf(x) >= 0 || SOCLE.indexOf(y) >= 0) {
        // la ligne (a) est le facteur du socle pour le pont ; si les deux le sont, le plus petit
        var a = SOCLE.indexOf(x) >= 0 ? x : y;
        var b = a === x ? y : x;
        SOCLE_FACTS.push({ id: pairKey(x, y), a: a, b: b, answer: x * y, kind: 'socle' });
      }
    }
  }

  function pairKey(a, b) { return Math.min(a, b) + 'x' + Math.max(a, b); }

  // ---------- Ponts (stratégies) ----------
  // parts : bandes de lignes du rectangle (a lignes × b colonnes). kind 'minus' = lignes retirées.
  function bridge(fact) {
    var a = fact.a, b = fact.b;
    var P = function (rows, kind) { return { rows: rows, value: rows * b, label: rows + '×' + b + ' = ' + rows * b, kind: kind || 'plus' }; };
    if (fact.kind === 'learn') {
      switch (a) {
        case 4: return mk([P(2), P(2)], (2 * b) + ' + ' + (2 * b), '4 fois ' + b + ', c’est le double de 2 fois ' + b + '.');
        case 3: return mk([P(2), P(1)], (2 * b) + ' + ' + b, '3 fois ' + b + ', c’est 2 fois ' + b + ', et encore ' + b + '.');
        case 9: return mk([P(10), P(1, 'minus')], (10 * b) + ' − ' + b, '9 fois ' + b + ', c’est 10 fois ' + b + ', moins ' + b + '.');
        case 6: return mk([P(5), P(1)], (5 * b) + ' + ' + b, '6 fois ' + b + ', c’est 5 fois ' + b + ', et encore ' + b + '.');
        case 8: return mk([P(4), P(4)], (4 * b) + ' + ' + (4 * b), '8 fois ' + b + ', c’est le double de 4 fois ' + b + '.');
        case 7: return mk([P(5), P(2)], (5 * b) + ' + ' + (2 * b), '7 fois ' + b + ', c’est 5 fois ' + b + ' plus 2 fois ' + b + '.');
      }
    }
    switch (a) {
      case 1: return mk([P(1)], String(b), '1 fois ' + b + ', c’est ' + b + ' tout seul.');
      case 2: return mk([P(1), P(1)], b + ' + ' + b, '2 fois ' + b + ', c’est ' + b + ' plus ' + b + '.');
      case 5: var half = P(5, 'minus'); half.text = 'la moitié : ' + (5 * b);
        return mk([P(10), half], (10 * b) + ' ÷ 2', '5 fois ' + b + ', c’est la moitié de 10 fois ' + b + '.');
      case 10: return mk([P(10)], b + ' et un zéro', '10 fois ' + b + ', on ajoute un zéro : ' + (10 * b) + '.');
    }
    return mk([P(a)], String(a * b), a + ' fois ' + b + '.');

    function mk(parts, expr, sentence) {
      return { parts: parts, expr: expr, equation: expr + ' = ' + (a * b), sentence: sentence, rows: rowsOf(parts), cols: b };
    }
  }
  function rowsOf(parts) {
    return parts.reduce(function (n, p) { return p.kind === 'minus' ? n : n + p.rows; }, 0);
  }

  // ---------- Distracteurs ----------
  function distractors(a, b, count, rng) {
    rng = rng || Math.random;
    var ans = a * b;
    var cands = [(a - 1) * b, (a + 1) * b, a * (b - 1), a * (b + 1), ans + 10, ans - 10];
    var extra = [ans + a, ans - a, ans + b, ans - b, ans + 1, ans - 1, ans + 2];
    var seen = {}; var out = [];
    cands.forEach(function (c) {
      if (c > 0 && c <= 100 && c !== ans && !seen[c]) { seen[c] = 1; out.push(c); }
    });
    shuffle(out, rng);
    extra.forEach(function (c) {   // repli si les voisins proches manquent (ex. 10×10)
      if (c > 0 && c <= 120 && c !== ans && !seen[c]) { seen[c] = 1; out.push(c); }
    });
    return out.slice(0, count || 2);
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // ---------- État ----------
  function freshState() {
    return {
      v: 1,
      world: null,
      companion: null,
      facts: {},            // id -> { box, due, ok, ko }
      socle: {},            // pairKey -> { ok, ko }
      collection: [],       // ids de faits débloqués (jamais retirés)
      treasures: {},        // id -> emoji figé au déblocage
      maxChapter: 0,        // chapitre le plus avancé atteint (jamais perdu)
      newDay: { day: null, count: 0 },
      stats: { sessions: 0, daysPlayed: 0, lastDay: null, stars: 0, recentEnds: [] },
      settings: { voice: true, sound: true, calm: false }
    };
  }

  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }

  function sanitize(raw) {
    var s = freshState();
    if (!isObj(raw) || raw.v !== 1) return null;
    if (WORLDS.indexOf(raw.world) >= 0) s.world = raw.world;
    s.maxChapter = clampInt(raw.maxChapter, 0, CHAPTERS.length - 1);
    if (isObj(raw.newDay) && typeof raw.newDay.day === 'string') s.newDay = { day: raw.newDay.day.slice(0, 12), count: clampInt(raw.newDay.count, 0, 100) };
    if (typeof raw.companion === 'number' && raw.companion >= 0 && raw.companion < 10) s.companion = raw.companion;
    if (isObj(raw.facts)) Object.keys(raw.facts).forEach(function (id) {
      var f = raw.facts[id];
      if (!isFact(id) || !isObj(f)) return;
      s.facts[id] = {
        box: clampInt(f.box, 0, MASTER_BOX), due: num(f.due), ok: clampInt(f.ok, 0, 1e6), ko: clampInt(f.ko, 0, 1e6), recall: f.recall === true
      };
    });
    if (isObj(raw.treasures)) Object.keys(raw.treasures).forEach(function (id) {
      if (isFact(id) && typeof raw.treasures[id] === 'string' && raw.treasures[id].length <= 16) s.treasures[id] = raw.treasures[id];
    });
    if (isObj(raw.socle)) Object.keys(raw.socle).forEach(function (k) {
      var f = raw.socle[k];
      if (!isObj(f) || !/^\d+x\d+$/.test(k)) return;
      s.socle[k] = { ok: clampInt(f.ok, 0, 1e6), ko: clampInt(f.ko, 0, 1e6) };
    });
    if (Array.isArray(raw.collection)) raw.collection.forEach(function (id) {
      if (isFact(id) && s.collection.indexOf(id) < 0) s.collection.push(id);
    });
    if (isObj(raw.stats)) {
      s.stats.sessions = clampInt(raw.stats.sessions, 0, 1e6);
      s.stats.daysPlayed = clampInt(raw.stats.daysPlayed, 0, 1e6);
      s.stats.stars = clampInt(raw.stats.stars, 0, 1e7);
      s.stats.lastDay = typeof raw.stats.lastDay === 'string' ? raw.stats.lastDay : null;
      s.stats.recentEnds = Array.isArray(raw.stats.recentEnds) ? raw.stats.recentEnds.filter(isFinite).slice(-10) : [];
    }
    if (isObj(raw.settings)) ['voice', 'sound', 'calm'].forEach(function (k) {
      if (typeof raw.settings[k] === 'boolean') s.settings[k] = raw.settings[k];
    });
    return s;
  }
  function clampInt(v, lo, hi) { v = Math.round(Number(v)); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo; }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

  // storage : objet type localStorage (getItem/setItem/removeItem). Ne lève jamais.
  function load(storage) {
    var res = { state: freshState(), persistent: false, recovered: false };
    try {
      if (!storage) return res;
      var raw = storage.getItem(STORE_KEY);
      res.persistent = true;
      if (raw == null) return res;
      var parsed = sanitize(JSON.parse(raw));
      if (parsed) { res.state = parsed; return res; }
      throw new Error('format');
    } catch (e) {
      try { if (storage) storage.setItem(STORE_KEY + '-backup', String(storage.getItem(STORE_KEY))); } catch (e2) { /* rien */ }
      res.recovered = res.persistent;
      return res;
    }
  }
  function save(storage, state) {
    try { storage.setItem(STORE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  // ---------- Temps ----------
  function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dueFor(box, now) {
    var days = BOX_DAYS[box] || 0;
    if (days === 0) return now;
    var d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);   // robuste aux changements d'heure
    return d.getTime();
  }

  // ---------- Progression ----------
  function chapterUnlocked(state, ci) {
    for (var i = 0; i < ci; i++) {
      var ch = CHAPTERS[i];
      for (var k = 0; k < ch.others.length; k++) {
        var f = state.facts[ch.table + 'x' + ch.others[k]];
        if (!f || f.box < 2) return false;
      }
    }
    return true;
  }
  function currentChapter(state) {
    var last = 0;
    for (var i = 0; i < CHAPTERS.length; i++) if (chapterUnlocked(state, i)) last = i;
    if (last > (state.maxChapter || 0)) state.maxChapter = last;
    return Math.max(last, state.maxChapter || 0);
  }
  function statusOf(state, a, b) {
    var f = FACT_BY_PAIR[pairKey(a, b)];
    if (!f) {
      var s = state.socle[pairKey(a, b)];
      return s && s.ko > s.ok ? 'revoir' : 'socle';
    }
    var st = state.facts[f.id];
    if (!st) return 'nouveau';
    if (st.box >= MASTER_BOX) return 'maitrise';
    if (st.box >= TREASURE_BOX) return 'retenu';
    return 'encours';
  }
  function counts(state) {
    var c = { total: FACTS.length, treasures: state.collection.length, mastered: 0, inProgress: 0, unseen: 0 };
    FACTS.forEach(function (f) {
      var st = state.facts[f.id];
      if (!st) c.unseen++; else if (st.box >= MASTER_BOX) c.mastered++; else if (st.box < TREASURE_BOX) c.inProgress++;
    });
    return c;
  }

  // ---------- Construction d'une partie ----------
  function modeFor(box, rng, kind) {
    if (kind === 'socle') return rng() < 0.5 ? 'bulles' : 'pave';
    if (box <= 0) return 'rect';
    if (box === 1) return 'bulles';
    return 'pave';   // à partir de la boîte 2 : rappel libre (le hasard des bulles ne suffit plus)
  }
  function item(fact, st, now, rng) {
    var box = st ? st.box : 0;
    var due = st ? st.due <= now : true;
    var flip = fact.kind === 'learn' && box >= 2 && rng() < 0.3;
    return {
      kind: fact.kind, id: fact.id, a: fact.a, b: fact.b, answer: fact.answer,
      mode: modeFor(box, rng, fact.kind), wasDue: due, isNew: fact.kind === 'learn' && (!st || box === 0), flip: flip, isReask: false
    };
  }

  function buildSession(state, now, rng) {
    rng = rng || Math.random;
    var picked = [];
    var used = {};
    function take(fact, st) { if (used[fact.id]) return; used[fact.id] = 1; picked.push(item(fact, st, now, rng)); }

    var cur = currentChapter(state);
    var learning = FACTS.filter(function (f) { return f.chapter <= cur; });

    // 1) révisions dues (boîte la plus basse d'abord)
    var due = FACTS.filter(function (f) { var s = state.facts[f.id]; return s && s.box > 0 && s.due <= now; })
      .sort(function (x, y) {
        var sx = state.facts[x.id], sy = state.facts[y.id];
        return (sx.box - sy.box) || (sx.due - sy.due);
      });
    // 2) faits vus mais jamais réussis (boîte 0) = à réintroduire
    var retry = FACTS.filter(function (f) { var s = state.facts[f.id]; return s && s.box === 0; });
    // 3) nouveaux faits (ordre des chapitres)
    var unseen = learning.filter(function (f) { return !state.facts[f.id]; });

    var inProgress = FACTS.filter(function (f) { var s = state.facts[f.id]; return s && s.box < TREASURE_BOX; }).length;
    var newQuota = inProgress < 5 ? 2 : (inProgress < 8 ? 1 : 0);
    var today = dayKey(now);
    var doneToday = state.newDay && state.newDay.day === today ? state.newDay.count : 0;
    newQuota = Math.max(0, Math.min(newQuota, NEW_PER_DAY - doneToday));

    var EASY_MIN = 2;
    retry.slice(0, 2).forEach(function (f) { take(f, state.facts[f.id]); });
    unseen.slice(0, Math.max(0, newQuota - Math.min(retry.length, 2))).forEach(function (f) { take(f, null); });
    due.slice(0, Math.max(0, SESSION_SIZE - EASY_MIN - picked.length)).forEach(function (f) { take(f, state.facts[f.id]); });
    // rien à réviser ni à découvrir (surcharge) : entraînement libre sur les faits en cours, sans promotion
    if (picked.length < 3) {
      shuffle(FACTS.filter(function (f) { var s = state.facts[f.id]; return s && s.box > 0 && s.box < TREASURE_BOX; }), rng)
        .slice(0, 3 - picked.length).forEach(function (f) { take(f, state.facts[f.id]); });
    }

    // 4) victoires faciles : socle (de préférence avec les nombres du chapitre) + faits retenus non dus
    var curOthers = CHAPTERS[cur].others.concat([CHAPTERS[cur].table]);
    var easy = shuffle(SOCLE_FACTS.filter(function (f) { return f.a !== 1 && (curOthers.indexOf(f.b) >= 0 || rng() < 0.3); }), rng);
    var known = shuffle(FACTS.filter(function (f) { var s = state.facts[f.id]; return s && s.box >= TREASURE_BOX && !used[f.id]; }), rng);
    var pool = [];
    // alterne retenus et socle pour réviser aussi ce qui est acquis
    while (known.length || easy.length) { if (known.length) pool.push(known.shift()); if (easy.length) pool.push(easy.shift()); }
    for (var i = 0; picked.length < SESSION_SIZE && i < pool.length; i++) {
      var f = pool[i];
      take(f, f.kind === 'learn' ? state.facts[f.id] : null);
    }
    return arrange(picked, rng);
  }

  // Ordre : une victoire facile d'abord, nouveautés tôt, pas 3 fois le même mini-jeu de suite.
  function arrange(items, rng) {
    var easy = items.filter(function (it) { return it.kind === 'socle'; });
    var rest = shuffle(items.filter(function (it) { return it.kind !== 'socle'; }), rng);
    rest.sort(function (x, y) { return (y.isNew ? 1 : 0) - (x.isNew ? 1 : 0); });
    var out = [];
    if (easy.length) out.push(easy.shift());
    // intercale : 2 « à apprendre », 1 facile
    while (rest.length || easy.length) {
      if (rest.length) out.push(rest.shift());
      if (rest.length) out.push(rest.shift());
      if (easy.length) out.push(easy.shift());
    }
    varyModes(out);
    return out;
  }
  function varyModes(items) {
    for (var i = 2; i < items.length; i++) {
      var m = items[i].mode;
      if (items[i - 1].mode === m && items[i - 2].mode === m) {
        var flexible = items[i].kind === 'socle' || (items[i].mode !== 'rect' && !(items[i].kind === 'learn' && items[i].mode === 'bulles' && items[i].isNew));
        if (flexible && m !== 'rect') items[i].mode = m === 'pave' ? 'bulles' : 'pave';
      }
    }
    return items;
  }

  function makeReask(it) {
    var copy = {};
    Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
    copy.mode = 'bulles'; copy.isReask = true; copy.flip = false; copy.wasDue = false;
    return copy;
  }

  // ---------- Enregistrement d'une réponse ----------
  // Retourne { unlocked: id|null }
  function recordAnswer(state, it, correct, now) {
    var res = { unlocked: null };
    if (correct) state.stats.stars++;
    if (it.kind === 'socle') {
      var s = state.socle[it.id] || (state.socle[it.id] = { ok: 0, ko: 0 });
      if (correct) s.ok++; else s.ko++;
      return res;
    }
    var st = state.facts[it.id];
    if (!st) {
      st = state.facts[it.id] = { box: 0, due: now, ok: 0, ko: 0, recall: false };
      var today = dayKey(now);
      if (!state.newDay || state.newDay.day !== today) state.newDay = { day: today, count: 0 };
      state.newDay.count++;
    }
    if (correct) {
      st.ok++;
      if (it.mode === 'pave') st.recall = true;
      if (st.box === 0) {
        st.box = 1; st.due = dueFor(1, now);          // premier pas (après le pont ou du premier coup)
      } else if (!it.isReask && it.wasDue) {
        st.box = Math.min(MASTER_BOX, st.box + 1);    // palier seulement à l'échéance : espacement garanti
        st.due = dueFor(st.box, now);
      }
      if (st.box >= TREASURE_BOX && st.recall && state.collection.indexOf(it.id) < 0) {
        state.collection.push(it.id);
        res.unlocked = it.id;
      }
    } else {
      st.ko++;
      if (!it.isReask) st.box = st.box === 0 ? 0 : Math.max(1, st.box - 1);   // un seul recul par partie
      st.due = now;
    }
    return res;
  }

  function recordSessionEnd(state, now) {
    state.stats.sessions++;
    var k = dayKey(now);
    if (state.stats.lastDay !== k) { state.stats.daysPlayed++; state.stats.lastDay = k; }
    state.stats.recentEnds = state.stats.recentEnds.concat([now]).filter(function (t) { return now - t < 40 * 60000; }).slice(-10);
    return { suggestPause: state.stats.recentEnds.length >= 3 };
  }

  var TM = {
    DAY: DAY, SOCLE: SOCLE, WORLDS: WORLDS, NEW_PER_DAY: NEW_PER_DAY, isFact: isFact, CHAPTERS: CHAPTERS, FACTS: FACTS, SOCLE_FACTS: SOCLE_FACTS, FACT_BY_ID: FACT_BY_ID,
    SESSION_SIZE: SESSION_SIZE, MAX_REASKS: MAX_REASKS, TREASURE_BOX: TREASURE_BOX, MASTER_BOX: MASTER_BOX, STORE_KEY: STORE_KEY,
    pairKey: pairKey, bridge: bridge, distractors: distractors, shuffle: shuffle,
    freshState: freshState, sanitize: sanitize, load: load, save: save,
    dueFor: dueFor, dayKey: dayKey, chapterUnlocked: chapterUnlocked, currentChapter: currentChapter,
    statusOf: statusOf, counts: counts, buildSession: buildSession, makeReask: makeReask,
    recordAnswer: recordAnswer, recordSessionEnd: recordSessionEnd
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM; else root.TM = TM;
})(typeof window !== 'undefined' ? window : this);
