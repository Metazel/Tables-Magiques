/* Tests unitaires de la logique (node tests/core.test.js). Aucune dépendance. */
'use strict';
var assert = require('assert');
var TM = require('../core.js');
var n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); console.log('  ok  ' + name); } catch (e) { failed++; console.log('  KO  ' + name + '\n      ' + e.message); } }
function seeded(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function memStore() { var d = {}; return { getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; }, _d: d }; }
var NOW = new Date(2026, 10, 8, 15, 0, 0).getTime();

console.log('Faits et ponts');
t('21 faits à apprendre + 34 du socle = 55 résultats distincts', function () {
  assert.strictEqual(TM.FACTS.length, 21);
  assert.strictEqual(TM.SOCLE_FACTS.length, 34);
  var keys = {};
  TM.FACTS.concat(TM.SOCLE_FACTS).forEach(function (f) { keys[TM.pairKey(f.a, f.b)] = 1; });
  assert.strictEqual(Object.keys(keys).length, 55);
});
t('aucun fait à apprendre ne contient 1, 2, 5 ou 10', function () {
  TM.FACTS.forEach(function (f) { assert.ok(TM.SOCLE.indexOf(f.a) < 0 && TM.SOCLE.indexOf(f.b) < 0, f.id); });
});
t('chaque pont est mathématiquement exact (rectangle, expression, résultat) — 55 faits', function () {
  TM.FACTS.concat(TM.SOCLE_FACTS).forEach(function (f) {
    var br = TM.bridge(f);
    var total = br.parts.reduce(function (s, p) { return s + (p.kind === 'minus' ? -p.value : p.value); }, 0);
    assert.strictEqual(total, f.answer, 'somme des bandes ' + f.id);
    assert.strictEqual(br.cols, f.b, 'colonnes ' + f.id);
    var expr = br.expr.replace('−', '-').replace('÷', '/');
    if (/^[\d +\-/]+$/.test(expr)) assert.strictEqual(eval(expr), f.answer, 'expression ' + f.id + ' : ' + br.expr); // eslint-disable-line no-eval
    assert.ok(br.equation.slice(-String(f.answer).length) === String(f.answer), 'équation ' + f.id);
    assert.ok(br.rows >= 1 && br.rows <= 10, 'lignes ' + f.id);
    assert.ok(br.sentence.length > 5);
  });
});
t('les ponts ne s’appuient que sur des tables déjà connues ou déjà apprises', function () {
  var order = [2, 5, 10, 1];
  TM.CHAPTERS.forEach(function (ch) {
    var br = TM.bridge({ kind: 'learn', a: ch.table, b: 7 });
    br.parts.forEach(function (p) { assert.ok(order.indexOf(p.rows) >= 0 || p.rows === 4, ch.id + ' utilise ×' + p.rows); });
    order.push(ch.table);
  });
});

console.log('Distracteurs');
t('2 distracteurs distincts, positifs, ≤ 120, différents de la réponse (tous les faits, 50 tirages)', function () {
  var rng = seeded(7);
  TM.FACTS.concat(TM.SOCLE_FACTS).forEach(function (f) {
    for (var i = 0; i < 50; i++) {
      var d = TM.distractors(f.a, f.b, 2, rng);
      assert.strictEqual(d.length, 2, f.id);
      assert.notStrictEqual(d[0], d[1]);
      d.forEach(function (v) { assert.ok(v > 0 && v <= 120 && v !== f.answer, f.id + ' -> ' + v); });
    }
  });
});

