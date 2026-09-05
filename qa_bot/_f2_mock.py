"""Deterministic mock probe: a tiny local HTTP server streams canned SSE
responses to the app's /chat/completions call, so we can test the F2 reasoning
UI and the F3 staging pipeline without model latency or output variance.

Scenario A: model streams reasoning_content, then a FENCED ```json action block.
Scenario B: model streams reasoning_content, then an UNFENCED JSON array inline
            in prose (the format drift that previously defeated the parser).

Run: .venv/Scripts/python.exe qa_bot/_f2_mock.py
"""
import http.server
import json
import os
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = "http://localhost:5173/Aethermind/"
OUT = Path(__file__).resolve().parent / "artifacts" / "f2_mock.json"
SHOTS = Path(__file__).resolve().parent / "screenshots"
MOCK_PORT = 8999
MOCK_CHUNKS: list[str] = []
# Delay (s) before the first SSE chunk so UI tests can capture the
# "waiting for model…" phase before any token arrives.
MOCK_START_DELAY = 0.0
# "chromium" means the bundled browser (CI has no Edge); any other value is
# passed through as a Playwright channel name (e.g. "msedge", "chrome").
BROWSER_CHANNEL = os.environ.get("AM_BROWSER_CHANNEL", "msedge")
LAUNCH_CHANNEL = None if BROWSER_CHANNEL == "chromium" else BROWSER_CHANNEL

CFG_JS = """(() => {
  const keys = {
    aiProvider: 'custom',
    aiBaseUrl: 'http://127.0.0.1:8999/v1',
    aiModel: 'mock-model',
    aiClientSpoof: 'none',
  };
  for (const [k, v] of Object.entries(keys)) localStorage.setItem(k, v);
})()"""

IDB_JS = """async (title) => {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('aether_mind_db');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const st = db.transaction('notes').objectStore('notes');
    const all = await new Promise((res) => { const g = st.getAll(); g.onsuccess = () => res(g.result); g.onerror = () => res([]); });
    db.close();
    return all.map(n => n.title).filter(t => t.toLowerCase().includes(title.toLowerCase()));
  } catch (e) { return ['ERR:' + String(e).slice(0, 80)]; }
}"""

SNAPSHOT_JS = """() => {
  const pill = document.querySelector('[role="status"]');
  const hdr = [...document.querySelectorAll('span')].find(s => (s.textContent || '').includes('Model reasoning'));
  const headerBox = hdr ? hdr.parentElement : null;
  const box = headerBox ? headerBox.parentElement : null;
  const body = box ? box.lastElementChild : null;
  const md = document.querySelector('.markdown-body');
  const text = document.body ? document.body.innerText : '';
  return {
    pill: pill ? pill.textContent.trim() : null,
    reasoningLen: body ? body.textContent.length : 0,
    reasoningHead: body ? body.textContent.slice(0, 140).replace(/\\s+/g, ' ') : null,
    mdLen: md ? md.innerText.length : -1,
    hasMutations: text.toLowerCase().includes('proposed graph mutations'),
    bodyTail: text.slice(-160).replace(/\\s+/g, ' '),
    loading: text.includes('Streaming AI response') || text.includes('Thinking\\u2026'),
  };
}"""


def sse_chunk(delta=None, reasoning=None):
    d = {}
    if delta is not None:
        d["content"] = delta
    if reasoning is not None:
        d["reasoning_content"] = reasoning
    obj = {"choices": [{"index": 0, "delta": d, "finish_reason": None}]}
    return "data: " + json.dumps(obj) + "\n\n"


def finish():
    return "data: [DONE]\n\n"


def scenario_a():
    """reasoning + fenced json action block."""
    json_block = (
        'Here is the created note:\n\n```json\n'
        '[{ "action": "create_note", "title": "Mock Milestone A", '
        '"content": "# Mock Milestone A\\n\\nCreated during deterministic mock testing.", "tags": ["mock"] }]\n'
        '```\n\nI have created the note **Mock Milestone A** for you.'
    )
    reasoning = "Let me plan the note structure and its content."
    cuts = [12, 28, 40, 90, 150, 220]
    prev = 0
    chunks = []
    for i in range(3):
        prev2 = cuts[i] if i < len(cuts) else len(reasoning)
        chunks.append(sse_chunk(reasoning=reasoning[prev:prev2]))
        prev = prev2
    prev = 0
    for c in cuts:
        chunks.append(sse_chunk(delta=json_block[prev:c]))
        prev = c
    chunks.append(sse_chunk(delta=json_block[prev:]))
    chunks.append(finish())
    return chunks


