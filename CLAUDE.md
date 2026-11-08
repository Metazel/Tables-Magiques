# Tables Magiques — cadrage du projet

Application (PWA, hors ligne, Android) pour aider Emma, 10 ans, à mémoriser les tables de multiplication.
Projet personnel de David Scemama. Cadre : skill « cadrage-projet-dev » + exigences transverses (NFR).

## Profil d'usage (contexte donné par le parent, NON stocké dans l'appli)
- Sait ×1, ×2, ×5 (et ×10). ×3 et ×4 : réflexion nécessaire. Le reste n'est pas acquis.
- TDAH + dyslexie : sessions très courtes, une seule chose à l'écran, voix, peu de texte, gros chiffres, pas de chrono imposé.
- Doit être vécu comme un jeu. Aime décider : elle choisit son univers et son compagnon.

## Pédagogie (sources : récupération active + espacement ; remédiation par stratégies)
- 55 résultats distincts (commutativité). 34 reposent sur 1, 2, 5, 10 = « socle ». Il en reste 21 à apprendre.
- Ponts depuis le socle, dans cet ordre de chapitres :
  ×4 = double de ×2 → ×3 = ×2 + 1 fois → ×9 = ×10 − 1 fois → ×6 = ×5 + 1 fois → ×8 = double de ×4 → ×7 = ×5 + ×2.
- Parcours d'un résultat : Voir (rectangle découpé selon le pont) → Reconnaître (3 bulles) → Retrouver (pavé).
- Répétition espacée de type Leitner (boîtes 1 à 5, intervalles 1/1/2/4/8 jours ; maîtrisé ensuite, revu tous les 15 jours).
  Un palier seulement à l'échéance (jamais deux le même jour), 4 nouveautés max par jour, chapitre atteint jamais perdu.
  Récompenses : œuf magique dès le premier succès ; trésor (boîte ≥ 3) seulement après un rappel libre au pavé, emoji figé au déblocage.
- Pavé : validation par ✓ (droit de corriger) ; chiffres inversés (82 pour 28) signalés une fois sans compter faux.
- Erreur : pont imagé immédiat, puis la question revient plus loin dans la même partie. Un seul recul d'une boîte par partie.
- Partie = 8 questions (+ 2 reprises max) ; ~75 % de réussite visée en mêlant résultats du socle.

## MVP (validé le 08/11/2026)
1. Choix de l'univers et du compagnon (modifiable).
2. Partie courte et variée (8 questions, ≥ 2 types de mini-jeux).
3. Pont imagé en cas d'erreur + reprise dans la partie.
4. Voix (lecture des questions, réécoute), aucune saisie clavier.
5. Collection : 1 pièce par résultat retenu (boîte ≥ 3), jamais retirée. Progrès conservé.
6. Vue parent : grille 10×10 (su / en cours / pas vu), via appui maintenu 3 s.
Hors MVP : mode record chronométré, multi-profils (Sacha), jeu de mémo, notifications, export.

## Conformité (by design)
- RGPD / CNIL : aucune donnée envoyée, aucun compte, aucun serveur applicatif, aucun traceur tiers, aucune police ou CDN externe
  (pas de transfert d'IP à un tiers). Seul stockage : progrès dans le localStorage de la tablette = stockage strictement
  nécessaire au service demandé → exempté de consentement (art. 82 loi Informatique et Libertés). Information affichée dans
  la vue parent. Effacement possible à tout moment (bouton « Tout effacer »).
- Aucune donnée de santé ni identité dans l'appli (pas de prénom, pas de profil TDAH/dys stocké).
- Mineurs : pas de traitement fondé sur le consentement de l'enfant, donc la règle des 15 ans ne s'applique pas ;
  recommandations CNIL mineurs appliquées : minimisation, pas de profilage, espace parent, pas de dark patterns
  (aucune perte de récompense, pas de série « à ne pas casser », pas de pression temporelle, pas de notification).
- RGAA 4.1 (niveau AA visé) : lang="fr", contrastes ≥ 4,5:1, cibles tactiles ≥ 64 px, focus visible, libellés accessibles,
  zone aria-live pour les retours, information jamais portée par la couleur seule, aucun clignotement,
  respect de prefers-reduced-motion + option « animations calmes », voix = alternative au texte et texte = alternative à la voix.

## Conception (mini-ADR)
- ADR1 — PWA statique HTML/CSS/JS sans framework ni dépendance d'exécution : frugal, auditable, hors ligne. Rejeté : app native (coût), framework (poids).
- ADR2 — Découpage : core.js (logique pure testable : faits, ponts, planificateur, distracteurs, stockage) / app.js (interface) / styles.css. API interne via `window.TM`.
- ADR3 — Stockage localStorage versionné, validé au chargement, repli en mémoire si indisponible. Rejeté : IndexedDB (inutile pour < 5 Ko).
- ADR4 — Voix : Web Speech API native (fr-FR), optionnelle ; si absente, le bouton disparaît. Sons : WebAudio généré (pas de fichiers).
- ADR5 — Hébergement : GitHub Pages (HTTPS requis pour l'installation PWA) + aperçu en artifact Claude (sans hors ligne).
- Mode dégradé : pas de voix → texte seul ; pas de stockage → partie jouable, avertissement parent ; hors ligne → Service Worker cache-first.

## Tests (obligatoires avant mise en ligne)
- `node tests/core.test.js` : logique (ponts exacts pour les 21 faits, distracteurs, planificateur, stockage corrompu).
- `python3 tests/e2e.py` : parcours complet Playwright (mobile Android), limites, accessibilité axe-core, poids.

## Revue critique (08/11/2026) — traité
Minuteurs et voix coupés à la pause ; verrou anti-tap 400 ms ; pavé validé par ✓ ; Leitner fiabilisé (cf. ci-dessus) ;
cache hors ligne versionné + stale-while-revalidate (changer `CACHE` dans sw.js à chaque livraison) ; mention de
confidentialité exacte (IP vue par l'hébergeur) ; voix locale privilégiée ; mise en page 360×640 ; bouton retour Android = pause ;
données trafiquées filtrées ; changement d'heure ; reprises sans pastille supplémentaire.
Restant (v2) : porte parent franchissable par un enfant qui lit la consigne (« Tout effacer » reste confirmé) ;
migration de schéma v1→v2 ; pont ×8 alternatif (10× − 2×) ; vitrine de trésors par monde.