console.log('Planificateur');
t('première partie : 8 questions, 2 nouveautés du chapitre ×4, commence par une victoire facile', function () {
  var s = TM.freshState();
  var q = TM.buildSession(s, NOW, seeded(1));
  assert.strictEqual(q.length, 8);
  var news = q.filter(function (i) { return i.isNew && i.kind === 'learn'; });
  assert.strictEqual(news.length, 2);
  news.forEach(function (i) { assert.strictEqual(i.a, 4); assert.strictEqual(i.mode, 'rect'); });
  assert.strictEqual(q[0].kind, 'socle');
  var ids = q.map(function (i) { return i.id; });
  assert.strictEqual(new Set(ids).size, ids.length, 'pas de doublon');
});
t('jamais 3 fois de suite le même mini-jeu quand c’est évitable (200 parties simulées)', function () {
  var rng = seeded(3);
  var s = TM.freshState();
  for (var k = 0; k < 200; k++) {
    var q = TM.buildSession(s, NOW + k * TM.DAY, rng);
    for (var i = 2; i < q.length; i++) {
      var same = q[i].mode === q[i - 1].mode && q[i].mode === q[i - 2].mode;
      if (same) assert.strictEqual(q[i].mode, 'rect', 'partie ' + k + ' position ' + i);
    }
    q.forEach(function (it) { TM.recordAnswer(s, it, rng() < 0.8, NOW + k * TM.DAY); });
  }
});
t('Leitner : réussite = boîte +1 avec échéance espacée ; erreur = recul d’une boîte, jamais sous 1', function () {
  var s = TM.freshState();
  var f = TM.FACT_BY_ID['4x7'];
  var it = { kind: 'learn', id: f.id, a: 4, b: 7, answer: 28, wasDue: true, isNew: true, isReask: false };
  TM.recordAnswer(s, it, true, NOW);
  assert.strictEqual(s.facts['4x7'].box, 1);
  it.isNew = false;
  TM.recordAnswer(s, it, true, NOW);
  assert.strictEqual(s.facts['4x7'].box, 2);
  assert.ok(s.facts['4x7'].due > NOW, 'boîte 2 due demain');
  TM.recordAnswer(s, it, false, NOW);
  assert.strictEqual(s.facts['4x7'].box, 1);
  TM.recordAnswer(s, it, false, NOW);
  assert.strictEqual(s.facts['4x7'].box, 1);
});
t('réussite hors échéance (révision bonus) : pas de promotion, donc espacement respecté', function () {
  var s = TM.freshState();
  s.facts['4x7'] = { box: 3, due: NOW + 5 * TM.DAY, ok: 3, ko: 0 };
  TM.recordAnswer(s, { kind: 'learn', id: '4x7', answer: 28, wasDue: false, isNew: false, isReask: false }, true, NOW);
  assert.strictEqual(s.facts['4x7'].box, 3);
});
t('reprise réussie après le pont : un nouveau fait raté passe en boîte 1', function () {
  var s = TM.freshState();
  var it = { kind: 'learn', id: '3x8', a: 3, b: 8, answer: 24, wasDue: true, isNew: true, isReask: false };
  TM.recordAnswer(s, it, false, NOW);
  assert.strictEqual(s.facts['3x8'].box, 0);
  TM.recordAnswer(s, TM.makeReask(it), true, NOW);
  assert.strictEqual(s.facts['3x8'].box, 1);
});
t('trésor débloqué à la boîte 3 et jamais retiré, même après des erreurs', function () {
  var s = TM.freshState();
  var it = { kind: 'learn', id: '4x6', a: 4, b: 6, answer: 24, wasDue: true, isNew: false, isReask: false, mode: 'pave' };
  var got = [];
  for (var i = 0; i < 3; i++) got.push(TM.recordAnswer(s, it, true, NOW + i * 3 * TM.DAY).unlocked);
  assert.deepStrictEqual(got, [null, null, '4x6']);
  TM.recordAnswer(s, it, false, NOW + 10 * TM.DAY);
  TM.recordAnswer(s, it, false, NOW + 10 * TM.DAY);
  assert.ok(s.collection.indexOf('4x6') >= 0);
});
t('chapitre suivant ouvert quand tout le chapitre courant est en boîte ≥ 2, et jamais reperdu', function () {
  var s = TM.freshState();
  assert.strictEqual(TM.currentChapter(s), 0);
  TM.CHAPTERS[0].others.forEach(function (b) { s.facts['4x' + b] = { box: 2, due: NOW, ok: 2, ko: 0 }; });
  assert.strictEqual(TM.currentChapter(s), 1);
  s.facts['4x9'].box = 1;
  assert.strictEqual(TM.currentChapter(s), 1, 'un chapitre atteint n’est jamais perdu');
});
t('surcharge évitée : pas de nouveauté quand 8 faits sont déjà en cours', function () {
  var s = TM.freshState();
  TM.FACTS.slice(0, 8).forEach(function (f) { s.facts[f.id] = { box: 1, due: NOW + TM.DAY, ok: 1, ko: 0 }; });
  for (var c = 0; c < 6; c++) TM.CHAPTERS[0].others.forEach(function (b) { if (!s.facts['4x' + b]) s.facts['4x' + b] = { box: 2, due: NOW + TM.DAY, ok: 1, ko: 0 }; });
  var q = TM.buildSession(s, NOW, seeded(5));
  assert.strictEqual(q.filter(function (i) { return i.isNew; }).length, 0);
  assert.strictEqual(q.length, 8, 'complétée par des victoires faciles');
});
t('simulation 60 jours (1 partie/jour, 80 % de réussite) : toutes les tables apprises, jamais de partie vide', function () {
  var rng = seeded(11);
  var s = TM.freshState();
  for (var d = 0; d < 60; d++) {
    var day = NOW + d * TM.DAY;
    var q = TM.buildSession(s, day, rng);
    assert.ok(q.length >= 8);
    q.forEach(function (it) { TM.recordAnswer(s, it, rng() < 0.8, day); });
    TM.recordSessionEnd(s, day);
  }
  var c = TM.counts(s);
  assert.strictEqual(c.unseen, 0, 'tous les faits introduits');
  assert.ok(c.treasures >= 18, 'trésors : ' + c.treasures);
  assert.strictEqual(s.stats.daysPlayed, 60);
});
t('tout maîtrisé : la partie reste jouable', function () {
  var s = TM.freshState();
  TM.FACTS.forEach(function (f) { s.facts[f.id] = { box: 6, due: NOW + 9 * TM.DAY, ok: 9, ko: 0 }; });
  var q = TM.buildSession(s, NOW, seeded(2));
  assert.strictEqual(q.length, 8);
});

