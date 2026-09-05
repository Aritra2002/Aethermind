"""report.py — merge qa_bot results_<group>.json + probe.json into report.md and gallery.html."""
import json
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent
GROUPS = ["boot", "core", "data", "themes", "responsive", "ai1", "ai2", "mobile", "mobile-ai"]
GROUP_TITLES = {
    "boot": "Boot & Seed",
    "core": "Graph, Editor & Notes",
    "data": "Data Management & Portability",
    "themes": "Themes & Appearance",
    "responsive": "Responsive / narrow-viewport sweep (early pass)",
    "ai1": "AI: config, chat, grounded Q&A, summary, auto-tag",
    "ai2": "AI: action engine, RAG, cleanup",
    "mobile": "Mobile 390x844 — intentional feature tour",
    "mobile-ai": "Mobile 390x844 — AI config, chat, RAG, cleanup",
}
BROWSER = "Microsoft Edge (headless, Playwright)"
APP_VERSION = "2.1.0 (README/package.json)"


def load_results():
    data = {}
    for g in GROUPS:
        p = ROOT / f"results_{g}.json"
        if p.exists():
            data[g] = json.loads(p.read_text(encoding="utf-8"))
    return data


def load_probe():
    p = ROOT / "probe.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def status_counts(results):
    counts = {}
    for g, d in results.items():
        for t in d.get("tests", []):
            s = t["status"]
            counts[s] = counts.get(s, 0) + 1
    return counts


def render_markdown(results, probe):
    L = []
    L.append("# AetherMind QA Report — automated functional tour + UI/UX review")
    L.append("")
    L.append(f"- **App:** AetherMind v{APP_VERSION} (local-first knowledge graph PKM)")
    L.append("- **Tested URL:** http://localhost:5173/Aethermind/ (Vite dev server)")
    L.append("- **Browser:** " + BROWSER)
    L.append("- **Local AI backend:** MemoryProxy on :8080 → llamafile/llama.cpp :8081, model **Qwen3.8-4B-Q4_K_M.gguf**")
    L.append("- **Method:** Playwright bot drives every feature area, takes screenshots, captures console/network issues and per-screen UX metrics")
    L.append("")
    all_counts = status_counts(results)
    n_pass = all_counts.get("PASS", 0)
    n_fail = all_counts.get("FAIL", 0)
    n_warn = all_counts.get("WARN", 0)
    total = sum(all_counts.values())
    L.append(f"## Executive summary")
    L.append("")
    L.append(f"**{n_pass} PASS · {n_warn} WARN · {n_fail} FAIL · {total} checks total** across {len(results)} groups.")
    L.append("")
    L.append("Ratings use 1–10: 8–10 works fully/reliably; 5–7 partial or brittle; 1–4 broken; N/A untestable. AI *quality* scores reflect the small local model; app mechanics are scored separately where relevant.")
    L.append("")
    # per-group summary table
    L.append("| Area | PASS | WARN | FAIL | Tests | Screenshots |")
    L.append("|---|---|---|---|---|---|")
    for g in GROUPS:
        d = results.get(g)
        if not d:
            continue
        c = {"PASS": 0, "WARN": 0, "FAIL": 0}
        for t in d.get("tests", []):
            c[t["status"]] = c.get(t["status"], 0) + 1
        L.append(f"| {GROUP_TITLES.get(g, g)} | {c['PASS']} | {c['WARN']} | {c['FAIL']} | {len(d.get('tests', []))} | {len(d.get('shots', []))} |")
    L.append("")
    # console / network health
    L.append("## Console & network health")
    L.append("")
    for g in GROUPS:
        d = results.get(g)
        if not d:
            continue
        c = d.get("console", {})
        n_err = len(c.get("errors", []))
        n_pg = len(c.get("pageerrors", []))
        n_fail = len(c.get("failed", []))
        n_http = len(c.get("http4xx5xx", []))
        if n_err or n_pg or n_fail or n_http:
            L.append(f"**{GROUP_TITLES.get(g, g)}:** {n_err} console errors, {n_pg} page errors, {n_fail} failed requests, {n_http} HTTP 4xx/5xx")
            for e in c.get("pageerrors", [])[:3]:
                L.append(f"  - pageerror: `{e[:220]}`")
            for e in c.get("errors", [])[:4]:
                L.append(f"  - console: `{e[:220]}`")
            for e in c.get("http4xx5xx", [])[:4]:
                L.append(f"  - http: `{e[:200]}`")
            L.append("")
    # AI probe
    if probe:
        L.append("## Local AI backend probe (before UI tests)")
        L.append("")
        L.append(f"- Models exposed: `{', '.join(probe.get('models', []))}`")
        chk = probe.get("checks", {})
        if "non_stream_short" in chk:
            x = chk["non_stream_short"]
            L.append(f"- Non-stream short call: latency {x.get('latency_s')}s, content `{(x.get('content') or '')[:60]}`")
        if "stream_sentence" in chk:
            x = chk["stream_sentence"]
            L.append(f"- **Streaming call: first visible content after {x.get('first_content_s')}s** (total {x.get('total_s')}s; the model emitted ~{x.get('reasoning_len')} chars of reasoning first). The app only renders `content` deltas, so users see silence during the model's reasoning phase.")
        if "structured_action" in chk:
            x = chk["structured_action"]
            L.append(f"- Structured action-JSON request: {x.get('latency_s')}s, returned valid JSON: `{(x.get('content') or '')[:120]}`")
        L.append("")
    # per-group detailed test results
    for g in GROUPS:
        d = results.get(g)
        if not d:
            continue
        tests = d.get("tests", [])
        shots = d.get("shots", [])
        L.append(f"## {GROUP_TITLES.get(g, g)} — detailed checks")
        L.append("")
        L.append("| # | Check | Status | Evidence | Screenshot |")
        L.append("|---|---|---|---|---|")
        for t in tests:
            det = (t.get("detail") or "").replace("|", "\\|")
            sh = t.get("shot") or ""
            link = f"[{sh}](screenshots/{sh})" if sh else ""
            if len(det) > 220:
                det = det[:220] + "…"
            L.append(f"| {t['id']} | {t['name']} | **{t['status']}** | {det} | {link} |")
        L.append("")
    # UX metrics aggregate
    L.append("## UX metric scan (per-screenshot DOM/CSS checks)")
    L.append("")
    L.append("Checks are heuristic and evidence-oriented: page/element horizontal overflow, WCAG-style text contrast of sampled visible text (AA thresholds), undersized tap targets on narrow viewports, images missing alt text.")
    L.append("")
    any_ux = False
    for g in GROUPS:
        d = results.get(g)
        if not d:
            continue
        for s in d.get("shots", []):
            m = s.get("metrics") or {}
            issues = m.get("issues") or {}
            total_issues = sum(len(v) for v in issues.values())
            if not total_issues:
                continue
            any_ux = True
            L.append(f"### {s['title']} (`{s['file']}`)")
            for kind, items in issues.items():
                for it in items:
                    L.append(f"- **{kind}:** {it}")
            L.append("")
    if not any_ux:
        L.append("No automated UX-flag issues were recorded.")
        L.append("")
    L.append("---")
    L.append("*Generated by qa_bot/report.py. Ratings are per the rubric in the exec summary; see gallery.html for screenshots.*")
    return "\n".join(L)


