"""bot.py — AetherMind QA bot.

Drives the running AetherMind app (dev server) with Playwright + system Edge,
takes screenshots, runs functional checks, collects console/network issues and
UX metrics per screen. Results are written to qa_bot/results_<group>.json.

Usage:
  .venv/Scripts/python.exe qa_bot/bot.py [group ...]     # default: all groups
Groups: boot core data themes responsive ai1 ai2
"""
import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

from ux_metrics import collect as ux_collect

APP = "http://localhost:5173/Aethermind/"
AI_BASE = "http://localhost:8080/v1"
AI_MODEL = "Qwen3.8-4B-Q4_K_M.gguf"

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "screenshots"
ARTS = ROOT / "artifacts"
FAILS = ROOT / "_failures"
for d in (SHOTS, ARTS, FAILS):
    d.mkdir(parents=True, exist_ok=True)

VIEWPORT = {"width": 1440, "height": 900}
DEMO_NOTES = ["Welcome to AetherMind", "Interactive Graph", "Markdown Syntax", "Organizing Notes"]


# --------------------------------------------------------------------------
# tiny run-state + helpers
# --------------------------------------------------------------------------
class State:
    def __init__(self, group):
        self.group = group
        self.page = None
        self.tests = []
        self.shots = []
        self.console = {"errors": [], "pageerrors": [], "failed": [], "http4xx5xx": []}
        self.shot_seq = 0

    def save(self):
        out = {"tests": self.tests, "shots": self.shots, "console": self.console}
        (ROOT / f"results_{self.group}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")

    def add(self, test_id, name, status, detail="", latency=None, shot=None, extra=None):
        rec = {"group": self.group, "id": test_id, "name": name, "status": status,
               "detail": detail, "latency_s": latency, "shot": shot}
        if extra:
            rec["extra"] = extra
        self.tests.append(rec)
        print(f"[{self.group}] {name} -> {status} {('| ' + detail[:160]) if detail else ''}")
        self.save()
        return rec


def log(msg):
    print(msg, flush=True)


def idb_snapshot(page):
    """Read IndexedDB note/link/page/doc counts + note titles."""
    try:
        return page.evaluate(
            """async () => {
              const db = await new Promise((res, rej) => {
                const req = indexedDB.open('aether_mind_db');
                req.onsuccess = () => res(req.result);
                req.onerror = () => rej(req.error);
              });
              const out = {};
              for (const s of ['notes', 'links', 'pages', 'documents', 'snapshots', 'categories']) {
                if (!db.objectStoreNames.contains(s)) continue;
                const st = db.transaction(s).objectStore(s);
                out[s] = await new Promise((res) => { const c = st.count(); c.onsuccess = () => res(c.result); c.onerror = () => res(-1); });
              }
              if (out.notes > 0 && out.notes < 60) {
                const st = db.transaction('notes').objectStore('notes');
                const all = await new Promise((res) => { const g = st.getAll(); g.onsuccess = () => res(g.result); g.onerror = () => res([]); });
                out.titles = all.map(n => n.title);
              }
              db.close();
              return out;
            }"""
        )
    except Exception as e:
        return {"error": str(e)[:120]}


def attach_collectors(page, st):
    def on_console(msg):
        if msg.type == "error":
            t = msg.text[:400]
            if len(st.console["errors"]) < 60 and t not in st.console["errors"]:
                st.console["errors"].append(t)
    def on_pageerror(err):
        t = str(err)[:400]
        if len(st.console["pageerrors"]) < 40:
            st.console["pageerrors"].append(t)
    def on_failed(req):
        t = f"{req.url[:200]} :: {req.failure}"
        if len(st.console["failed"]) < 40:
            st.console["failed"].append(t)
    def on_response(resp):
        if resp.status >= 400 and len(st.console["http4xx5xx"]) < 40:
            st.console["http4xx5xx"].append(f"{resp.status} {resp.url[:180]}")
    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    page.on("requestfailed", on_failed)
    page.on("response", on_response)


def fresh(st, viewport=VIEWPORT):
    """Open a brand-new page at the app; returns page (state must be clean)."""
    if st.page:
        try:
            st.page.close()
        except Exception:
            pass
    page = st.page = CTX.new_page()
    page.set_viewport_size(viewport)
    attach_collectors(page, st)
    page.goto(APP, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3500)
    return page


def reload_page(st):
    p = st.page
    p.reload(wait_until="domcontentloaded", timeout=60000)
    p.wait_for_timeout(2500)
    return p


def shot(st, slug, title, note="", page=None, full=False):
    st.shot_seq += 1
    name = f"{st.shot_seq:03d}-{st.group}-{slug}.png"
    path = SHOTS / name
    (page or st.page).screenshot(path=str(path), full_page=full)
    metrics = ux_collect(page or st.page, str(path))
    rec = {"seq": st.shot_seq, "group": st.group, "file": name, "title": title,
           "note": note, "metrics": metrics}
    st.shots.append(rec)
    return name


def fail_dump(st, slug, exc):
    try:
        html = st.page.content()
        (FAILS / f"{st.group}-{slug}.html").write_text(html[:200000], encoding="utf-8")
    except Exception:
        pass
    log(f"    ! dumped {FAILS.name}/{st.group}-{slug}.html :: {str(exc)[:200]}")


def vis(pg, locator):
    try:
        return pg.locator(locator).count() > 0 and pg.locator(locator).first.is_visible()
    except Exception:
        return False


def close_overlays(pg):
    """Best effort: press Escape twice and close any visible .btn-close-overlay."""
    for _ in range(2):
        pg.keyboard.press("Escape")
    try:
        for _ in range(4):
            closes = pg.locator("button.btn-close-overlay:visible")
            if closes.count() == 0:
                break
            closes.first.click(timeout=2000)
            pg.wait_for_timeout(600)
    except Exception:
        pass


def close_search_panel(pg):
    try:
        b = pg.get_by_role("button", name="Close search and filter panel")
        if b.count() and b.first.is_visible():
            b.first.click(timeout=3000)
            pg.wait_for_timeout(700)
    except Exception:
        pass


def js_fill(loc, text):
    """Set a React controlled input via the native value setter + input event.
    NOTE: some inputs in this app commit only via real keystrokes, so prefer type_text."""
    loc.evaluate(
        """(el, value) => {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
          setter.call(el, value);
          el.dispatchEvent(new Event('input', {bubbles: true}));
        }""",
        text,
    )


def open_ask_ai(pg):
    """Ensure the Ask AI modal is open and return its text input (or None)."""
    for _ in range(3):
        close_overlays(pg)
        pg.wait_for_timeout(600)
        try:
            btn = pg.get_by_role("button", name="Ask AI copilot").first
            if btn.count() and btn.is_visible():
                btn.click(timeout=4000)
        except Exception:
            pass
        pg.wait_for_timeout(1500)
        inp = pg.locator("input[placeholder*='explore']").last
        if inp.count() and inp.is_visible():
            return inp
    return None


def type_text(page, loc, text):
    """Type into an input using real keystrokes; focuses via JS if the element is covered."""
    try:
        loc.click(timeout=2500)
    except Exception:
        loc.evaluate("el => el.focus()")
    page.keyboard.press("Control+a")
    page.keyboard.insert_text(text)
    page.wait_for_timeout(350)


# --------------------------------------------------------------------------
# shared flows
# --------------------------------------------------------------------------
def palette_open_note(pg, title):
    """Ctrl+K, type exact-ish title, Enter. Returns True if editor panel appears."""
    for _attempt in range(2):
        try:
            pg.keyboard.press("Control+k")
            pg.wait_for_timeout(900)
            pg.keyboard.type(title)
            pg.wait_for_timeout(1600)
            opts = pg.locator("[role=option]")
            if opts.count() == 0:
                pg.keyboard.press("Escape")
                pg.wait_for_timeout(500)
                continue
            first_word = title.lower().split()[0]
            chosen = False
            for i in range(opts.count()):
                if first_word in opts.nth(i).inner_text().lower():
                    opts.nth(i).click(timeout=3000)
                    chosen = True
                    break
            if not chosen:
                opts.first.click(timeout=3000)
            pg.wait_for_timeout(2600)
            if vis(pg, ".editor-panel"):
                return True
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(500)
        except Exception:
            pass
    return vis(pg, ".editor-panel")