def scenario_b():
    """reasoning + json array embedded in prose WITHOUT fences."""
    prose = (
        'Sure! Here is the action payload: '
        '[ { "action": "create_note", "title": "Mock Milestone B", '
        '"content": "Body B from unfenced JSON.", "tags": ["mock"] } ] '
        'and I have created that note for you.'
    )
    reasoning = "The user wants a new note, so I should emit an action block."
    chunks = []
    chunks.append(sse_chunk(reasoning=reasoning[:18]))
    chunks.append(sse_chunk(reasoning=reasoning[18:40]))
    chunks.append(sse_chunk(reasoning=reasoning[40:]))
    prev = 0
    for c in [45, 110, 170, 240]:
        chunks.append(sse_chunk(delta=prose[prev:c]))
        prev = c
    chunks.append(sse_chunk(delta=prose[prev:]))
    chunks.append(finish())
    return chunks


def scenario_d():
    """Editor Auto-Tag: reasoning + strict tags/links JSON (may be buried in prose)."""
    payload = ('Here you go: { "tags": ["qa", "local-first"], "links": ["Interactive Graph"] } ')
    reasoning = "I will analyze the note and pick tags and links."
    chunks = []
    cuts = [15, 34]
    prev = 0
    for c in cuts:
        chunks.append(sse_chunk(reasoning=reasoning[prev:c]))
        prev = c
    chunks.append(sse_chunk(reasoning=reasoning[prev:]))
    prev = 0
    for c in [40, 90]:
        chunks.append(sse_chunk(delta=payload[prev:c]))
        prev = c
    chunks.append(sse_chunk(delta=payload[prev:]))
    chunks.append(finish())
    return chunks


def scenario_c():
    """PURE fenced JSON with NO explanation prose (whole-body action payload)."""
    payload = (
        '```json\n'
        '[{ "action": "create_note", "title": "Mock Milestone C", '
        '"content": "Body C pure json.", "tags": ["mock"] }]\n'
        '```'
    )
    chunks = []
    prev = 0
    for c in [30, 70, 120]:
        chunks.append(sse_chunk(delta=payload[prev:c]))
        prev = c
    chunks.append(sse_chunk(delta=payload[prev:]))
    chunks.append(finish())
    return chunks


class SSEHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        self.rfile.read(length)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        if MOCK_START_DELAY > 0:
            time.sleep(MOCK_START_DELAY)
        for chunk in MOCK_CHUNKS:
            try:
                self.wfile.write(chunk.encode("utf-8"))
                self.wfile.flush()
            except Exception:
                break
            time.sleep(0.06)

    def log_message(self, *a):
        pass


def run_scenario(name, chunks, start_delay=0.0):
    global MOCK_CHUNKS, MOCK_START_DELAY
    MOCK_CHUNKS = chunks
    MOCK_START_DELAY = start_delay
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", MOCK_PORT), SSEHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    out = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel=LAUNCH_CHANNEL, headless=True)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
            ctx.add_init_script(CFG_JS)
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.on("console", lambda m: errs.append(f"{m.type}:{m.text[:150]}") if m.type == "error" else None)
            page.goto(APP, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3500)

            # open Ask AI
            inp = None
            for _ in range(3):
                for _ in range(2):
                    page.keyboard.press("Escape")
                page.wait_for_timeout(400)
                try:
                    btn = page.get_by_role("button", name="Ask AI copilot").first
                    if btn.count() and btn.is_visible():
                        btn.click(timeout=4000)
                except Exception:
                    pass
                page.wait_for_timeout(1000)
                inp = page.locator("input[placeholder*='explore']").last
                if inp.count() and inp.is_visible():
                    break
            assert inp.count(), "Ask AI input not reachable"
            inp.click(timeout=3000)
            page.keyboard.press("Control+a")
            page.keyboard.insert_text("Create a note titled Mock Milestone (mock test).")
            page.keyboard.press("Enter")

            t0 = time.time()
            reasoning_seen = None
            reasoning_text = None
            md_first = None
            snap = {}
            while time.time() - t0 < 30:
                snap = page.evaluate(SNAPSHOT_JS)
                if reasoning_seen is None and snap.get("pill") and "Thinking" in snap["pill"]:
                    reasoning_seen = round(time.time() - t0, 1)
                if reasoning_seen and reasoning_text is None and snap.get("reasoningLen", 0) > 0:
                    reasoning_text = snap.get("reasoningHead")
                    page.screenshot(path=str(SHOTS / f"f2mock-{name}-reasoning.png"))
                if md_first is None and snap.get("mdLen", -1) > 0:
                    md_first = round(time.time() - t0, 1)
                if snap.get("hasMutations"):
                    break
                if reasoning_seen and not snap.get("loading") and time.time() - t0 > 3:
                    break
                page.wait_for_timeout(700)

            applied = False
            if snap.get("hasMutations"):
                page.screenshot(path=str(SHOTS / f"f2mock-{name}-staged.png"))
                page.locator("button", has_text="Apply").last.click(timeout=4000)
                applied = True
            titles = []
            for _ in range(10):
                time.sleep(1)
                titles = page.evaluate(IDB_JS, f"Mock Milestone {name}")
                if titles:
                    break
            page.screenshot(path=str(SHOTS / f"f2mock-{name}-final.png"))
            out = {
                "t_thinking_pill_s": reasoning_seen,
                "t_reasoning_first_s": reasoning_text,
                "reasoning_head": reasoning_text,
                "t_md_first_s": md_first,
                "staged_card": snap.get("hasMutations"),
                "apply_clicked": applied,
                "note_found": bool(titles),
                "titles": titles,
                "bodyTail": snap.get("bodyTail"),
                "errors": errs[:10],
            }
            browser.close()
    finally:
        srv.shutdown()
    print(name, json.dumps(out, indent=1), flush=True)
    return out