def render_gallery(results):
    cards = []
    seq = 0
    for g in GROUPS:
        d = results.get(g)
        if not d:
            continue
        cards.append(f"<h2 class='group'>{html.escape(GROUP_TITLES.get(g, g))}</h2>")
        status = {}
        for t in d.get("tests", []):
            status[t["status"]] = status.get(t["status"], 0) + 1
        cards.append(f"<div class='summary'>{status.get('PASS',0)} PASS · {status.get('WARN',0)} WARN · {status.get('FAIL',0)} FAIL</div>")
        for s in d.get("shots", []):
            seq += 1
            m = s.get("metrics") or {}
            issues = m.get("issues") or {}
            flags = []
            for kind, items in issues.items():
                if items:
                    flags.append(f"{kind}:{len(items)}")
            flag_txt = (" | " + " ".join(flags)) if flags else ""
            border = {"PASS": "#2ecc71", "WARN": "#f5a623", "FAIL": "#e74c3c"}.get("PASS", "#999")
            # find owning test status
            owner = next((t for t in d.get("tests", []) if t.get("shot") == s["file"]), None)
            if owner:
                border = {"PASS": "#2ecc71", "WARN": "#f5a623", "FAIL": "#e74c3c"}.get(owner["status"], "#999")
            cards.append(
                f"<div class='card' style='border-top-color:{border}'>"
                f"<img loading='lazy' src='screenshots/{s['file']}' alt='{html.escape(s['title'])}'>"
                f"<div class='cap'><b>{seq}. {html.escape(s['title'])}</b>{flag_txt}"
                f"{('<br><span class=note>' + html.escape(s['note'])[:160] + '</span>') if s.get('note') else ''}"
                f"</div></div>"
            )
    return "\n".join(cards)


def main():
    results = load_results()
    probe = load_probe()
    md = render_markdown(results, probe)
    (ROOT / "report.md").write_text(md, encoding="utf-8")
    gallery = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>AetherMind QA gallery</title>
<style>
 body{{background:#0c0d14;color:#e8e8f0;font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:0;padding:24px}}
 h1{{font-size:1.4rem}} h2.group{{margin-top:28px;border-bottom:1px solid #333;padding-bottom:6px;font-size:1.1rem}}
 .summary{{color:#9aa;font-size:.85rem;margin:6px 0 14px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}}
 .card{{background:#14161f;border-radius:10px;border-top:3px solid #555;overflow:hidden;display:flex;flex-direction:column}}
 img{{width:100%;display:block}}
 .cap{{padding:8px 10px;font-size:.82rem;line-height:1.35}}
 .note{{color:#9aa}}
</style></head><body>
<h1>AetherMind QA bot — screenshot gallery ({sum(len(d.get('shots', [])) for d in results.values())} shots)</h1>
<div class='grid'>
{render_gallery(results)}
</div></body></html>"""
    (ROOT / "gallery.html").write_text(gallery, encoding="utf-8")
    counts = status_counts(results)
    print("report.md + gallery.html written")
    print("totals:", counts)


if __name__ == "__main__":
    main()