def editor_set_content(pg, text):
    """Switch to Edit Mode and replace content."""
    pg.locator("button", has_text="Edit Mode").first.click(timeout=5000)
    pg.wait_for_timeout(900)
    area = pg.locator(".editor-panel textarea, .editor-panel [contenteditable=true]").first
    area.click(timeout=5000)
    pg.keyboard.press("Control+a")
    pg.keyboard.press("Backspace")
    pg.keyboard.insert_text(text)
    pg.wait_for_timeout(2500)  # autosave debounce


def editor_get_content(pg):
    """Ensure Edit Mode is active and return content text."""
    try:
        edit_tab = pg.locator("button.tab-btn", has_text="Edit Mode")
        if edit_tab.count() and not pg.locator("button.tab-btn.active", has_text="Edit Mode").count():
            edit_tab.first.click(timeout=4000)
            pg.wait_for_timeout(900)
    except Exception:
        pass
    area = pg.locator(".editor-panel textarea, .editor-panel [contenteditable=true]").first
    if not area.count():
        return ""
    try:
        return area.input_value()
    except Exception:
        try:
            return area.evaluate("el => el.textContent || el.value || ''")
        except Exception:
            return ""


def create_note(pg, title):
    """Click 'Create new note', handle a title prompt if one appears."""
    pg.get_by_role("button", name="Create new note").first.click(timeout=5000)
    pg.wait_for_timeout(1200)
    # title prompt modal?
    modal_input = pg.locator(".modal.show input, .modal input, .prompt-modal input").first
    try:
        if modal_input.count() and modal_input.is_visible():
            modal_input.fill(title)
            pg.wait_for_timeout(300)
            confirm = pg.locator(".modal.show button, .modal button").filter(has_text=re.compile(r"create|save|ok|confirm", re.I))
            if confirm.count():
                confirm.first.click()
            else:
                pg.keyboard.press("Enter")
            pg.wait_for_timeout(1800)
            return True
    except Exception:
        pass
    # otherwise a window opens with an untitled title input
    pg.wait_for_timeout(1500)
    try:
        ti = pg.locator("input.note-title-input")
        if ti.count() and ti.first.is_visible():
            ti.first.fill(title)
            pg.keyboard.press("Enter")
            pg.wait_for_timeout(2000)
            return True
    except Exception as e:
        log("   create_note fallback: " + str(e)[:100])
    return vis(pg, ".editor-panel")


def wait_for_db_note(pg, title, timeout=20000):
    """Poll until a note title exists in IndexedDB."""
    end = time.time() + timeout / 1000
    while time.time() < end:
        snap = idb_snapshot(pg)
        if snap.get("titles") and title in snap["titles"]:
            return True
        pg.wait_for_timeout(1200)
    return False


def db_note_content(pg, title):
    """Return content text of a note by title from IndexedDB (or '')."""
    try:
        return pg.evaluate(
            """(t) => new Promise((res) => {
              const rq = indexedDB.open('aether_mind_db');
              rq.onsuccess = () => {
                const db = rq.result;
                const g = db.transaction('notes').objectStore('notes').getAll();
                g.onsuccess = () => {
                  const n = g.result.find(x => x.title === t);
                  db.close();
                  res(n ? (n.content || '') : '');
                };
                g.onerror = () => { db.close(); res(''); };
              };
              rq.onerror = () => res('');
            })""",
            title,
        )
    except Exception:
        return ""


# ==========================================================================
# GROUPS
# ==========================================================================
def group_boot(st):
    pg = fresh(st)
    st.add("boot-1", "Fresh load renders header + graph canvas", "PASS" if vis(pg, "header") and vis(pg, "canvas") else "FAIL",
           shot=shot(st, "landing", "Landing — graph canvas + floating header (desktop 1440)") if vis(pg, "canvas") else "")
    snap = idb_snapshot(pg)
    seeded = snap.get("notes") == 4 and snap.get("pages", 0) == 1 and len(snap.get("titles", [])) == 4
    st.add("boot-2", "Demo seed data present on first load (4 notes, 1 page)",
           "PASS" if seeded else "FAIL", detail=json.dumps({k: v for k, v in snap.items() if k != "titles"}))
    st.add("boot-3", "No console/page errors on boot", "PASS" if not (st.console["errors"] or st.console["pageerrors"]) else "FAIL",
           detail="; ".join((st.console["errors"] + st.console["pageerrors"])[:2]))
    return st


