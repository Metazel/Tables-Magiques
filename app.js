/* Tables Magiques — interface. Dépend de core.js (window.TM). Aucune requête réseau. */
(function () {
  'use strict';
  var TM = window.TM;

  var WORLDS = {
    foret: {
      name: 'Forêt magique', emo: '🌳',
      companions: [['🦊', 'Le renard'], ['🦄', 'La licorne'], ['🐲', 'Le dragon']],
      treasures: ['🦉', '🐻', '🐿️', '🦔', '🐸', '🦋', '🐞', '🐝', '🐰', '🦌', '🐺', '🐼', '🐨', '🐯', '🦁', '🍄', '🌳', '🌸', '🐢', '🦜', '🌈']
    },
    ocean: {
      name: 'Océan', emo: '🌊',
      companions: [['🐙', 'La pieuvre'], ['🐢', 'La tortue'], ['🐬', 'Le dauphin']],
      treasures: ['🐠', '🐟', '🐡', '🦑', '🦐', '🦞', '🦀', '🐳', '🐋', '🦈', '🦭', '🐚', '🌊', '🐊', '🦦', '🐧', '⚓', '🏝️', '⛵', '🧜', '💎']
    },
    espace: {
      name: 'Espace', emo: '🚀',
      companions: [['🤖', 'Le robot'], ['👽', 'Le petit extraterrestre'], ['🚀', 'La fusée']],
      treasures: ['🛸', '🪐', '🌍', '🌙', '⭐', '🌟', '☄️', '🌞', '🛰️', '👾', '🔭', '🌌', '🌠', '🌑', '🌕', '🧑‍🚀', '💫', '🌈', '🌎', '🌏', '✨']
    }
  };
  var CHEERS = ['Bravo !', 'Super !', 'Génial !', 'Trop fort !', 'Oui !', 'Bien joué !'];

  // ---------- Stockage ----------
  function safeStorage() {
    try { var s = window.localStorage; s.setItem('__tm', '1'); s.removeItem('__tm'); return s; } catch (e) { return null; }
  }
  var storage = safeStorage();
  var loaded = TM.load(storage);
  var state = loaded.state;
  function persist() { if (storage) TM.save(storage, state); }

  // ---------- Outils DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, props, kids) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function live(text) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = text; }, 30); }

  function show(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
    var hd = $(id).querySelector('h1');
    if (hd) { try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); } }
  }

  // ---------- Voix ----------
  var hasVoice = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var frVoice = null;
  function pickVoice() {
    try {
      var vs = window.speechSynthesis.getVoices() || [];
      var fr = vs.filter(function (v) { return /^fr/i.test(v.lang); });
      // voix locale d'abord : une voix « en ligne » enverrait le texte au fournisseur
      frVoice = fr.filter(function (v) { return v.localService; })[0] || null;
    } catch (e) { frVoice = null; }
  }
  if (hasVoice) { pickVoice(); try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* rien */ } }
  function spoken(t) {
    return String(t).replace(/×/g, ' fois ').replace(/−/g, ' moins ').replace(/÷/g, ' divisé par ')
      .replace(/=/g, ' égale ').replace(/\?/g, ' ?');
  }
  var lastSaid = '';
  function voiceOn() { return hasVoice && state.settings.voice; }
  function say(text, onend) {
    lastSaid = text;
    if (!voiceOn()) return false;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(spoken(text));
      u.lang = 'fr-FR'; if (frVoice) u.voice = frVoice; u.rate = 0.9; u.pitch = 1.05;
      if (onend) { u.onend = onend; u.onerror = onend; }
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; /* voix indisponible : le texte reste affiché */ }
  }
  function hush() { try { window.speechSynthesis.cancel(); } catch (e) { /* rien */ } }

  // ---------- Sons (générés, aucun fichier) ----------
  var actx = null;
  function tone(freqs, dur) {
    if (!state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime;
      freqs.forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain(), s = t + i * dur;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.15, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
        o.connect(g); g.connect(actx.destination); o.start(s); o.stop(s + dur + 0.05);
      });
    } catch (e) { /* pas de son */ }
  }

  // ---------- Thème et réglages ----------
  function world() { return WORLDS[state.world] || WORLDS.foret; }
  function companion() { var c = world().companions[state.companion || 0]; return c ? c[0] : world().companions[0][0]; }
  function treasureOf(id) {
    if (state.treasures && state.treasures[id]) return state.treasures[id];
    var i = TM.FACTS.indexOf(TM.FACT_BY_ID[id]); return world().treasures[i] || '⭐';
  }
  function applySettings() {
    document.body.setAttribute('data-world', state.world || 'foret');
    document.body.classList.toggle('calm', !!state.settings.calm);
    $('btn-say').hidden = !(hasVoice && state.settings.voice);
  }

  // ---------- Choix du monde et du compagnon ----------
  function renderWorlds() {
    $('btn-world-back').hidden = !(state.world && state.companion != null);
    var box = clear($('world-choices'));
    Object.keys(WORLDS).forEach(function (k) {
      var w = WORLDS[k];
      box.appendChild(h('button', {
        class: 'choice', type: 'button', 'aria-pressed': String(state.world === k),
        onclick: function () {
          var changed = state.world !== k;
          state.world = k; if (changed) state.companion = null;
          persist(); applySettings(); renderCompanions(); show('s-companion');
          say('Choisis ton compagnon');
        }
      }, [h('span', { class: 'emo', 'aria-hidden': 'true', text: w.emo }), w.name]));
    });
  }
  function renderCompanions() {
    var box = clear($('companion-choices'));
    world().companions.forEach(function (c, i) {
      box.appendChild(h('button', {
        class: 'choice', type: 'button', 'aria-pressed': String(state.companion === i),
        onclick: function () { state.companion = i; persist(); goHome(true); }
      }, [h('span', { class: 'emo', 'aria-hidden': 'true', text: c[0] }), c[1]]));
    });
  }

  // ---------- Accueil ----------
  function goHome(speak) {
    var c = TM.counts(state);
    var cur = TM.CHAPTERS[TM.currentChapter(state)];
    $('home-companion').textContent = companion();
    var talk;
    if (!Object.keys(state.facts).length) {
      talk = 'Coucou ! Tu connais déjà 34 résultats. Il reste ' + c.total + ' trésors à trouver. On y va ?';
    } else if (c.mastered === c.total) {
      talk = 'Tu as tous les trésors ! On garde la forme ?';
    } else {
      talk = pick(['Content de te revoir !', 'Prête pour une partie ?', 'On continue l’aventure ?']) + ' ' + cur.hint + '.';
    }
    $('home-talk').textContent = talk;
    var p = clear($('home-progress'));
    var eggs = TM.FACTS.filter(function (f) { return state.collection.indexOf(f.id) < 0 && state.facts[f.id] && state.facts[f.id].box >= 1; }).length;
    p.appendChild(h('div', { text: 'Trésors : ' + c.treasures + ' / ' + c.total + (eggs ? '  ·  🥚 ' + eggs : '') }));
    var pct = Math.round(100 * c.treasures / c.total);
    p.appendChild(h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Trésors trouvés', 'aria-valuemin': '0', 'aria-valuemax': String(c.total), 'aria-valuenow': String(c.treasures) },
      [h('span', { style: 'width:' + pct + '%' })]));
    $('btn-collection').textContent = '🎁 Mes trésors (' + c.treasures + ')';
    show('s-home');
    if (speak) say(talk);
  }

  // ---------- Partie ----------
  var G = null;
  var timer = null;
  var stage = $('stage');

  function startGame() {
    G = { q: TM.buildSession(state, Date.now()), pos: 0, stars: 0, reasks: 0, unlocks: [], eggs: [], busy: false, lockUntil: 0 };
    G.base = G.q.length;
    show('s-game');
    try { history.pushState({ tm: 'game' }, ''); } catch (e) { /* rien */ }
    nextQ();
  }
  // Les reprises n'ajoutent pas de pastille : la partie ne « s'allonge » pas après une erreur.
  function renderDots() {
    var ol = clear($('dots'));
    var done = G.q.slice(0, G.pos).filter(function (it) { return !it.isReask; }).length;
    var cur = G.q[G.pos] && !G.q[G.pos].isReask ? done : -1;
    ol.setAttribute('aria-label', 'Question ' + Math.min(done + 1, G.base) + ' sur ' + G.base);
    for (var i = 0; i < G.base; i++) ol.appendChild(h('li', { class: i < done ? 'done' : (i === cur ? 'now' : '') }));
  }
  function locked() { return !G || G.busy || Date.now() < G.lockUntil; }
  function later(fn, ms) { clearTimeout(timer); timer = setTimeout(function () { if (G) fn(); }, ms); }
  function disp(it) { return it.flip ? [it.b, it.a] : [it.a, it.b]; }
  function qText(it) { var d = disp(it); return d[0] + ' × ' + d[1]; }
  function questionEl(it) {
    var d = disp(it);
    return h('div', { class: 'question', 'data-q': d[0] + 'x' + d[1] }, [
      h('span', { class: 'sr-only', text: d[0] + ' fois ' + d[1] }),
      h('span', { class: 'num t' + d[0], 'aria-hidden': 'true', text: String(d[0]) }),
      h('span', { class: 'op', 'aria-hidden': 'true', text: '×' }),
      h('span', { class: 'num t' + d[1], 'aria-hidden': 'true', text: String(d[1]) })
    ]);
  }
  function factOf(it) { return { kind: it.kind, a: it.a, b: it.b }; }

  function nextQ() {
    clearTimeout(timer);
    if (!G) return;
    if (G.pos >= G.q.length) return endGame();
    renderDots();
    G.busy = false;
    G.lockUntil = Date.now() + 400;
    clear(stage);
    var it = G.q[G.pos];
    if (it.mode === 'rect') renderRect(it);
    else if (it.mode === 'bulles') renderBulles(it);
    else renderPave(it);
    var hd = $('h-game'); hd.textContent = 'Question ' + (G.pos + 1) + ' : ' + spoken(qText(it));
    try { hd.focus({ preventScroll: true }); } catch (e) { hd.focus(); }
  }

  // Rectangle découpé selon le pont
  function rectEl(it, compact) {
    var br = TM.bridge(factOf(it));
    var cols = br.cols, rows = br.rows;
    var wAvail = Math.min(stage.clientWidth || 340, 560) - 150;
    var hAvail = Math.max(110, Math.min(320, (window.innerHeight || 800) - (compact ? 330 : ((window.innerHeight || 800) <= 720 ? 420 : 500))));
    var c = Math.max(8, Math.min(28, Math.floor(wAvail / cols) - 3, Math.floor(hAvail / rows) - 4));
    var wrap = h('div', { class: 'rect', 'aria-hidden': 'true' });
    var minus = br.parts.filter(function (p) { return p.kind === 'minus'; })[0];
    var plus = br.parts.filter(function (p) { return p.kind !== 'minus'; });
    plus.forEach(function (p, i) {
      var grid = h('div', { class: 'band-cells', style: 'grid-template-columns:repeat(' + cols + ',' + c + 'px)' });
      var fill = i === 0 ? 'var(--t' + p.rows + ')' : 'var(--part2)';
      for (var r = 0; r < p.rows; r++) {
        var struck = minus && i === plus.length - 1 && r >= p.rows - minus.rows;
        for (var k = 0; k < cols; k++) grid.appendChild(h('span', { class: 'cellbox' + (struck ? ' x' : ''), style: '--c:' + c + 'px;--fill:' + fill }));
      }
      wrap.appendChild(h('div', { class: 'band' }, [grid, h('span', { class: 'band-label', text: p.label })]));
    });
    if (minus) wrap.appendChild(h('div', { class: 'band minus-label', text: minus.text || ('− ' + minus.label) }));
    return { el: wrap, br: br };
  }

  function bubblesEl(it) {
    var opts = [it.answer].concat(TM.distractors(it.a, it.b, 2)).sort(function (x, y) { return x - y; });
    var box = h('div', { class: 'bubbles', role: 'group', 'aria-label': 'Choisis la bonne réponse' });
    opts.forEach(function (v) {
      box.appendChild(h('button', {
        class: 'bub', type: 'button', text: String(v), 'aria-label': 'Réponse ' + v,
        onclick: function (e) { answer(it, v, e.currentTarget); }
      }));
    });
    return box;
  }

  function renderRect(it) {
    var r = rectEl(it);
    stage.appendChild(h('span', { class: 'tag', text: '✨ Nouveau trésor à gagner' }));
    stage.appendChild(questionEl(it));
    stage.appendChild(h('div', { class: 'rect-card' }, [
      r.el,
      h('p', { class: 'sentence', text: r.br.sentence }),
      h('p', { class: 'equation', text: r.br.expr + ' = ?' })
    ]));
    stage.appendChild(bubblesEl(it));
    say(r.br.sentence + ' Combien ça fait ?');
  }
  function renderBulles(it) {
    stage.appendChild(questionEl(it));
    stage.appendChild(bubblesEl(it));
    say(qText(it) + ' ?');
  }
  function renderPave(it) {
    var len = String(it.answer).length;
    var entry = '';
    stage.appendChild(questionEl(it));
    var hinted = false, okKey = null;
    var display = h('div', { class: 'display', 'aria-hidden': 'true' });
    var status = h('p', { class: 'sr-only', role: 'status' });
    var note = h('p', { class: 'pave-note', role: 'status' });
    var slots = [];
    for (var i = 0; i < Math.max(len, 2); i++) { var sl = h('span'); slots.push(sl); display.appendChild(sl); }
    stage.appendChild(display); stage.appendChild(status); stage.appendChild(note);
    function refresh() {
      slots.forEach(function (sl, i) { sl.textContent = entry[i] || ''; });
      status.textContent = entry ? 'Ta réponse : ' + entry : '';
      okKey.classList.toggle('ready', !!entry);
    }
    function press(k) {
      if (locked()) return;
      if (k === 'del') { entry = entry.slice(0, -1); note.textContent = ''; refresh(); return; }
      if (k === 'ok') {
        if (!entry) return;
        var v = Number(entry), rev = Number(entry.split('').reverse().join(''));
        if (!hinted && entry.length === 2 && v !== it.answer && rev === it.answer) {
          hinted = true;   // inversion typique de la dyslexie : on le dit, sans compter faux
          note.textContent = 'Presque ! Regarde bien l’ordre des chiffres.';
          say('Presque ! Regarde bien l’ordre des chiffres.');
          entry = ''; refresh(); return;
        }
        answer(it, v, null); return;
      }
      if (entry.length >= 3) return;
      entry += k; note.textContent = ''; refresh();
    }
    var pad = h('div', { class: 'pad', role: 'group', 'aria-label': 'Pavé de chiffres' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(function (k) {
      var label = k === 'del' ? '⌫' : (k === 'ok' ? '✓' : k);
      var aria = k === 'del' ? 'Effacer' : (k === 'ok' ? 'Valider' : k);
      var b = h('button', { class: 'key' + (k === 'del' ? ' alt' : '') + (k === 'ok' ? ' go' : ''), type: 'button', text: label, 'aria-label': aria, onclick: function () { press(k); } });
      if (k === 'ok') okKey = b;
      pad.appendChild(b);
    });
    stage.appendChild(pad);
    refresh();
    G.padPress = press;
    say(qText(it) + ' ?');
  }

  function answer(it, val, el) {
    if (locked()) return;
    G.busy = true; G.padPress = null;
    var ok = val === it.answer;
    var before = it.kind === 'learn' && state.facts[it.id] ? state.facts[it.id].box : 0;
    var r = TM.recordAnswer(state, it, ok, Date.now());
    persist();
    if (r.unlocked) G.unlocks.push(r.unlocked);
    if (it.kind === 'learn' && before === 0 && state.facts[it.id].box >= 1 && G.eggs.indexOf(it.id) < 0) G.eggs.push(it.id);
    if (el) el.classList.add(ok ? 'good' : 'bad');
    if (ok) {
      G.stars++;
      tone([660, 880], 0.12);
      later(function () { showSuccess(it); }, el ? 250 : 0);
    } else {
      tone([330, 262], 0.18);
      if (G.reasks < TM.MAX_REASKS && !it.isReask) {
        G.reasks++;
        G.q.splice(Math.min(G.q.length, G.pos + 3), 0, TM.makeReask(it));
      }
      later(function () { showBridge(it); }, el ? 350 : 0);
    }
  }

  function nextBtn(label) {
    return h('button', { class: 'btn btn-play small', type: 'button', id: 'btn-next', text: label, onclick: advance });
  }
  function advance() {
    clearTimeout(timer);
    if (!G || Date.now() < G.lockUntil) return;
    G.pos++; nextQ();
  }

  function showSuccess(it) {
    clear(stage);
    var cheer = pick(CHEERS);
    stage.appendChild(h('div', { class: 'cheer anim-bounce', 'aria-hidden': 'true', text: companion() }));
    stage.appendChild(h('p', { class: 'feedback ok anim-pop', text: cheer + ' ⭐' }));
    stage.appendChild(h('p', { class: 'equation', text: qText(it) + ' = ' + it.answer }));
    var b = nextBtn('Suivant ▶');
    stage.appendChild(b);
    live(cheer + ' ' + spoken(qText(it)) + ' égale ' + it.answer);
    b.focus();
    G.lockUntil = Date.now() + 400;
    var t0 = Date.now(), me = G;
    var talking = say(cheer + ' ' + qText(it) + ', ' + it.answer, function () {
      if (G === me) later(advance, Math.max(500, 1200 - (Date.now() - t0)));
    });
    later(advance, talking ? 6000 : 2000);   // filet de sécurité si la fin de phrase n'arrive pas
  }

  function showBridge(it) {
    clear(stage);
    var r = rectEl(it, true);
    var d = disp(it);
    stage.appendChild(h('p', { class: 'feedback oops', text: 'Presque ! Regarde :' }));
    var kids = [];
    if (it.flip) kids.push(h('p', { class: 'sentence', text: d[0] + ' × ' + d[1] + ', c’est pareil que ' + it.a + ' × ' + it.b + '.' }));
    kids.push(r.el, h('p', { class: 'sentence', text: r.br.sentence }), h('p', { class: 'equation', text: r.br.equation }));
    stage.appendChild(h('div', { class: 'rect-card' }, kids));
    stage.appendChild(h('p', { class: 'equation', text: qText(it) + ' = ' + it.answer }));
    var b = nextBtn('J’ai compris ✓');
    stage.appendChild(b);
    var msg = r.br.sentence + ' ' + r.br.equation + '. Donc ' + qText(it) + ' = ' + it.answer + '.';
    live(spoken(msg));
    say('Presque ! ' + msg);
    b.focus();
    G.lockUntil = Date.now() + 600;
  }

  function endGame() {
    var r = TM.recordSessionEnd(state, Date.now());
    G.unlocks.forEach(function (id) { if (!state.treasures[id]) state.treasures[id] = world().treasures[TM.FACTS.indexOf(TM.FACT_BY_ID[id])] || '⭐'; });
    persist();
    $('h-end').textContent = G.stars >= Math.ceil(G.q.length / 2) ? 'Bravo !' : 'Bien joué !';
    $('end-companion').textContent = companion();
    $('end-companion').className = 'companion big anim-bounce';
    $('end-stars').textContent = '⭐ ' + G.stars + ' étoile' + (G.stars > 1 ? 's' : '');
    var u = clear($('end-unlocks'));
    G.unlocks.forEach(function (id) {
      var f = TM.FACT_BY_ID[id];
      u.appendChild(h('div', { class: 'unlock anim-pop' }, [
        h('span', { class: 'emo', 'aria-hidden': 'true', text: treasureOf(id) }),
        h('span', { text: f.a + ' × ' + f.b + ' = ' + f.answer })
      ]));
    });
    G.eggs.forEach(function (id) {
      var f = TM.FACT_BY_ID[id];
      u.appendChild(h('div', { class: 'unlock anim-pop' }, [
        h('span', { class: 'emo', 'aria-hidden': 'true', text: '🥚' }),
        h('span', { text: f.a + ' × ' + f.b + ' = ' + f.answer })
      ]));
    });
    var c = TM.counts(state);
    var msg = G.unlocks.length ? (G.unlocks.length > 1 ? 'Nouveaux trésors !' : 'Nouveau trésor !') + ' ' : '';
    if (G.eggs.length) msg += G.eggs.length > 1
      ? G.eggs.length + ' œufs magiques trouvés ! Ils écloront quand tu retrouveras ces résultats un autre jour. '
      : 'Un œuf magique trouvé ! Il éclora quand tu retrouveras ce résultat un autre jour. ';
    if (c.treasures) msg += 'Tu as ' + c.treasures + ' trésor' + (c.treasures > 1 ? 's' : '') + ' sur ' + c.total + '.';
    if (r.suggestPause) msg += ' Super travail ! Ton cerveau range tout ça pendant une pause. Reviens tout à l’heure.';
    $('end-msg').textContent = msg;
    $('btn-again').className = r.suggestPause ? 'btn btn-soft' : 'btn btn-play small';
    show('s-end');
    if (G.unlocks.length || G.eggs.length) tone([523, 659, 784, 1047], 0.12);
    say($('h-end').textContent + ' Tu as gagné ' + G.stars + ' étoile' + (G.stars > 1 ? 's' : '') + '. ' + msg);
    G = null;
  }

  // ---------- Collection ----------
  function renderCollection() {
    var list = clear($('collection'));
    var c = TM.counts(state);
    var eggs = TM.FACTS.filter(function (f) { return state.collection.indexOf(f.id) < 0 && state.facts[f.id] && state.facts[f.id].box >= 1; }).length;
    $('coll-count').textContent = c.treasures + ' trésor' + (c.treasures > 1 ? 's' : '') + ' sur ' + c.total + (eggs ? ' · ' + eggs + ' œuf' + (eggs > 1 ? 's' : '') + ' en train d’éclore' : '') + '. Touche-les pour les entendre.';
    TM.FACTS.forEach(function (f) {
      var has = state.collection.indexOf(f.id) >= 0;
      var egg = !has && state.facts[f.id] && state.facts[f.id].box >= 1;
      var txt = f.a + ' × ' + f.b + ' = ' + f.answer;
      list.appendChild(h('li', null, [(has || egg)
        ? h('button', { type: 'button', 'aria-label': (egg ? 'Œuf magique : ' : '') + spoken(txt), onclick: function (e) { say(txt); var em = e.currentTarget.firstChild; em.classList.remove('anim-pop'); void em.offsetWidth; em.classList.add('anim-pop'); } },
          [h('span', { class: 'emo', 'aria-hidden': 'true', text: has ? treasureOf(f.id) : '🥚' }), h('span', { 'aria-hidden': 'true', text: txt })])
        : h('div', { class: 'locked', role: 'img', 'aria-label': 'Trésor à trouver', text: '?' })
      ]));
    });
    show('s-collection');
  }

  // ---------- Porte parent (appui maintenu 3 s, souris, tactile ou clavier) ----------
  var holdStart = 0, holdRaf = 0;
  function holdBegin(e) {
    if (e && e.cancelable) e.preventDefault();
    if (holdStart) return;
    holdStart = performance.now();
    var fill = $('hold-fill');
    (function step() {
      var p = Math.min(1, (performance.now() - holdStart) / 3000);
      fill.style.width = (p * 100) + '%';
      if (p >= 1) { holdEnd(); renderParent(); return; }
      holdRaf = requestAnimationFrame(step);
    })();
  }
  function holdEnd() { holdStart = 0; cancelAnimationFrame(holdRaf); $('hold-fill').style.width = '0'; }

  // ---------- Espace parent ----------
  var STATUS_TXT = { socle: ['✓', 'socle'], maitrise: ['★', 'maîtrisé'], retenu: ['✓', 'retenu'], encours: ['●', 'en cours'], nouveau: ['○', 'pas encore vu'], revoir: ['!', 'à revoir'] };
  function renderParent() {
    var c = TM.counts(state);
    var cur = TM.CHAPTERS[TM.currentChapter(state)];
    var warn = $('parent-warn');
    warn.hidden = storage && !loaded.recovered;
    warn.textContent = !storage ? 'Ce navigateur n’autorise pas l’enregistrement : les progrès seront perdus à la fermeture.'
      : 'Les données enregistrées étaient illisibles : les progrès ont été remis à zéro (une copie de secours a été gardée).';
    var s = state.stats;
    $('parent-summary').textContent = 'Trésors : ' + c.treasures + ' / ' + c.total + ' · maîtrisés : ' + c.mastered +
      ' · en cours : ' + c.inProgress + '. Parties jouées : ' + s.sessions + ', sur ' + s.daysPlayed + ' jour' + (s.daysPlayed > 1 ? 's' : '') +
      '. Étape actuelle : table de ' + cur.table + ' (' + cur.hint + ').';
    var t = $('parent-grid');
    Array.prototype.slice.call(t.querySelectorAll('thead, tbody')).forEach(function (n) { n.remove(); });
    var head = h('tr', null, [h('th', { scope: 'col', text: '×' })]);
    for (var j = 1; j <= 10; j++) head.appendChild(h('th', { scope: 'col', text: String(j) }));
    t.appendChild(h('thead', null, [head]));
    var body = h('tbody');
    for (var a = 1; a <= 10; a++) {
      var tr = h('tr', null, [h('th', { scope: 'row', text: String(a) })]);
      for (var b = 1; b <= 10; b++) {
        var st = TM.statusOf(state, a, b);
        var lab = a + ' fois ' + b + ' : ' + STATUS_TXT[st][1];
        tr.appendChild(h('td', { class: 'st-' + st, title: lab, 'aria-label': lab, text: STATUS_TXT[st][0] }));
      }
      body.appendChild(tr);
    }
    t.appendChild(body);
    $('set-voice').checked = state.settings.voice;
    $('set-voice').disabled = !hasVoice;
    $('set-sound').checked = state.settings.sound;
    $('set-calm').checked = state.settings.calm;
    $('confirm-reset').hidden = true;
    show('s-parent');
  }

  // ---------- Branchements ----------
  $('btn-play').addEventListener('click', startGame);
  $('btn-again').addEventListener('click', startGame);
  $('btn-end-home').addEventListener('click', function () { goHome(false); });
  $('btn-collection').addEventListener('click', renderCollection);
  $('btn-coll-back').addEventListener('click', function () { goHome(false); });
  $('btn-world').addEventListener('click', function () { renderWorlds(); show('s-world'); say('Choisis ton monde'); });
  function quitGame() { clearTimeout(timer); G = null; hush(); $('live').textContent = ''; goHome(false); }
  $('btn-pause').addEventListener('click', function () { if (history.state && history.state.tm === 'game') { try { history.back(); return; } catch (e) { /* rien */ } } quitGame(); });
  // Bouton « retour » d'Android pendant une partie = pause (au lieu de fermer l'appli)
  window.addEventListener('popstate', function () { if (G) quitGame(); });
  $('btn-world-back').addEventListener('click', function () { goHome(false); });
  $('btn-comp-back').addEventListener('click', function () { renderWorlds(); show('s-world'); });
  $('btn-say').addEventListener('click', function () { if (lastSaid) say(lastSaid); });
  $('btn-parent').addEventListener('click', function () { holdEnd(); show('s-gate'); });
  $('btn-gate-back').addEventListener('click', function () { holdEnd(); goHome(false); });
  $('btn-parent-back').addEventListener('click', function () { goHome(false); });
  var hold = $('btn-hold');
  hold.addEventListener('pointerdown', holdBegin);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { hold.addEventListener(ev, holdEnd); });
  hold.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  hold.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) holdBegin(e); });
  hold.addEventListener('keyup', function (e) { if (e.key === 'Enter' || e.key === ' ') holdEnd(); });

  [['set-voice', 'voice'], ['set-sound', 'sound'], ['set-calm', 'calm']].forEach(function (p) {
    $(p[0]).addEventListener('change', function (e) {
      state.settings[p[1]] = e.target.checked; persist(); applySettings();
      if (p[1] === 'voice' && !e.target.checked) { try { window.speechSynthesis.cancel(); } catch (x) { /* rien */ } }
    });
  });
  $('btn-reset').addEventListener('click', function () { $('confirm-reset').hidden = false; $('btn-reset-no').focus(); });
  $('btn-reset-no').addEventListener('click', function () { $('confirm-reset').hidden = true; $('btn-reset').focus(); });
  $('btn-reset-yes').addEventListener('click', function () {
    state = TM.freshState();
    try { storage.removeItem(TM.STORE_KEY); storage.removeItem(TM.STORE_KEY + '-backup'); } catch (e) { /* rien */ }
    loaded.recovered = false;
    applySettings(); renderWorlds(); show('s-world');
  });

  // Clavier physique pour le pavé (ordinateur, accessibilité)
  document.addEventListener('keydown', function (e) {
    if (!G || !G.padPress || $('s-game').hidden) return;
    if (/^[0-9]$/.test(e.key)) { G.padPress(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { G.padPress('del'); e.preventDefault(); }
    else if (e.key === 'Enter') {
      var ae = document.activeElement;
      if (!ae || ae === document.body || ae.id === 'h-game') { G.padPress('ok'); e.preventDefault(); }
    }
  });

  // Hors ligne (uniquement en HTTPS hors cadre isolé ; ignoré sinon)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('sw.js').catch(function () { /* aperçu sans hors ligne */ }); } catch (e) { /* rien */ }
  }

  // ---------- Démarrage ----------
  applySettings();
  if (!state.world || !WORLDS[state.world]) { renderWorlds(); show('s-world'); }
  else if (state.companion == null) { renderCompanions(); show('s-companion'); }
  else goHome(false);

  window.__TM_APP__ = { getState: function () { return state; } }; // pour les tests
})();
