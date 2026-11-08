# Tables Magiques

Jeu pour apprendre les tables de multiplication en partant de ce qu'on sait déjà (×1, ×2, ×5, ×10).
Il ne reste que 21 résultats à découvrir, chacun relié à une table connue par un « pont » imagé.

- Parties de 3 minutes environ, 3 mini-jeux (Rectangle, Bulles, Pavé), voix, gros chiffres.
- Œufs magiques puis trésors à collectionner ; répétition espacée automatique.
- Espace parent (appui maintenu 3 s) : grille 10×10 de ce qui est su.
- Aucun compte, aucune publicité, aucune donnée envoyée. Fonctionne hors ligne une fois installée.

## Installer sur la tablette Android (GitHub Pages)
1. Créer un dépôt public sur GitHub (ex. `tables-magiques`) et y déposer le contenu de ce dossier.
2. Settings → Pages → Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Sur la tablette, ouvrir `https://<ton-compte>.github.io/tables-magiques/` dans Chrome.
4. Menu ⋮ → « Ajouter à l'écran d'accueil » / « Installer l'application ».

## Tests
```
node tests/core.test.js
python3 tests/e2e.py chemin/vers/axe.min.js   # Playwright + Chrome
```