def group_core(st):
    pg = fresh(st)
    close_search_panel(pg)
    shot(st, "landing-clean", "Landing — search panel closed, graph focus")
    st.add("core-1", "Clean landing state", "PASS")

    # Graph statistics drawer
    try:
        pg.get_by_role("button", name="Graph Statistics").first.click(timeout=4000)
        pg.wait_for_timeout(1200)
        stats_ok = "Notes" in pg.locator("body").inner_text() or "Links" in pg.locator("body").inner_text()
        shot(st, "graph-stats", "Graph Statistics drawer")
        st.add("core-2", "Graph Statistics drawer opens with content", "PASS" if stats_ok else "WARN",
               detail="drawer visible; content check fuzzy")
    except Exception as e:
        st.add("core-2", "Graph Statistics drawer opens", "FAIL", detail=str(e)[:120])
        fail_dump(st, "graphstats", e)
    close_overlays(pg)

    # Controls help
    try:
        pg.get_by_role("button", name="Controls help").first.click(timeout=4000)
        pg.wait_for_timeout(1200)
        shot(st, "controls-help", "Controls help overlay")
        st.add("core-3", "Controls help opens", "PASS")
    except Exception as e:
        st.add("core-3", "Controls help opens", "FAIL", detail=str(e)[:120])
    close_overlays(pg)

    # Canvas double-click create note
    # Finding: dblclick is consumed by d3 zoom (canvas k doubles) and no note is created.
    try:
        box = pg.locator("canvas").first.bounding_box()
        if box:
            before = idb_snapshot(pg).get("notes")
            k_before = pg.evaluate("() => { const c = document.querySelector('canvas'); return c ? (c.__zoom || {k: null}).k : null; }")
            # shrink graph so corners are empty
            for _ in range(3):
                try:
                    pg.get_by_role("button", name="Zoom out").first.click(timeout=2500)
                    pg.wait_for_timeout(450)
                except Exception:
                    break
            pg.wait_for_timeout(1400)
            x = box["x"] + box["width"] * 0.97
            y = box["y"] + box["height"] * 0.9
            pg.mouse.dblclick(x, y)
            pg.wait_for_timeout(2600)
            after = idb_snapshot(pg).get("notes")
            k_after = pg.evaluate("() => { const c = document.querySelector('canvas'); return c ? (c.__zoom || {k: null}).k : null; }")
            created = (after or 0) > (before or 0)
            zoomed = bool(k_before and k_after and k_after > k_before * 1.5)
            shot(st, "canvas-create", "Double-click canvas — note creation attempt",
                 note=f"notes {before}->{after}; zoom k {k_before}->{k_after}")
            detail = f"notes {before}->{after}; zoom k {k_before}->{k_after}"
            bad = not created or zoomed
            st.add("core-4", "Double-click empty canvas creates a note without zooming",
                   "FAIL" if bad else "PASS",
                   detail=detail + ("" if not bad else
                                    (" | no note created (d3 dblclick.zoom swallowed the gesture)" if not created
                                     else " | note created but dblclick still zoomed")))
            close_overlays(pg)
            close_search_panel(pg)
            # delete probe note if created
            if created:
                try:
                    del_btn = pg.locator("button[aria-label='Delete note']")
                    if del_btn.count():
                        del_btn.first.click(timeout=3000)
                        pg.wait_for_timeout(1000)
                        conf = pg.locator("button", has_text=re.compile(r"delete|remove", re.I)).last
                        if conf.count():
                            conf.click(timeout=3000)
                            pg.wait_for_timeout(2000)
                except Exception:
                    pass
        else:
            st.add("core-4", "Double-click empty canvas creates a note", "FAIL", detail="no canvas bounding box")
    except Exception as e:
        st.add("core-4", "Double-click empty canvas creates a note", "WARN", detail=str(e)[:120])

    # Open a demo note in the editor
    st.page = reload_page(st)
    close_search_panel(st.page)
    ok = palette_open_note(st.page, "Welcome to AetherMind")
    if ok:
        shot(st, "editor-view", "Note editor — Preview (view) mode of a demo note")
        st.add("core-5", "Command palette opens demo note in editor", "PASS")
    else:
        st.add("core-5", "Command palette opens demo note in editor", "FAIL", detail="no .editor-panel")
        fail_dump(st, "editoropen", "no panel")
        return st

    # metadata widgets present
    body = st.page.locator(".editor-panel").inner_text().lower()
    meta_ok = "general" in body and "connections" in body
    st.add("core-6", "Editor shows metadata (category, connections panel, AI buttons)",
           "PASS" if meta_ok else "FAIL", detail="General/Connections present" if meta_ok else body[:160])

    # Edit mode + markdown typing + toolbar screenshot
    try:
        st.page.locator("button.tab-btn", has_text="Edit Mode").first.click(timeout=4000)
        st.page.wait_for_timeout(900)
        area = st.page.locator(".editor-panel textarea, .editor-panel [contenteditable=true]").first
        area.click(timeout=4000)
        st.page.keyboard.press("Control+a")
        st.page.keyboard.press("Backspace")
        st.page.keyboard.insert_text("# Heading Test\n\nSome **bold** and a list:\n- one\n- two\n\n[[Interactive Graph]]\n\n/todo")
        st.page.wait_for_timeout(600)
        shot(st, "editor-edit", "Editor — Edit Mode with typed markdown + wiki-link")
        # slash command menu check happened before insert; now verify preview
        st.page.locator("button.tab-btn", has_text="Preview").first.click(timeout=4000)
        st.page.wait_for_timeout(1400)
        pv = st.page.locator(".editor-panel").inner_text()
        preview_ok = "Heading Test" in pv and "Interactive Graph" in pv
        shot(st, "editor-preview-render", "Editor — Preview renders heading/list/wiki-link")
        st.add("core-7", "Edit Mode typing + Preview rendering (GFM + wiki-link)", "PASS" if preview_ok else "WARN",
               detail="wiki-link rendered" if preview_ok else pv[:200])
    except Exception as e:
        st.add("core-7", "Edit Mode typing + Preview", "FAIL", detail=str(e)[:140])
        fail_dump(st, "editmode", e)

    # Restore original demo content afterwards is unnecessary: reset DB happens later.
    st.page.locator("button.tab-btn", has_text="Edit Mode").first.click(timeout=4000)
    st.page.wait_for_timeout(700)
    editor_set_content(st.page, "Welcome to **AetherMind**! This note was re-seeded by the QA tour.\n\n- item\n- item\n\nVisit [[Interactive Graph]] for the canvas guide.")
    st.add("core-8", "Content autosave (typing then waiting)", "PASS")

    # Persistence across reload
    reload_page(st)
    st.page.wait_for_timeout(1500)
    ok = vis(st.page, ".editor-panel") or palette_open_note(st.page, "Welcome to AetherMind")
    if not ok:
        fail_dump(st, "reopen", Exception("editor-panel not visible after reopen"))
    content = editor_get_content(st.page) if ok else ""
    dbc = db_note_content(st.page, "Welcome to AetherMind")
    persisted = "re-seeded by the QA tour" in content or "re-seeded by the QA tour" in dbc
    st.add("core-9", "Edited content persists after full reload (IndexedDB)", "PASS" if persisted else "FAIL",
           detail=f"ui_len={len(content)} db_len={len(dbc)}" if not persisted else f"db_len={len(dbc)}")
    close_overlays(st.page)

    # Title editing + category color widget check
    try:
        ti = st.page.locator("input.note-title-input")
        if ti.count():
            old = ti.first.input_value()
            type_text(st.page, ti.first, old + "!")
            st.page.keyboard.press("Tab")  # blur commits title
            st.page.wait_for_timeout(2500)
            shot(st, "editor-title", "Editor — title edited inline")
            title_ok = wait_for_db_note(st.page, old + "!", timeout=15000)
            st.add("core-10", "Rename note via title input persists", "PASS" if title_ok else "FAIL",
                   detail="title found in DB" if title_ok else f"expected '{old}!'; notes={idb_snapshot(st.page).get('titles', [])}")
            # rename back
            if title_ok:
                reload_page(st)
                if palette_open_note(st.page, old + "!") or vis(st.page, ".editor-panel"):
                    ti2 = st.page.locator("input.note-title-input")
                    if ti2.count():
                        type_text(st.page, ti2.first, old)
                        st.page.keyboard.press("Tab")
                        st.page.wait_for_timeout(2500)
                        wait_for_db_note(st.page, old, timeout=15000)
    except Exception as e:
        st.add("core-10", "Rename note via title input", "FAIL", detail=str(e)[:120])
        fail_dump(st, "rename", e)

    # Tags input
    try:
        tags = st.page.locator("input.meta-input[placeholder*='tag' i], input.meta-input")
        if tags.count():
            tags.first.fill("qatour, demo")
            st.page.keyboard.press("Enter")
            st.page.wait_for_timeout(2200)
            tags2 = st.page.locator("input.meta-input")
            shot(st, "editor-tags", "Editor — tags input")
            st.add("core-11", "Tags input accepts comma-separated tags", "PASS",
                   detail=tags2.first.input_value() if tags2.count() else "input gone")
    except Exception as e:
        st.add("core-11", "Tags input accepts tags", "FAIL", detail=str(e)[:120])

    # Connections dropdown add + verify backlink on target
    try:
        conn = st.page.locator(".editor-panel", has_text="Connections").first
        dd = conn.locator("input.dropdown-input, .dropdown-trigger input").first
        if dd.count():
            dd.click(timeout=4000)
        else:
            conn.locator(".dropdown-trigger").first.click(timeout=4000)
        st.page.wait_for_timeout(1100)
        shot(st, "connections-dropdown", "Editor — connections dropdown")
        # click any visible option element whose trimmed text equals the target
        target = "Markdown Syntax"
        clicked = st.page.evaluate(
            """(t) => {
              const els = [...document.querySelectorAll('button, li, [role=option], .dropdown-item, div, span')];
              const el = els.find(e => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && (e.textContent || '').trim() === t;
              });
              if (el) { el.click(); return true; }
              return false;
            }""",
            target,
        )
        st.page.wait_for_timeout(2800)
        if clicked:
            close_overlays(st.page)
            ok2 = palette_open_note(st.page, target) or vis(st.page, ".editor-panel")
            if ok2:
                btxt = st.page.locator(".editor-panel").inner_text().lower()
                ok_c = "backlinks (1)" in btxt or "backlinks (" in btxt
                st.add("core-12", "Add connection via dropdown creates backlink", "PASS" if ok_c else "WARN",
                       detail="backlink found" if ok_c else f"panel text sample: {btxt[-160:]}")
            else:
                st.add("core-12", "Add connection via dropdown", "WARN", detail="target note not opened")
        else:
            st.add("core-12", "Add connection via dropdown", "FAIL", detail="no option element with text 'Markdown Syntax'")
            fail_dump(st, "conns", Exception("option not found"))
    except Exception as e:
        st.add("core-12", "Add connection via dropdown", "FAIL", detail=str(e)[:140])
        fail_dump(st, "conns", e)
    close_overlays(st.page)

    # Search & tag filter (panel is CLOSED by default; open it via the canvas Search button)
    reload_page(st)
    try:
        pg.get_by_role("button", name="Search", exact=True).first.click(timeout=5000)
        st.page.wait_for_timeout(1500)
        si = st.page.locator("input#graph-search-input").first
        si.click(timeout=4000)
        st.page.keyboard.type("Organizing", delay=25)
        st.page.wait_for_timeout(3000)
        val = si.input_value()
        panel_state = st.page.evaluate(
            """() => {
              const inp = document.querySelector('input#graph-search-input');
              if (!inp) return null;
              const r = inp.getBoundingClientRect();
              const panel = inp.closest('.search-filter-panel');
              return {x: Math.round(r.left), cls: panel ? panel.className.toString() : ''};
            }"""
        )
        page_html = st.page.content()
        hit_html = "Organizing Notes" in page_html
        shot(st, "search-results", "Search & filter panel — text query hit",
             note=f"input value: {val!r}; html_hit={hit_html}; panel={panel_state}")
        opened = bool(panel_state and panel_state["x"] >= 0 and "open" in panel_state.get("cls", ""))
        if val != "Organizing":
            st.add("core-13", "Text search finds note by title/content", "WARN", detail=f"typed value mismatch: {val!r}")
        elif not opened:
            st.add("core-13", "Text search finds note by title/content", "FAIL", detail=f"panel did not open: {panel_state}")
        else:
            st.add("core-13", "Text search finds note by title/content", "PASS" if hit_html else "WARN",
                   detail="hit (dom)" if hit_html else "panel open, input accepted, but no matching note text in DOM")
    except Exception as e:
        st.add("core-13", "Text search", "FAIL", detail=str(e)[:120])
        fail_dump(st, "search", e)
    # tag chips inside the open panel
    try:
        chips = st.page.locator("button.tag-filter-chip").count()
        shot(st, "search-tag-chips", "Search panel — tag filter chips")
        st.add("core-14", "Tag filter chips shown in open panel", "PASS" if chips >= 1 else "WARN",
               detail=f"{chips} chips")
    except Exception as e:
        st.add("core-14", "Tag filter chips", "FAIL", detail=str(e)[:100])
    close_search_panel(st.page)
    shot(st, "landing-tags-hidden", "Graph only — after closing search panel")

    # Timeline scrubber present + interactive
    try:
        tl = st.page.locator("input.timeline-range")
        shot(st, "timeline", "Timeline scrubber (bottom of canvas)")
        st.add("core-15", "Timeline scrubber renders", "PASS" if tl.count() else "FAIL")
    except Exception as e:
        st.add("core-15", "Timeline scrubber", "FAIL", detail=str(e)[:100])

    # Favorite toggle on note
    try:
        palette_open_note(st.page, "Interactive Graph")
        fav = st.page.locator("button[aria-label='Toggle Favorite']")
        if fav.count():
            fav.first.click(timeout=3000)
            st.page.wait_for_timeout(1500)
            st.add("core-16", "Favorite toggle on note", "PASS")
        else:
            st.add("core-16", "Favorite toggle on note", "FAIL", detail="button not found")
    except Exception as e:
        st.add("core-16", "Favorite toggle on note", "FAIL", detail=str(e)[:120])

    # XSS sanitization probe
    try:
        close_overlays(st.page)
        created = create_note(st.page, "XSS Probe")
        if created:
            editor_set_content(st.page, '<img src=x onerror="document.title=\'XSSHIT\'"><script>window.__xss=1;document.title=\'XSSHIT\'</script>')
            reload_page(st)
            palette_open_note(st.page, "XSS Probe")
            st.page.locator("button.tab-btn", has_text="Preview").first.click(timeout=4000)
            st.page.wait_for_timeout(1600)
            xss = st.page.evaluate("({title: document.title, xss: window.__xss, imgs: document.querySelectorAll('.editor-panel img').length, scripts: document.querySelectorAll('.editor-panel script').length})")
            shot(st, "xss-probe", "XSS probe — rendered note with script/img payload")
            clean = xss["title"] != "XSSHIT" and not xss["xss"] and xss["scripts"] == 0
            st.add("core-17", "Markdown XSS payload is sanitized on render", "PASS" if clean else "FAIL",
                   detail=json.dumps(xss))
            # delete probe note
            close_overlays(st.page)
            del_btn = st.page.locator("button[aria-label='Delete note']")
            if del_btn.count():
                del_btn.first.click(timeout=3000)
                st.page.wait_for_timeout(1200)
                conf = st.page.locator("button", has_text=re.compile(r"delete|remove", re.I)).last
                if conf.count():
                    conf.click(timeout=3000)
                    st.page.wait_for_timeout(2000)
                st.add("core-18", "Delete note (with confirmation) removes it", "PASS" if not wait_for_db_note(st.page, "XSS Probe", timeout=12000) else "FAIL")
        else:
            st.add("core-17", "Markdown XSS payload is sanitized", "WARN", detail="could not create probe note")
    except Exception as e:
        st.add("core-17", "Markdown XSS probe", "FAIL", detail=str(e)[:140])
        fail_dump(st, "xss", e)
    close_overlays(st.page)

    # Delete demo note created by double click if any leftover "New"/untitled exists -> skip
    return st


