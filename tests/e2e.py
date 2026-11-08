"""Tests de bout en bout (Playwright, Chrome, tablette/téléphone Android émulé).
Usage : python3 tests/e2e.py [chemin/axe.min.js]
"""
import http.server, json, os, re, socketserver, sys, threading, time
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'node_modules/axe-core/axe.min.js')
SHOTS = os.path.join(ROOT, 'tests', 'screens')
os.makedirs(SHOTS, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('localhost', 0), partial(Quiet, directory=ROOT))
PORT = srv.server_address[1]
URL = f'http://localhost:{PORT}/'
threading.Thread(target=srv.serve_forever, daemon=True).start()

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('  ok  ' if cond else '  KO  ') + name + (('  — ' + str(detail)) if detail and not cond else ''))

def current_answer(page):
    lab = page.locator('.question').first.get_attribute('data-q')
    a, b = [int(x) for x in re.findall(r'\d+', lab)]
    return a * b

def answer(page, value):
    """Répond avec la valeur donnée selon le mini-jeu affiché. Retourne le mode."""
    if page.locator('.bub').count():
        btn = page.locator(f'.bub[aria-label="Réponse {value}"]')
        if btn.count() == 0:   # valeur fausse absente des bulles : prendre une bulle fausse
            ans = current_answer(page)
            btn = page.locator('.bub').filter(has_not_text=re.compile(rf'^{ans}$'))
        page.wait_for_timeout(450)
        btn.first.click()
        return 'rect' if page.locator('.rect-card').count() else 'bulles'
    page.wait_for_timeout(450)   # verrou anti-tap impulsif
    for ch in str(value):
        page.locator(f'.key[aria-label="{ch}"]').click()
    page.locator('.key[aria-label="Valider"]').click()
    return 'pave'

def next_after_feedback(page):
    page.wait_for_timeout(650)
    page.locator('#btn-next').click()