t('plusieurs parties le même jour : un seul palier par jour et au plus ' + TM.NEW_PER_DAY + ' nouveautés', function () {
  var s = TM.freshState(); var rng = seeded(9);
  for (var k = 0; k < 6; k++) {
    TM.buildSession(s, NOW + k * 10 * 60000, rng).forEach(function (it) { TM.recordAnswer(s, it, true, NOW + k * 10 * 60000); });
  }
  var seen = Object.keys(s.facts);
  assert.ok(seen.length <= TM.NEW_PER_DAY, seen.length + ' nouveautés');
  seen.forEach(function (id) { assert.ok(s.facts[id].box <= 1, id + ' boîte ' + s.facts[id].box); });
  assert.strictEqual(TM.currentChapter(s), 0);
});
t('trésor seulement après un rappel au pavé (pas sur deux bulles réussies)', function () {
  var s = TM.freshState();
  var it = { kind: 'learn', id: '4x8', a: 4, b: 8, answer: 32, wasDue: true, isNew: false, isReask: false, mode: 'bulles' };
  TM.recordAnswer(s, it, true, NOW); TM.recordAnswer(s, it, true, NOW + 2 * TM.DAY); TM.recordAnswer(s, it, true, NOW + 4 * TM.DAY);
  assert.ok(s.facts['4x8'].box >= 3 && s.collection.length === 0);
  it.mode = 'pave'; it.wasDue = false;
  assert.strictEqual(TM.recordAnswer(s, it, true, NOW + 4 * TM.DAY).unlocked, '4x8');
});
t('erreur puis reprise ratée : un seul recul de boîte', function () {
  var s = TM.freshState(); s.facts['4x7'] = { box: 4, due: NOW, ok: 4, ko: 0 };
  var it = { kind: 'learn', id: '4x7', answer: 28, wasDue: true, isNew: false, isReask: false, mode: 'pave' };
  TM.recordAnswer(s, it, false, NOW); TM.recordAnswer(s, TM.makeReask(it), false, NOW);
  assert.strictEqual(s.facts['4x7'].box, 3);
});
t('chapitre reculé : les faits déjà vus d’un chapitre plus avancé restent révisés', function () {
  var s = TM.freshState();
  s.facts['3x7'] = { box: 1, due: NOW - 1, ok: 1, ko: 0 };
  var q = TM.buildSession(s, NOW, seeded(6));
  assert.ok(q.some(function (i) { return i.id === '3x7'; }));
});
t('changement d’heure (25/10) : un fait de boîte 2 n’est pas redû le jour même', function () {
  var t0 = new Date(2026, 9, 24, 18, 0).getTime();
  var due = TM.dueFor(2, t0);
  var d = new Date(due);
  assert.strictEqual(d.getDate(), 25); assert.strictEqual(d.getHours(), 0);
});