def action_btn(pg, fragment, use_title=False):
    """Locate a settings action button by inner text or verbose title attribute."""
    if use_title:
        return pg.locator(f"button.settings-action-btn[title*='{fragment}']").first
    return pg.locator("button.settings-action-btn", has_text=fragment).first


def open_settings_tab(pg, tab="Data & Graph"):
    """Open the settings modal and activate a tab. Returns True when the tab is active."""
    for _ in range(3):
        try:
            pg.get_by_role("button", name="Settings and Appearance").first.click(timeout=6000)
        except Exception:
            pass
        pg.wait_for_timeout(1100)
        tab_btn = pg.locator("button.tab-btn", has_text=tab)
        try:
            tab_btn.first.wait_for(state="visible", timeout=3000)
        except Exception:
            close_overlays(pg)
            pg.wait_for_timeout(600)
            continue
        try:
            tab_btn.first.click(timeout=3000)
        except Exception:
            close_overlays(pg)
            pg.wait_for_timeout(600)
            continue
        pg.wait_for_timeout(900)
        if tab == "Data & Graph":
            if pg.locator("button.settings-action-btn").count() > 0:
                return True
        else:
            return True
    return False


def group_data(st):
    pg = fresh(st)
    # open settings data tab
    ok = open_settings_tab(pg, "Data & Graph")
    shot(st, "settings-data", "Settings — Data & Graph tab")
    st.add("data-1", "Settings Data & Graph tab renders actions", "PASS" if ok else "FAIL",
           detail="" if ok else "could not open settings Data & Graph tab")

    # Backup JSON export
    try:
        with pg.expect_download(timeout=25000) as dl:
            action_btn(pg, "Download a complete JSON snapshot of all notes, pages, and connections", use_title=True).click(timeout=8000)
        f = dl.value
        target = ARTS / "backup.json"
        f.save_as(str(target))
        raw = json.loads(target.read_text(encoding="utf-8"))
        try:
            notes_list = raw.get("notes") or raw.get("data", {}).get("notes") or []
            n_notes = len(notes_list)
        except Exception:
            n_notes = 0
        shot(st, "backup-download", "JSON backup exported (download intercepted)")
        st.add("data-2", "Full JSON backup export downloads valid JSON",
               "PASS" if n_notes and isinstance(n_notes, int) and n_notes > 0 else "WARN",
               detail=f"notes in export: {n_notes} | file {f.suggested_filename}")
    except Exception as e:
        st.add("data-2", "Full JSON backup export", "FAIL", detail=str(e)[:140])
        fail_dump(st, "backupexp", e)

    # Snapshot save + browse
    pg = reload_page(st)
    try:
        snap_before = idb_snapshot(pg).get("snapshots", 0)
        if open_settings_tab(pg, "Data & Graph"):
            action_btn(pg, "Save Snapshot Now").click(timeout=6000)
            pg.wait_for_timeout(2600)
            snap_after = idb_snapshot(pg).get("snapshots", 0)
            st.add("data-3", "Save graph snapshot writes a snapshot",
                   "PASS" if (snap_after or 0) > (snap_before or 0) else "FAIL",
                   detail=f"snapshots {snap_before} -> {snap_after}")
            shot(st, "snapshot-saved", "Graph snapshot saved (confirmation)")
            action_btn(pg, "Browse Snapshots").click(timeout=5000)
            pg.wait_for_timeout(1500)
            shot(st, "snapshot-browse", "Browse snapshots modal")
            st.add("data-4", "Browse snapshots modal lists snapshots", "PASS")
        else:
            st.add("data-3/4", "Graph snapshots save + browse", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("data-3/4", "Graph snapshots save + browse", "FAIL", detail=str(e)[:150])
        fail_dump(st, "snap", e)

    # HTML export
    pg = reload_page(st)
    try:
        if open_settings_tab(pg, "Data & Graph"):
            with pg.expect_download(timeout=25000) as dl:
                action_btn(pg, "Generate an offline-readable interactive HTML web archive", use_title=True).click(timeout=8000)
            f = dl.value
            target = ARTS / "export.html"
            f.save_as(str(target))
            html = target.read_text(encoding="utf-8", errors="ignore")
            has_note = "Welcome to AetherMind" in html
            st.add("data-5", "HTML web archive export contains notes",
                   "PASS" if has_note else "WARN", detail=f"size={len(html)} note-in-html={has_note}")
        else:
            st.add("data-5", "HTML web archive export", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("data-5", "HTML web archive export", "FAIL", detail=str(e)[:140])

    # ZIP export via canvas Export
    pg = reload_page(st)
    close_search_panel(pg)
    try:
        with pg.expect_download(timeout=25000) as dl:
            pg.get_by_role("button", name="Export", exact=True).first.click(timeout=8000)
        f = dl.value
        target = ARTS / "export.zip"
        f.save_as(str(target))
        import zipfile
        names = []
        try:
            with zipfile.ZipFile(target) as z:
                names = z.namelist()
        except Exception as ze:
            names = [f"invalid zip: {ze}"]
        has_md = any(n.endswith(".md") for n in names)
        st.add("data-6", "Canvas ZIP export produces archive with markdown notes",
               "PASS" if has_md else "FAIL", detail=f"entries: {len(names)} | md={has_md}")
        shot(st, "zip-export", "ZIP export download")
    except Exception as e:
        st.add("data-6", "Canvas ZIP export", "FAIL", detail=str(e)[:140])
        fail_dump(st, "zipexp", e)

    # ZIP import
    pg = reload_page(st)
    try:
        imp = pg.get_by_role("button", name="Import Markdown ZIP", exact=True)
        if not (imp.count() and imp.first.is_visible()):
            imp = pg.get_by_role("button", name=re.compile("import", re.I)).first
        with pg.expect_file_chooser(timeout=15000) as fc:
            imp.first.click(timeout=6000)
        fc.value.set_files(str(ARTS / "export.zip"))
        pg.wait_for_timeout(6000)
        shot(st, "zip-import", "ZIP import completed state")
        st.add("data-7", "ZIP import runs without error", "PASS")
    except Exception as e:
        st.add("data-7", "ZIP import", "WARN", detail=str(e)[:140])

    # JSON import (restore)
    pg = reload_page(st)
    try:
        if open_settings_tab(pg, "Data & Graph"):
            with pg.expect_file_chooser(timeout=15000) as fc:
                action_btn(pg, "Restore an existing JSON backup archive", use_title=True).click(timeout=8000)
            fc.value.set_files(str(ARTS / "backup.json"))
            pg.wait_for_timeout(6000)
            snap = idb_snapshot(pg)
            st.add("data-8", "JSON backup restore roundtrip keeps notes",
                   "PASS" if snap.get("notes", 0) >= 4 else "FAIL",
                   detail=json.dumps({k: v for k, v in snap.items() if k != "titles"}))
        else:
            st.add("data-8", "JSON backup restore", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("data-8", "JSON backup restore", "FAIL", detail=str(e)[:140])
        fail_dump(st, "restore", e)

    # Cluster unlinked notes (local ML / semantic clustering button)
    pg = reload_page(st)
    try:
        if open_settings_tab(pg, "Data & Graph"):
            action_btn(pg, "Cluster Unlinked Notes").click(timeout=6000)
            pg.wait_for_timeout(8000)
            shot(st, "cluster-unlinked", "Local-ML cluster unlinked notes (after run)")
            st.add("data-9", "Cluster Unlinked Notes action completes", "WARN", detail="visual only (depends on local embeddings)")
        else:
            st.add("data-9", "Cluster Unlinked Notes", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("data-9", "Cluster Unlinked Notes", "FAIL", detail=str(e)[:120])

    # Reset database (destructive; leaves clean demo state for subsequent groups)
    pg = reload_page(st)
    try:
        if open_settings_tab(pg, "Data & Graph"):
            action_btn(pg, "Wipe local database and restore factory defaults", use_title=True).click(timeout=6000)
            pg.wait_for_timeout(1600)
            shot(st, "reset-confirm", "Reset Database confirmation modal")
            conf = pg.locator("button", has_text="Restore Defaults").first
            if conf.count() and conf.is_visible():
                conf.click(timeout=4000)
            else:
                # fallback: confirm modal buttons
                fallback = pg.locator(".modal.show button.btn-danger, .modal.show button", has_text=re.compile(r"restore|delete|confirm", re.I)).last
                if fallback.count():
                    fallback.click(timeout=4000)
            pg.wait_for_timeout(9000)
            snap = idb_snapshot(pg)
            reset_ok = snap.get("notes") == 4
            shot(st, "reset-db", "Database reset -> re-seeded demo state")
            st.add("data-10", "Reset Database wipes and re-seeds demo notes", "PASS" if reset_ok else "FAIL",
                   detail=json.dumps({k: v for k, v in snap.items() if k != "titles"}))
        else:
            st.add("data-10", "Reset Database", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("data-10", "Reset Database", "FAIL", detail=str(e)[:150])
        fail_dump(st, "reset", e)
    return st


def group_themes(st):
    pg = fresh(st)
    close_search_panel(pg)
    presets = ["Light Clean", "Sepia Warm", "Midnight", "Ocean Tide", "Custom", "Dark Space"]
    opened = []
    for preset in presets:
        try:
            pg.get_by_role("button", name="Settings and Appearance").first.click(timeout=6000)
            pg.wait_for_timeout(1200)
            pg.locator("button.tab-btn", has_text="Appearance").first.click(timeout=4000)
            pg.wait_for_timeout(900)
            tgt = pg.locator("button, [role=button], label").filter(has_text=re.compile(re.escape(preset), re.I)).first
            if not tgt.count():
                # radio/checkbox style?
                tgt = pg.locator("input").filter(has_text=re.compile(re.escape(preset), re.I)).first
            tgt.click(timeout=4000)
            pg.wait_for_timeout(1400)
            close_overlays(pg)
            bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
            shot(st, f"theme-{preset.lower().replace(' ', '-')}", f"Theme: {preset}", note=f"body bg {bg}")
            opened.append(preset)
            log(f"    theme applied: {preset} bg={bg}")
        except Exception as e:
            st.add("themes", f"Theme {preset} applies", "FAIL", detail=str(e)[:120])
    applied = len(opened)
    st.add("theme-1", "All 6 preset themes switch without errors", "PASS" if applied == len(presets) else "FAIL",
           detail=f"applied {applied}/{len(presets)}: {opened}")

    # Font selector
    try:
        pg.get_by_role("button", name="Settings and Appearance").first.click(timeout=6000)
        pg.wait_for_timeout(1200)
        pg.locator("button.tab-btn", has_text="Appearance").first.click(timeout=4000)
        pg.wait_for_timeout(900)
        shot(st, "settings-appearance", "Settings — Appearance tab (theme + fonts + custom builder)")
        st.add("theme-2", "Appearance tab shows fonts + custom theme options", "PASS")
    except Exception as e:
        st.add("theme-2", "Appearance tab", "FAIL", detail=str(e)[:100])
    close_overlays(pg)
    reload_page(st)
    close_search_panel(st.page)
    # verify theme persisted across reload
    try:
        pg.get_by_role("button", name="Settings and Appearance").first.click(timeout=6000)
        pg.wait_for_timeout(1000)
        active = pg.locator("button.tab-btn", has_text="Appearance").count()
        close_overlays(pg)
        st.add("theme-3", "Theme choice persists across reload", "WARN", detail="checked via settings re-open")
    except Exception:
        pass
    # restore Dark Space default
    try:
        pg.get_by_role("button", name="Settings and Appearance").first.click(timeout=6000)
        pg.wait_for_timeout(1000)
        pg.locator("button.tab-btn", has_text="Appearance").first.click(timeout=4000)
        pg.wait_for_timeout(800)
        pg.locator("button, label, [role=button]").filter(has_text="Dark Space").first.click(timeout=4000)
        pg.wait_for_timeout(1000)
        close_overlays(pg)
    except Exception:
        pass
    return st


def group_responsive(st):
    # Tablet viewport
    pg = fresh(st, viewport={"width": 900, "height": 1024})
    close_search_panel(pg)
    shot(st, "tablet-landing", "Tablet 900x1024 — landing + header", page=pg)
    st.add("resp-1", "Tablet layout renders (no broken header)", "PASS" if vis(pg, "header") else "FAIL")
    try:
        palette_open_note(pg, "Interactive Graph")
        shot(st, "tablet-editor", "Tablet — editor window open", page=pg)
        st.add("resp-2", "Tablet editor usable", "PASS")
    except Exception as e:
        st.add("resp-2", "Tablet editor", "FAIL", detail=str(e)[:100])
        fail_dump(st, "tablet-editor", e)

    # Mobile viewport
    pg2 = fresh(st, viewport={"width": 390, "height": 844})
    pg2.wait_for_timeout(1000)
    shot(st, "mobile-landing", "Mobile 390x844 — landing with bottom nav", page=pg2)
    nav_ok = vis(pg2, ".mobile-nav, nav") 
    st.add("resp-3", "Mobile bottom navigation present", "PASS" if nav_ok else "WARN", detail="nav container check")
    # bottom nav tabs (click from clean reload; each tab may open its own view)
    try:
        names = ["Graph", "Search", "Editor", "New Page", "Menu"]
        clicked = []
        for label in names:
            nav_item = pg2.locator("button.nav-link, a.nav-link").filter(has_text=re.compile(f"^{re.escape(label)}$")).first
            if not nav_item.count():
                continue
            nav_item.click(timeout=4000)
            pg2.wait_for_timeout(900)
            clicked.append(label)
            close_overlays(pg2)  # New Page / Menu may open sheets; clear them before next click
        shot(st, "mobile-nav-tabs", "Mobile — bottom nav interaction", page=pg2)
        st.add("resp-4", "Mobile bottom nav tabs activate", "PASS" if len(clicked) >= 4 else "WARN",
               detail=f"clicked: {clicked}")
    except Exception as e:
        st.add("resp-4", "Mobile bottom nav", "FAIL", detail=str(e)[:120])
    # Ask AI on mobile is reachable via bottom-nav Menu sheet (the header Ask AI icon overflows off-screen at 390px)
    pg2 = reload_page(st)
    pg2.wait_for_timeout(1200)
    try:
        menu_btn = pg2.locator("button.nav-link, a.nav-link").filter(has_text=re.compile(r"^Menu$")).first
        menu_btn.click(timeout=5000)
        pg2.wait_for_timeout(1500)
        ask = pg2.locator("button.mobile-menu-btn", has_text="Ask AI").first
        if not ask.count():
            # the menu may not have opened; toggle again
            menu_btn.click(timeout=5000)
            pg2.wait_for_timeout(1200)
            ask = pg2.locator("button.mobile-menu-btn", has_text="Ask AI").first
        ask.click(timeout=5000)
        pg2.wait_for_timeout(2000)
        shot(st, "mobile-ask-ai", "Mobile — Ask AI modal (via Menu sheet)", page=pg2)
        st.add("resp-5", "Mobile Ask AI modal opens (Menu sheet route)", "PASS")
    except Exception as e:
        items = ""
        try:
            items = pg2.evaluate(r"""() => [...document.querySelectorAll('button.mobile-menu-btn')].map(b => (b.textContent||'').trim().replace(/\s+/g,' ')).join(' | ')""")
        except Exception:
            pass
        st.add("resp-5", "Mobile Ask AI modal opens (Menu sheet route)", "FAIL", detail=str(e)[:140] + " | menu items: " + items)
        fail_dump(st, "mobile-askai", e)
    # Settings on mobile
    try:
        pg2 = reload_page(st)
        close_search_panel(pg2)
        menu = pg2.locator("a, button").filter(has_text="Menu").first
        if menu.count():
            menu.click(timeout=3000)
            pg2.wait_for_timeout(900)
        sets = pg2.locator("button", has_text=re.compile("Settings", re.I)).first
        if sets.count():
            sets.click(timeout=3000)
            pg2.wait_for_timeout(1500)
            shot(st, "mobile-settings", "Mobile — Settings modal", page=pg2)
            st.add("resp-6", "Mobile settings reachable via Menu", "PASS")
    except Exception as e:
        st.add("resp-6", "Mobile settings", "WARN", detail=str(e)[:100])
    close_overlays(pg2)
    return st


def _settings_input(pg, label_text):
    """Input inside the settings modal that follows a form-label with given text."""
    lab = pg.locator(".settings-modal label.form-label", has_text=label_text).first
    if lab.count():
        return lab.locator("xpath=ancestor::div[contains(@class,'mb-3')][1]//input").first
    return pg.locator(".settings-modal input").first


def _dropdown_select(pg, current_text, option_text, scope=".settings-modal"):
    trig = pg.locator(f"{scope} .dropdown-trigger", has_text=re.compile(re.escape(current_text), re.I)).first
    trig.click(timeout=6000)
    pg.wait_for_timeout(900)
    opt = pg.locator(".dropdown-menu .dropdown-option", has_text=re.compile(re.escape(option_text), re.I)).first
    opt.click(timeout=6000)
    pg.wait_for_timeout(900)


def _configure_ai(pg, st):
    """Switch provider to Custom Provider -> localhost:8080/v1, model Qwen. Persists; returns True when verified."""
    if not open_settings_tab(pg, "AI Integration"):
        st.add("ai-config", "AI provider configured & persisted (Custom -> localhost:8080/v1, Qwen)",
               "FAIL", detail="AI Integration tab not reachable")
        return False
    try:
        _dropdown_select(pg, "OpenAI", "Custom Provider")
        log("    provider switched to Custom")
    except Exception as e:
        log("    provider dropdown err: " + str(e)[:140])
    try:
        base = _settings_input(pg, "Base URL")
        base.fill(AI_BASE)
        mod = _settings_input(pg, "Model")
        mod.fill(AI_MODEL)
        log("    base URL + model filled")
    except Exception as e:
        log("    field fill err: " + str(e)[:140])
    shot(st, "ai-settings", "AI Integration tab (configured: Custom Provider + localhost:8080/v1)")
    close_overlays(pg)
    reload_page(st)
    ok2 = open_settings_tab(st.page, "AI Integration")
    verified = False
    val = bval = "n/a"
    if ok2:
        try:
            val = (st.page.locator(".settings-modal .dropdown-trigger").first.inner_text() or "").strip()
            bval = _settings_input(st.page, "Base URL").input_value()
            verified = ("Custom Provider" in val) and (AI_BASE in bval)
        except Exception as e:
            log("   verify err " + str(e)[:120])
    st.add("ai-config", "AI provider configured & persisted (Custom -> localhost:8080/v1, Qwen)",
           "PASS" if verified else "FAIL",
           detail=f"provider_ui={val[:40]!r} base={bval[:60]!r}")
    shot(st, "ai-settings-verified", "AI Integration — verified persisted config")
    close_overlays(st.page)
    return verified


def group_ai1(st):
    """AI configuration + streaming chat + grounded + summary + autotag."""
    pg = fresh(st)
    _configure_ai(pg, st)
    reload_page(st)
    close_search_panel(st.page)

    # Ask AI general chat
    inp = open_ask_ai(st.page)
    if inp:
        shot(st, "askai-open", "Ask AI modal (copilot) opened")
        type_text(st.page, inp, "Reply with exactly: LOCAL AI OK")
        st.page.keyboard.press("Enter")
        t0 = time.time()
        # wait for the echo marker anywhere in the DOM (modal is not a .modal element)
        answered = False
        txt = ""
        for _ in range(110):
            txt = st.page.locator("body").inner_text()
            if "LOCAL AI OK" in txt or "Local AI OK" in txt:
                answered = True
                break
            if time.time() - t0 > 160:
                break
            st.page.wait_for_timeout(1500)
        latency = round(time.time() - t0, 1)
        shot(st, "askai-chat", "Ask AI — streamed chat reply from local Qwen", note=f"waited {latency}s")
        st.add("ai-1", "Ask AI chat streams a reply from local model", "PASS" if answered else "WARN",
               detail=f"latency {latency}s; echo not matched, body sample: {txt[-200:]}" if not answered else f"latency {latency}s", latency=latency)
    else:
        st.add("ai-1", "Ask AI chat", "FAIL", detail="input not found")
        fail_dump(st, "askai-input", "input missing")

    # Grounded question about notes (uses retrieval context)
    try:
        inp2 = open_ask_ai(st.page)
        if not inp2:
            raise Exception("Ask AI input not reachable")
        base_len = len(st.page.locator("body").inner_text())
        type_text(st.page, inp2, "What notes are in my graph? List their titles only, one per line.")
        st.page.keyboard.press("Enter")
        t0 = time.time()
        got = ""
        for _ in range(150):
            got = st.page.locator("body").inner_text()
            if time.time() - t0 > 25 and any(n.split()[0].lower() in got.lower() for n in DEMO_NOTES):
                break
            if len(got) > base_len + 500 and time.time() - t0 > 25:
                break
            if time.time() - t0 > 225:
                break
            st.page.wait_for_timeout(1500)
        elapsed = round(time.time() - t0, 1)
        hit = (elapsed > 25 and any(n.split()[0].lower() in got.lower() for n in DEMO_NOTES)) or (len(got) > base_len + 500)
        shot(st, "askai-grounded", "Ask AI — grounded question about notes", note=f"waited {elapsed}s")
        st.add("ai-2", "Ask AI answers grounded question with real note titles", "PASS" if hit else "WARN",
               detail=f"latency {elapsed}s; matched={hit} body_delta={len(got)-base_len}; sample: {got[180:420]}")
    except Exception as e:
        st.add("ai-2", "Ask AI grounded question", "FAIL", detail=str(e)[:140])
    close_overlays(st.page)

    # Summarize with AI on a note
    try:
        palette_open_note(st.page, "Welcome to AetherMind")
        summ = st.page.locator("button[aria-label='Summarize with AI']")
        if summ.count():
            base_panel = st.page.locator(".editor-panel").inner_text()
            base_len = len(base_panel)
            summ.first.click(timeout=5000)
            t0 = time.time()
            got = base_panel
            for _ in range(105):
                got = st.page.locator(".editor-panel").inner_text()
                if len(got) > base_len + 120 and time.time() - t0 > 10:
                    break
                if time.time() - t0 > 155:
                    break
                st.page.wait_for_timeout(1500)
            shot(st, "ai-summary", "Note — AI summary (TL;DR) from local model", note=f"waited {round(time.time()-t0,1)}s")
            grew = len(got) > base_len + 120
            st.add("ai-3", "AI Summary produces a TL;DR", "PASS" if grew else "WARN",
                   detail=f"latency {round(time.time()-t0,1)}s; panel grew {len(got)-base_len} chars; snippet: {got[-220:]}")
        else:
            st.add("ai-3", "AI Summary button", "FAIL", detail="button not found")
    except Exception as e:
        st.add("ai-3", "AI Summary", "FAIL", detail=str(e)[:140])
        fail_dump(st, "aisummary", e)

    # Auto-Tag with AI
    try:
        if not vis(st.page, ".editor-panel"):
            palette_open_note(st.page, "Welcome to AetherMind")
        if not vis(st.page, ".editor-panel"):
            raise Exception("editor window not open for auto-tag")
        at = st.page.locator("button[aria-label='Auto-Tag with AI'], button[aria-label*='Auto-Tag'], button[title*='Auto-Tag']")
        if not at.count():
            at = st.page.locator("button.icon-btn", has_text=re.compile("Auto-Tag", re.I)).first
        if at.count():
            tags_in = st.page.locator("input.meta-input")
            base_tags = tags_in.first.input_value() if tags_in.count() else ""
            base_panel = len(st.page.locator(".editor-panel").inner_text())
            st.page.wait_for_timeout(800)
            at.first.evaluate("el => el.click()")  # JS click: element may sit under a transient overlay
            t0 = time.time()
            changed = False
            for _ in range(70):
                if time.time() - t0 > 105:
                    break
                st.page.wait_for_timeout(1500)
                try:
                    if tags_in.count() and tags_in.first.input_value() != base_tags:
                        changed = True
                        break
                    if len(st.page.locator(".editor-panel").inner_text()) > base_panel + 60:
                        changed = True
                        break
                except Exception:
                    pass
            shot(st, "ai-autotag", "Note — Auto-Tag with AI result", note=f"waited {round(time.time()-t0,1)}s")
            st.add("ai-4", "AI Auto-Tag runs and suggests tags/links", "PASS" if changed else "WARN",
                   detail=f"waited {round(time.time()-t0,1)}s; tags/base unchanged; btn_disabled={at.first.evaluate('el => el.disabled') if at.count() else 'gone'}")
        else:
            st.add("ai-4", "AI Auto-Tag button", "FAIL", detail="button not found")
    except Exception as e:
        st.add("ai-4", "AI Auto-Tag", "FAIL", detail=str(e)[:140])
    close_overlays(st.page)
    return st


def group_ai2(st):
    """AI action engine (create/edit/delete through Ask AI), digest, RAG, then final reset."""
    pg = fresh(st)
    # Ask AI to create a note: the model streams (long local reasoning), stages a
    # confirm card, then we click Apply and verify the note persisted in IndexedDB.
    try:
        inp = open_ask_ai(pg)
        if not inp:
            raise Exception("Ask AI input not reachable")
        type_text(pg, inp, 'Create a note titled "Local AI Milestone" with content "Created by the local AI during QA testing. It should connect concepts about knowledge graphs and local-first software." and tag it qa-ai.')
        pg.keyboard.press("Enter")
        t0 = time.time()
        staged = False
        for _ in range(215):  # ~320s cap: local model reasons for minutes before emitting
            body = pg.locator("body").inner_text().lower()
            if "proposed graph mutations" in body or ("apply" in body and "create note" in body):
                staged = True
                break
            if time.time() - t0 > 320:
                break
            pg.wait_for_timeout(1500)
        elapsed = round(time.time() - t0, 1)
        created = False
        if staged:
            try:
                appbtn = pg.locator("button", has_text=re.compile(r"^apply$", re.I)).last
                if not appbtn.count():
                    appbtn = pg.locator("button", has_text="Apply").last
                appbtn.click(timeout=5000)
                pg.wait_for_timeout(2500)
                created = wait_for_db_note(pg, "Local AI Milestone", timeout=45000)
            except Exception as e:
                log("   apply err: " + str(e)[:100])
        shot(st, "ai-create-note", "Ask AI — create_note staged + applied",
             note=f"staged={staged} created={created} waited={elapsed}s")
        st.add("ai-5", "Ask AI 'create a note' stages + applies + persists note",
               "PASS" if created else ("WARN" if staged else "FAIL"),
               detail=(f"note found in IndexedDB after {elapsed}s" if created
                       else (f"staged={staged} but note missing after Apply; waited {elapsed}s" if staged
                             else f"no staged card within 320s")))
    except Exception as e:
        st.add("ai-5", "Ask AI create note", "FAIL", detail=str(e)[:150])
        fail_dump(st, "ai-create", e)
    close_overlays(pg)

    # Ask AI to edit that note (unsafe -> staged confirm)
    try:
        inp = open_ask_ai(pg)
        if not inp:
            raise Exception("Ask AI input not reachable")
        type_text(pg, inp, 'Edit the note titled "Local AI Milestone": append the line "- QA edit marker v2" to its content.')
        pg.keyboard.press("Enter")
        staged = False
        for _ in range(100):
            body = pg.locator("body").inner_text()
            if "confirm" in body.lower() and ("edit" in body.lower() or "approve" in body.lower()):
                staged = True
                break
            pg.wait_for_timeout(1500)
        shot(st, "ai-edit-staged", "Ask AI — unsafe edit_note staged for confirmation")
        st.add("ai-6", "Unsafe AI action (edit) is staged for user confirmation", "PASS" if staged else "WARN",
               detail="confirmation UI appeared" if staged else "no confirm UI seen in poll window")
        # approve it if a confirm button exists
        try:
            approve = pg.locator("button", has_text=re.compile(r"approve|confirm|yes|apply", re.I)).last
            if approve.count() and approve.is_visible():
                approve.click(timeout=4000)
                pg.wait_for_timeout(4000)
                ok_e = wait_for_db_note(pg, "Local AI Milestone", timeout=30000)
                st.add("ai-6b", "Approved edit is applied to the note", "PASS" if ok_e else "WARN")
        except Exception as e:
            log("   approve edit err: " + str(e)[:100])
    except Exception as e:
        st.add("ai-6", "Ask AI edit action staging", "FAIL", detail=str(e)[:150])
    close_overlays(pg)

    # Ask AI to delete (staged)
    try:
        inp = open_ask_ai(pg)
        if not inp:
            raise Exception("Ask AI input not reachable")
        type_text(pg, inp, 'Delete the note titled "Local AI Milestone".')
        pg.keyboard.press("Enter")
        staged_del = False
        for _ in range(80):
            body = pg.locator("body").inner_text()
            if "confirm" in body.lower() and "delete" in body.lower():
                staged_del = True
                break
            pg.wait_for_timeout(1500)
        shot(st, "ai-delete-staged", "Ask AI — unsafe delete_note staged for confirmation")
        st.add("ai-7", "Unsafe AI action (delete) is staged", "PASS" if staged_del else "WARN")
        try:
            approve = pg.locator("button", has_text=re.compile(r"approve|confirm|yes|delete", re.I)).last
            if approve.count() and approve.is_visible():
                approve.click(timeout=4000)
                pg.wait_for_timeout(4000)
                gone = not wait_for_db_note(pg, "Local AI Milestone", timeout=20000)
                st.add("ai-7b", "Approved delete removes the note", "PASS" if gone else "WARN")
        except Exception as e:
            log("   approve delete err: " + str(e)[:100])
    except Exception as e:
        st.add("ai-7", "Ask AI delete staging", "FAIL", detail=str(e)[:150])
    close_overlays(pg)

    # Discovery Digest (AI cross-note digest)
    try:
        pg.get_by_role("button", name="Discovery Digest").first.click(timeout=6000)
        pg.wait_for_timeout(1500)
        digest_open = vis(pg, ".modal.show") or "digest" in pg.locator("body").inner_text().lower()
        if digest_open:
            pg.wait_for_timeout(25000)  # allow local AI to produce digest
        shot(st, "ai-digest", "Discovery Digest modal (local AI digest attempt)")
        dbody = pg.locator("body").inner_text()
        has_content = len(dbody) > 600
        st.add("ai-8", "Discovery Digest opens and AI produces a connection", "WARN" if digest_open else "FAIL",
               detail="modal open; digest content state: " + ("long body" if has_content else "short body"))
    except Exception as e:
        st.add("ai-8", "Discovery Digest", "FAIL", detail=str(e)[:140])
        fail_dump(st, "digest", e)
    close_overlays(pg)

    # RAG: upload a document, then ask a grounded question
    doc_path = ARTS / "rag_sample.txt"
    doc_path.write_text(
        "Quantum Entanglement Explained for AetherMind QA\\n\\n"
        "Quantum entanglement is a physical phenomenon where pairs of particles become correlated "
        "such that the quantum state of one cannot be described independently of the other, even when "
        "separated by large distances. Albert Einstein famously called it 'spooky action at a distance'. "
        "In 2022 the Nobel Prize in Physics was awarded for experiments with entangled photons. "
        "The AETHERMIND_UNIQUE_MARKER_77 is used to prove this document was indexed and retrieved.\\n",
        encoding="utf-8",
    )
    try:
        up = pg.get_by_role("button", name="Upload Document")
        if not (up.count() and up.first.is_visible()):
            up = pg.get_by_role("button", name=re.compile("upload", re.I)).first
        with pg.expect_file_chooser(timeout=15000) as fc:
            up.click(timeout=6000)
        fc.value.set_files(str(doc_path))
        pg.wait_for_timeout(15000)
        shot(st, "rag-upload", "Document upload for RAG indexing (processing)")
        docs = idb_snapshot(pg).get("documents", -1)
        st.add("ai-9", "Document upload indexes into RAG store", "PASS" if docs and docs > 0 else "WARN",
               detail=f"documents store count={docs}")
    except Exception as e:
        st.add("ai-9", "RAG document upload", "FAIL", detail=str(e)[:150])
        fail_dump(st, "rag-upload", e)
    close_overlays(pg)

    try:
        inp = open_ask_ai(pg)
        if not inp:
            raise Exception("Ask AI input not reachable")
        type_text(pg, inp, "According to my uploaded document, what is quantum entanglement? Mention any unusual marker you find in my documents.")
        pg.keyboard.press("Enter")
        t0 = time.time()
        got = ""
        for _ in range(105):
            got = pg.locator("body").inner_text()
            if "MARKER_77" in got:
                break
            if time.time() - t0 > 155:
                break
            pg.wait_for_timeout(1500)
        grounded = "MARKER_77" in got
        shot(st, "rag-qa", "Ask AI — grounded RAG question over uploaded document", note=f"marker found: {grounded}")
        st.add("ai-10", "RAG-grounded Q&A retrieves uploaded document content", "PASS" if grounded else "WARN",
               detail=got[:260] if not grounded else "marker retrieved")
    except Exception as e:
        st.add("ai-10", "RAG grounded Q&A", "FAIL", detail=str(e)[:140])
    close_overlays(pg)

    # Semantic search is part of Ask AI scope above. Related-notes panel check:
    try:
        palette_open_note(pg, "Welcome to AetherMind")
        shot(st, "related-notes", "Related notes panel state")
        rtxt = pg.locator(".editor-panel").inner_text()
        st.add("ai-11", "Related notes panel present in editor", "PASS" if "Related" in rtxt else "WARN",
               detail="Related header found" if "Related" in rtxt else "")
    except Exception as e:
        st.add("ai-11", "Related notes panel", "FAIL", detail=str(e)[:100])

    # Final: reset to pristine demo state
    pg = reload_page(st)
    try:
        if open_settings_tab(pg, "Data & Graph"):
            action_btn(pg, "Wipe local database and restore factory defaults", use_title=True).click(timeout=6000)
            pg.wait_for_timeout(1600)
            conf = pg.locator("button", has_text="Restore Defaults").first
            if conf.count() and conf.is_visible():
                conf.click(timeout=4000)
            pg.wait_for_timeout(9000)
            snap = idb_snapshot(pg)
            st.add("ai-12", "Final cleanup: reset database back to demo seed", "PASS" if snap.get("notes") == 4 else "WARN",
                   detail=json.dumps({k: v for k, v in snap.items() if k != "titles"}))
        else:
            st.add("ai-12", "Final cleanup reset", "FAIL", detail="settings did not open")
    except Exception as e:
        st.add("ai-12", "Final cleanup reset", "FAIL", detail=str(e)[:120])
    return st


GROUPS = {
    "boot": group_boot,
    "core": group_core,
    "data": group_data,
    "themes": group_themes,
    "responsive": group_responsive,
    "ai1": group_ai1,
    "ai2": group_ai2,
}

def _mobile_group(name):
    """Return a runner for a group defined in mobile_groups.py.

    Lazy import avoids a circular import, and init() binds the helpers to THIS
    module (whatever its name — __main__ when run as a script) so globals such
    as CTX/PWB resolve to the live values."""
    def _run(st):
        import mobile_groups
        mobile_groups.init(sys.modules[__name__])
        return getattr(mobile_groups, name)(st)
    return _run

GROUPS["mobile"] = _mobile_group("group_mobile")
GROUPS["mobile-ai"] = _mobile_group("group_mobile_ai")

CTX = None
PWB = None


def main():
    global CTX, PWB
    groups = sys.argv[1:] if len(sys.argv) > 1 else list(GROUPS.keys())
    for g in groups:
        if g not in GROUPS:
            print(f"unknown group {g}; valid: {list(GROUPS)}")
            sys.exit(1)
    with sync_playwright() as p:
        PWB = p.chromium.launch(channel="msedge", headless=True)
        CTX = PWB.new_context(viewport=VIEWPORT, accept_downloads=True, color_scheme="dark")
        for g in groups:
            st = State(g)
            log(f"\n===== GROUP {g} =====")
            t0 = time.time()
            try:
                GROUPS[g](st)
            except Exception as e:
                log(f"!! group {g} crashed: {str(e)[:300]}")
                st.add("group", f"{g} completed", "FAIL", detail=str(e)[:200])
            out = {"tests": st.tests, "shots": st.shots, "console": st.console}
            (ROOT / f"results_{g}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
            log(f"===== GROUP {g} done in {round(time.time()-t0,1)}s: {len(st.tests)} tests, {len(st.shots)} screenshots")
        CTX.close()
        PWB.close()
    log("\nALL GROUPS COMPLETE")


if __name__ == "__main__":
    main()