EDITOR_SNAP = """() => {
  const text = document.body ? document.body.innerText : '';
  const tags = document.querySelector('input.meta-input');
  return {
    body: text,
    stripVisible: text.includes('Auto-tagging & suggesting links'),
    waiting: text.includes('waiting for model'),
    reasoningChars: /\\d+ reasoning chars/.test(text),
    tagsValue: tags ? tags.value : null,
  };
}"""


def run_editor_scenario():
    """Editor Auto-Tag: assert the live progress strip shows 'waiting for
    model…' BEFORE any token, then live reasoning, then the tags land."""
    import bot  # qa_bot helpers (palette_open_note etc.)
    global MOCK_CHUNKS, MOCK_START_DELAY
    MOCK_CHUNKS = scenario_d()
    MOCK_START_DELAY = 1.6  # leave a window to observe the "waiting for model…" phase
    out = {}
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", MOCK_PORT), SSEHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel=LAUNCH_CHANNEL, headless=True)
            ctx = browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
            ctx.add_init_script(CFG_JS)
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.on("console", lambda m: errs.append(f"{m.type}:{m.text[:150]}") if m.type == "error" else None)
            page.goto(APP, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3500)

            # open a demo note through the palette
            opened = bot.palette_open_note(page, "Welcome to AetherMind")
            if not opened:
                raise AssertionError("palette_open_note failed")
            page.wait_for_timeout(1200)

            # click Auto-Tag
            at = page.locator("button[aria-label='Auto-Tag with AI'], button[aria-label*='Auto-Tag']")
            if not at.count():
                at = page.locator("button.icon-btn", has_text="Auto-Tag").first
            at.first.evaluate("el => el.click()")

            t0 = time.time()
            waiting_seen = reasoning_seen = applied = False
            while time.time() - t0 < 30:
                s = page.evaluate(EDITOR_SNAP)
                if not waiting_seen and s["stripVisible"] and s["waiting"]:
                    waiting_seen = True
                    page.screenshot(path=str(SHOTS / "f2mock-D-editor-waiting.png"))
                if not reasoning_seen and s["stripVisible"] and s["reasoningChars"]:
                    reasoning_seen = True
                    page.screenshot(path=str(SHOTS / "f2mock-D-editor-reasoning.png"))
                if s["tagsValue"] and "qa" in s["tagsValue"]:
                    applied = True
                    page.screenshot(path=str(SHOTS / "f2mock-D-editor-applied.png"))
                    break
                page.wait_for_timeout(600)

            out = {
                "waiting_phase_seen": waiting_seen,
                "reasoning_phase_seen": reasoning_seen,
                "tags_applied": applied,
                "tagsValue": page.evaluate(EDITOR_SNAP)["tagsValue"],
                "errors": errs[:10],
            }
            browser.close()
    finally:
        srv.shutdown()
    print("D-editor", json.dumps(out, indent=1), flush=True)
    return out


def main():
    out = {
        "scenario_a": run_scenario("A", scenario_a()),
        "scenario_b": run_scenario("B", scenario_b()),
        "scenario_c": run_scenario("C", scenario_c()),
        "scenario_d_editor": run_editor_scenario(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")

    ok = True
    for name, r in out.items():
        if name == "scenario_d_editor":
            ok = ok and bool(r.get("waiting_phase_seen") and r.get("reasoning_phase_seen") and r.get("tags_applied"))
        else:
            ok = ok and bool(r.get("staged_card") and r.get("apply_clicked") and r.get("note_found"))
    print("\nALL SCENARIOS", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