console.log('Stockage et limites');
t('aller-retour sauvegarde / chargement', function () {
  var st = memStore(); var s = TM.freshState();
  s.world = 'ocean'; s.companion = 1; s.facts['4x7'] = { box: 2, due: NOW, ok: 2, ko: 1, recall: true }; s.collection.push('4x7'); s.treasures['4x7'] = '🦉'; s.maxChapter = 1;
  assert.ok(TM.save(st, s));
  var r = TM.load(st);
  assert.deepStrictEqual(r.state, s); assert.ok(r.persistent); assert.ok(!r.recovered);
});
t('JSON corrompu → état neuf, copie de secours, aucune exception', function () {
  var st = memStore(); st.setItem(TM.STORE_KEY, '{pas du json');
  var r = TM.load(st);
  assert.ok(r.recovered); assert.strictEqual(r.state.world, null);
  assert.strictEqual(st.getItem(TM.STORE_KEY + '-backup'), '{pas du json');
});
t('données hostiles ou absurdes filtrées (ids inconnus, boîtes hors bornes, types faux, prototype)', function () {
  var raw = { v: 1, world: 'ocean', companion: 99, facts: { '4x7': { box: 999, due: 'x', ok: -5, ko: 'a' }, 'evil': { box: 1 }, '__proto__': { box: 1 } },
    socle: { 'bad key': {}, '2x7': { ok: 3, ko: 1 } }, collection: ['4x7', '4x7', 'nope'], stats: { sessions: 'lots', recentEnds: [1, 'x', null] }, settings: { voice: 'yes', calm: true } };
  var s = TM.sanitize(JSON.parse(JSON.stringify(raw)));
  assert.strictEqual(s.companion, null);
  assert.deepStrictEqual(Object.keys(s.facts), ['4x7']);
  assert.strictEqual(s.facts['4x7'].box, TM.MASTER_BOX); assert.strictEqual(s.facts['4x7'].due, 0); assert.strictEqual(s.facts['4x7'].ok, 0);
  assert.deepStrictEqual(Object.keys(s.socle), ['2x7']);
  assert.deepStrictEqual(s.collection, ['4x7']);
  assert.strictEqual(s.stats.sessions, 0);
  assert.strictEqual(s.settings.voice, true); assert.strictEqual(s.settings.calm, true);
  assert.strictEqual({}.box, undefined, 'prototype intact');
});
t('données trafiquées : monde inconnu et ids hérités du prototype rejetés', function () {
  var s = TM.sanitize({ v: 1, world: 'constructor', collection: ['constructor', 'toString', '4x7'], facts: { constructor: { box: 3 } }, treasures: { toString: 'x', '4x7': '🦉' } });
  assert.strictEqual(s.world, null);
  assert.deepStrictEqual(s.collection, ['4x7']);
  assert.deepStrictEqual(Object.keys(s.facts), []);
  assert.deepStrictEqual(s.treasures, { '4x7': '🦉' });
});
t('mauvaise version de schéma → état neuf', function () {
  var st = memStore(); st.setItem(TM.STORE_KEY, JSON.stringify({ v: 2 }));
  assert.ok(TM.load(st).recovered);
});
t('stockage indisponible (navigation privée, quota) → jeu jouable, sans exception', function () {
  var throwing = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('quota'); }, removeItem: function () {} };
  var r = TM.load(throwing);
  assert.ok(!r.persistent);
  assert.strictEqual(TM.save(throwing, r.state), false);
  assert.strictEqual(TM.load(null).persistent, false);
});
t('taille des données sauvegardées < 5 Ko après 60 jours', function () {
  var rng = seeded(4); var s = TM.freshState();
  for (var d = 0; d < 60; d++) { TM.buildSession(s, NOW + d * TM.DAY, rng).forEach(function (it) { TM.recordAnswer(s, it, rng() < 0.7, NOW + d * TM.DAY); }); TM.recordSessionEnd(s, NOW + d * TM.DAY); }
  var size = JSON.stringify(s).length;
  assert.ok(size < 5000, size + ' octets');
});
t('pause suggérée après 3 parties en moins de 40 minutes', function () {
  var s = TM.freshState();
  assert.ok(!TM.recordSessionEnd(s, NOW).suggestPause);
  assert.ok(!TM.recordSessionEnd(s, NOW + 5 * 60000).suggestPause);
  assert.ok(TM.recordSessionEnd(s, NOW + 10 * 60000).suggestPause);
  assert.ok(!TM.recordSessionEnd(s, NOW + 120 * 60000).suggestPause);
});

console.log('\n' + (n - failed) + '/' + n + ' tests réussis');
process.exit(failed ? 1 : 0);