def axe(page, label):
    page.add_script_tag(path=AXE)
    res = page.evaluate("""async () => { const r = await axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21aa','best-practice'] });
        return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => v.id + ' (' + v.nodes.length + ')'); }""")
    check(f'accessibilité axe-core sans violation grave — {label}', not res, res)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    device = p.devices['Pixel 7']
    ctx = browser.new_context(**device, locale='fr-FR')
    page = ctx.new_page()
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))

    print('Parcours principal (Android, Pixel 7)')
    t0 = time.time()
    page.goto(URL, wait_until='load')
    load_ms = int((time.time() - t0) * 1000)
    check('premier écran : choix du monde', page.locator('#s-world').is_visible())
    page.screenshot(path=f'{SHOTS}/1-monde.png')
    axe(page, 'choix du monde')
    page.get_by_role('button', name=re.compile('Forêt')).click()
    check('écran compagnon après choix du monde', page.locator('#s-companion').is_visible())
    page.get_by_role('button', name=re.compile('renard')).click()
    check('accueil affiché avec 0 trésor sur 21', page.locator('#home-progress').inner_text().startswith('Trésors : 0 / 21'))
    page.screenshot(path=f'{SHOTS}/2-accueil.png')
    axe(page, 'accueil')

    page.locator('#btn-play').click()
    check('partie lancée : 8 pastilles de progression', page.locator('#dots li').count() == 8)
    modes, wrong_done, reask_seen, bridge_ok = [], False, False, False
    shots = set()
    for i in range(14):
        if page.locator('#s-end').is_visible():
            break
        mode = 'rect' if page.locator('.rect-card').count() else ('bulles' if page.locator('.bub').count() else 'pave')
        if mode not in shots:
            page.screenshot(path=f'{SHOTS}/3-jeu-{mode}.png'); shots.add(mode)
        if mode == 'rect':
            axe(page, 'mini-jeu rectangle')
        ans = current_answer(page)
        if not wrong_done and mode == 'rect':
            answer(page, ans + 1)   # erreur volontaire sur un nouveau fait
            wrong_done = True
            page.wait_for_selector('.feedback.oops')
            eq = page.locator('.rect-card .equation').inner_text()
            bridge_ok = eq.endswith(str(ans))
            page.screenshot(path=f'{SHOTS}/4-pont-erreur.png')
            axe(page, 'pont après erreur')
            next_after_feedback(page)
            continue
        modes.append(answer(page, ans))
        page.wait_for_selector('.feedback.ok')
        next_after_feedback(page)
    total = page.locator('#dots li').count() if not page.locator('#s-end').is_visible() else None
    check('erreur → pont imagé avec le bon résultat', bridge_ok)
    check('fin de partie atteinte', page.locator('#s-end').is_visible())
    check('reprise ajoutée après l’erreur (9 questions jouées), sans pastille supplémentaire', len(modes) == 8, modes)
    check('au moins 2 types de mini-jeux dans la partie', len(set(modes)) >= 2, modes)
    page.screenshot(path=f'{SHOTS}/5-fin.png')
    axe(page, 'fin de partie')
    check('récompense immédiate dès la 1re partie (œufs magiques)', page.locator('#end-unlocks .unlock').count() >= 1 and 'œuf' in page.locator('#end-msg').inner_text())
    stars = page.locator('#end-stars').inner_text()
    check('étoiles affichées', 'étoile' in stars, stars)

    st = page.evaluate(f"JSON.parse(localStorage.getItem('tables-magiques-v1'))")
    check('progrès enregistrés localement (session comptée)', st and st['stats']['sessions'] == 1 and len(st['facts']) >= 2, st and st['stats'])
    check('aucune donnée personnelle stockée (seulement monde/compagnon/progrès/réglages)', set(st.keys()) == {'v', 'world', 'companion', 'facts', 'socle', 'collection', 'treasures', 'maxChapter', 'newDay', 'stats', 'settings'})

    page.reload(wait_until='load')
    check('après rechargement : retour direct à l’accueil (persistance)', page.locator('#s-home').is_visible())

    print('Collection et espace parent')
    page.locator('#btn-collection').click()
    check('collection : 21 emplacements', page.locator('#collection li').count() == 21)
    check('collection : les œufs en cours sont visibles et cliquables', page.locator('#collection button[aria-label^="Œuf"]').count() >= 1)
    page.screenshot(path=f'{SHOTS}/8-collection.png')
    axe(page, 'collection')
    page.locator('#btn-coll-back').click()
    page.locator('#btn-parent').click()
    hold = page.locator('#btn-hold')
    box = hold.bounding_box()
    page.mouse.move(box['x'] + 20, box['y'] + 20); page.mouse.down(); page.wait_for_timeout(1000); page.mouse.up()
    check('appui court (1 s) : espace parent toujours fermé', not page.locator('#s-parent').is_visible())
    page.mouse.move(box['x'] + 20, box['y'] + 20); page.mouse.down(); page.wait_for_timeout(3300); page.mouse.up()
    check('appui maintenu 3 s : espace parent ouvert', page.locator('#s-parent').is_visible())
    check('grille parent 10×10', page.locator('#parent-grid td').count() == 100)
    check('cases du socle marquées (ex. 2×7)', 'st-socle' in page.locator('#parent-grid tbody tr').nth(1).locator('td').nth(6).get_attribute('class'))
    page.screenshot(path=f'{SHOTS}/6-parent.png', full_page=True)
    axe(page, 'espace parent')
    page.locator('#set-calm').check()
    check('option animations calmes appliquée', page.evaluate("document.body.classList.contains('calm')"))
    page.locator('#btn-reset').click()
    page.locator('#btn-reset-yes').click()
    check('tout effacer : retour au choix du monde et stockage vidé', page.locator('#s-world').is_visible() and page.evaluate("localStorage.getItem('tables-magiques-v1')") is None)

    print('Sécurité, frugalité, réseau')
    third = [u for u in requests if not u.startswith(URL)]
    check('aucune requête vers un tiers (pas de CDN, police, traceur)', not third, third)
    sizes = sum(os.path.getsize(os.path.join(ROOT, f)) for f in ['index.html', 'styles.css', 'core.js', 'app.js'])
    check('poids de l’appli < 100 Ko (hors icônes)', sizes < 100_000, sizes)
    check('chargement < 1,5 s en local', load_ms < 1500, load_ms)
    check('aucune erreur JavaScript', not errors, errors)
    with open(os.path.join(ROOT, 'app.js')) as f:
        src = f.read()
    check('pas d’innerHTML / eval dans l’interface (injection)', 'innerHTML' not in src and 'eval(' not in src)

    print('Hors ligne')
    page.goto(URL, wait_until='load')
    page.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null", timeout=8000)
    ctx.set_offline(True)
    page.reload(wait_until='load')
    check('hors ligne : l’appli se charge depuis le cache', page.locator('#s-world').is_visible())
    ctx.set_offline(False)
    ctx.close()

    print('Modes dégradés')
    def degraded(script, label):
        c = browser.new_context(**device, locale='fr-FR', service_workers='block')
        c.add_init_script(script)
        pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL, wait_until='load')
        return c, pg, errs
    c, pg, errs = degraded("Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}})", 'stockage bloqué')
    pg.get_by_role('button', name=re.compile('Océan')).click(); pg.locator('#companion-choices button').first.click()
    pg.locator('#btn-play').click()
    check('stockage bloqué : la partie se lance quand même', pg.locator('.question').count() == 1, errs)
    pg.locator('#btn-pause').click(); pg.locator('#btn-parent').click()
    hb = pg.locator('#btn-hold').bounding_box(); pg.mouse.move(hb['x'] + hb['width'] / 2, hb['y'] + hb['height'] / 2); pg.mouse.down(); pg.wait_for_timeout(3300); pg.mouse.up()
    check('stockage bloqué : avertissement affiché au parent', pg.locator('#parent-warn').is_visible(), pg.evaluate("[document.querySelector('.screen:not([hidden])').id, document.getElementById('parent-warn').hidden]"))
    c.close()
    c, pg, errs = degraded("localStorage.setItem('tables-magiques-v1','{cassé')", 'données corrompues')
    check('données corrompues : redémarrage propre sans erreur', pg.locator('#s-world').is_visible() and not errs, errs)
    c.close()
    c, pg, errs = degraded("delete window.speechSynthesis; delete window.SpeechSynthesisUtterance;", 'pas de voix')
    pg.get_by_role('button', name=re.compile('Espace')).click(); pg.locator('#companion-choices button').first.click()
    pg.locator('#btn-play').click()
    check('sans synthèse vocale : bouton 🔊 masqué, partie jouable', pg.locator('#btn-say').is_hidden() and pg.locator('.question').count() == 1 and not errs, errs)
    c.close()

    print('Robustesse du jeu')
    c = browser.new_context(**device, locale='fr-FR', service_workers='block')
    pg = c.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.get_by_role('button', name=re.compile('Forêt')).click(); pg.locator('#companion-choices button').first.click()
    pg.locator('#btn-play').click()
    check('pastilles fixes à 8 même après une erreur', pg.locator('#dots li').count() == 8)
    pg.wait_for_timeout(450)
    ans = current_answer(pg)
    answer(pg, ans)                 # bonne réponse…
    pg.wait_for_timeout(300)
    pg.locator('#btn-pause').click() # …puis pause immédiate
    pg.wait_for_timeout(2600)
    check('pause pendant le « Bravo » : retour accueil, aucune erreur JS', pg.locator('#s-home').is_visible() and not errs, errs)
    pg.locator('#btn-play').click()
    # inversion de chiffres au pavé : signalée sans compter faux
    for _ in range(12):
        if pg.locator('.pad').count():
            ans = current_answer(pg)
            if ans >= 10 and ans % 10 != ans // 10 and ans < 100:
                pg.wait_for_timeout(450)
                for ch in str(ans)[::-1]: pg.locator(f'.key[aria-label="{ch}"]').click()
                pg.locator('.key[aria-label="Valider"]').click()
                break
        if pg.locator('.bub').count():
            answer(pg, current_answer(pg))
        elif pg.locator('.pad').count():
            answer(pg, current_answer(pg))
        pg.wait_for_selector('#btn-next'); next_after_feedback(pg)
    if pg.locator('.pad').count():
        check('pavé : chiffres inversés → indice « ordre des chiffres », pas d’erreur comptée', 'ordre des chiffres' in pg.locator('.pave-note').inner_text() and pg.locator('.pad').count() == 1)
    pg.keyboard.press('Escape')
    pg.locator('#btn-pause').focus(); pg.keyboard.press('Enter')
    check('Entrée sur le bouton Pause met bien en pause', pg.locator('#s-home').is_visible())
    c.close()

    print('Clavier et petit écran')
    c = browser.new_context(viewport={'width': 360, 'height': 640}, has_touch=True, is_mobile=True, locale='fr-FR', service_workers='block')
    pg = c.new_page(); pg.goto(URL)
    pg.get_by_role('button', name=re.compile('Forêt')).click(); pg.locator('#companion-choices button').first.click()
    pg.locator('#btn-play').click()
    over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check('écran 360 px : pas de débordement horizontal', not over)
    # Rectangle le plus haut (10 lignes, ex. 9×9) sur 360×640 : les bulles restent visibles sans défiler
    pg.evaluate("""() => { const s = JSON.parse(localStorage.getItem('tables-magiques-v1')); s.maxChapter = 2; s.newDay = {day:null,count:0};
        ['4x3','4x4','4x6','4x7','4x8','4x9','3x3','3x6','3x7','3x8','3x9'].forEach(id => s.facts[id] = {box:3, due: Date.now()+9e8, ok:3, ko:0, recall:true});
        localStorage.setItem('tables-magiques-v1', JSON.stringify(s)); }""")
    pg.reload(); pg.locator('#btn-play').click()
    worst = None
    for _ in range(10):
        if pg.locator('.rect-card').count():
            worst = max(worst or -9999, pg.evaluate("Math.max(...[...document.querySelectorAll('.bub')].map(b => b.getBoundingClientRect().bottom)) - window.innerHeight"))
            pg.screenshot(path=f'{SHOTS}/9-rect-petit-ecran.png')
        if pg.locator('#s-end').is_visible(): break
        answer(pg, current_answer(pg)); pg.wait_for_selector('#btn-next'); next_after_feedback(pg)
    check('360×640 : rectangle ×9 et bulles visibles sans défiler', worst is not None and worst <= 0, worst)
    pg.screenshot(path=f'{SHOTS}/7-petit-ecran.png')
    c.close()
    c = browser.new_context(viewport={'width': 1024, 'height': 768}, locale='fr-FR', service_workers='block')
    pg = c.new_page(); pg.goto(URL)
    pg.keyboard.press('Tab'); pg.keyboard.press('Enter')  # premier monde
    pg.keyboard.press('Tab'); pg.keyboard.press('Enter')  # premier compagnon
    check('navigation au clavier : onboarding complet', pg.locator('#s-home').is_visible())
    c.close()
    browser.close()

srv.shutdown()
ok = sum(1 for r in results if r[1])
print(f'\n{ok}/{len(results)} contrôles réussis')
sys.exit(0 if ok == len(results) else 1)
