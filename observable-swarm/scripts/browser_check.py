"""Browser acceptance checks. Uses installed Playwright and system Chromium.
All page requests stay on localhost. No model or external service is needed.
"""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
server = subprocess.Popen(['node', 'scripts/serve.mjs'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(50):
        try:
            urllib.request.urlopen('http://127.0.0.1:4173/', timeout=1)
            break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Static file server did not start')
    with sync_playwright() as p:
        executable=os.environ.get('BROWSER_EXECUTABLE')
        if not executable and Path('/usr/bin/chromium').exists():
            executable='/usr/bin/chromium'
        browser = p.chromium.launch(executable_path=executable, headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:4173/') else route.abort())
        page.goto('http://127.0.0.1:4173/')
        page.wait_for_function('window.synthia && window.synthia.state')
        assert page.locator('#metrics').inner_text().startswith('96 particles')
        page.locator('#step').click()
        page.wait_for_function('window.synthia.state.tick === 1')
        page.locator('#run').click()
        page.wait_for_function('window.synthia.state.tick >= 3')
        page.locator('#pause').click()
        page.evaluate('async () => { await window.synthia.pause(); for(let i=0;i<80;i++) await window.synthia.step(); }')
        assert page.evaluate('window.synthia.state.formations.length') > 0
        page.locator('#selection').select_option('p006')
        before = page.evaluate('window.synthia.state.particles[5].gate')
        page.locator('#line').select_option('1')
        page.locator('#transition').click()
        page.wait_for_function(f'window.synthia.state.particles[5].gate !== {before}')
        assert page.evaluate('window.synthia.state.particles[5].id') == 'p006'
        page.locator('#compare').click()
        page.wait_for_function('document.querySelector("#comparison-result").textContent.includes("comparison recorded")')
        page.locator('#save').click()
        page.wait_for_function('document.querySelector("#status").textContent.includes("Saved locally")')
        saved_tick = page.evaluate('window.synthia.state.tick')
        page.locator('#step').click()
        page.locator('#restore').click()
        page.wait_for_function(f'window.synthia.state.tick === {saved_tick}')
        page.locator('#replay').click()
        page.wait_for_function('document.querySelector("#status").textContent.includes("Replay verified")')
        with page.expect_download() as download_info:
            page.locator('#export').click()
        download = download_info.value
        exported = json.loads(Path(download.path()).read_text())
        assert exported['version'] == 1 and exported['relations']
        page.locator('#display').select_option('structure')
        page.locator('#view').select_option('Evolution')
        page.locator('#stimulate').click()
        page.wait_for_function('window.synthia.state.particles.find(p=>p.id===document.querySelector("#selection").value).frames.Evolution.activation === 1')
        page.locator('#expression').fill('i am Conflict')
        page.locator('#expression-frame').select_option('Being')
        page.locator('#expression-form button').click()
        page.wait_for_function('document.querySelector("#direction-status").textContent.includes("First capital: C")')
        page.locator('#display').select_option('scene')
        page.screenshot(path=str(ROOT / 'docs/observatory-desktop.png'), full_page=True)
        canvas = page.locator('#field')
        canvas.hover()
        page.mouse.wheel(0,-1200)
        page.screenshot(path=str(ROOT / 'docs/observatory-detail.png'), full_page=True)
        context.set_offline(True)
        old_tick = page.evaluate('window.synthia.state.tick')
        page.locator('#step').click()
        page.wait_for_function(f'window.synthia.state.tick === {old_tick + 1}')
        context.set_offline(False)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('#fit').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(ROOT / 'docs/observatory-mobile.png'), full_page=True)
        assert not errors, errors
        print(json.dumps({'browser':browser.version, 'checks':'transport, identity, comparisons, save/restore, replay, export, dimensional stimulus, case-preserved expression, zoom, offline worker, mobile overflow', 'page_errors':errors}))
        browser.close()
finally:
    server.terminate()
    try:
        server.wait(timeout=3)
    except subprocess.TimeoutExpired:
        server.kill()
