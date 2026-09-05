"""ux_metrics.py — DOM/CSS based UI/UX checks collected alongside every screenshot.

Checks (all heuristic, evidence-oriented, no false-positive-prone claims):
  * horizontal overflow (page or specific elements sticking past the right edge)
  * text contrast (computed fg vs. composited background; WCAG AA thresholds)
  * undersized tap targets on small viewports
  * <img> elements without alt text
  * duplicate interactive aria-labels are NOT flagged (common in icon toolbars)
The raw issues are stored per screenshot so the report can quote evidence.
"""

import math
import re
from typing import Any, Dict, List

_COLOR_RE = re.compile(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)")
_HEX_RE = re.compile(r"#([0-9a-fA-F]{3,8})")
_NAMED = {
    "black": (0, 0, 0), "white": (255, 255, 255), "red": (255, 0, 0),
    "gray": (128, 128, 128), "grey": (128, 128, 128), "silver": (192, 192, 192),
    "transparent": (0, 0, 0, 0), "currentcolor": None,
}


def _parse_css_color(value: str):
    """Return (r,g,b,a) 0..1 tuple or None when unparseable."""
    value = (value or "").strip().lower()
    if not value:
        return None
    m = _COLOR_RE.search(value)
    if m:
        a = float(m.group(4)) if m.group(4) else 1.0
        return (int(m.group(1)) / 255, int(m.group(2)) / 255, int(m.group(3)) / 255, a)
    m = _HEX_RE.search(value)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        if len(h) in (6, 8):
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
            return (r / 255, g / 255, b / 255, a)
    if value in _NAMED:
        if value == "transparent":
            return (0, 0, 0, 0)
        if _NAMED[value] is None:
            return None
        r, g, b = _NAMED[value]
        return (r / 255, g / 255, b / 255, 1.0)
    return None


def _rel_lum(c):
    r, g, b = c[:3]
    def lin(x):
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast_ratio(fg, bg):
    l1, l2 = _rel_lum(fg), _rel_lum(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


def _composite_bg(page, el):
    """Walk ancestors and alpha-composite background colors; return (r,g,b) or None."""
    js = """(el) => {
      const parse = (v) => {
        v = (v || '').trim().toLowerCase();
        const m = v.match(/rgba?\\(\\s*([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\s/]+([\\d.]+))?\\s*\\)/);
        if (m) return [+m[1]/255, +m[2]/255, +m[3]/255, m[4] === undefined ? 1 : +m[4]];
        const h = v.match(/#([0-9a-f]{3,8})/);
        if (h) { let s = h[1]; if (s.length === 3 || s.length === 4) s = s.split('').map(c => c + c).join('');
          if (s.length === 6 || s.length === 8) { const a = s.length === 8 ? parseInt(s.slice(6,8), 16) / 255 : 1;
            return [parseInt(s.slice(0,2),16)/255, parseInt(s.slice(2,4),16)/255, parseInt(s.slice(4,6),16)/255, a]; } }
        if (v === 'transparent') return [0, 0, 0, 0];
        return null;
      };
      let cur = el;
      const stack = [];
      while (cur && cur !== document.documentElement) {
        const c = getComputedStyle(cur);
        const col = parse(c.backgroundColor);
        stack.push(col);
        cur = cur.parentElement;
      }
      let bg = [0, 0, 0, 0];
      for (let i = stack.length - 1; i >= 0; i--) {
        const c = stack[i];
        if (!c) continue;
        const a = c[3];
        bg = [c[0]*a + bg[0]*(1-a), c[1]*a + bg[1]*(1-a), c[2]*a + bg[2]*(1-a), bg[3]*(1-a) + a];
      }
      if (bg[3] < 0.95) return null;
      return [bg[0], bg[1], bg[2]];
    }"""
    return page.evaluate(js, el)


def _gather_el_metrics(page):
    """Run one evaluate returning sample element data for contrast/tap/overflow checks."""
    return page.evaluate(
        """() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const out = {overflow: [], text: [], taps: [], alts: [], stats: {}};
      out.stats.scrollW = document.documentElement.scrollWidth;
      out.stats.clientW = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 3) {
        const els = document.querySelectorAll('body *');
        for (const el of els) {
          if (out.overflow.length > 6) break;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (s.position === 'fixed' || s.display === 'none' || s.visibility === 'hidden') continue;
          if (r.width > 40 && r.right > vw + 4 && r.left < vw) {
            out.overflow.push({tag: el.tagName, cls: String(el.className).slice(0, 40), right: Math.round(r.right - vw), text: (el.textContent || '').trim().slice(0, 40)});
          }
        }
      }
      // sample text nodes for contrast
      const texts = [];
      document.querySelectorAll('h1,h2,h3,h4,h5,p,li,span,a,button,label,td,div').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 4) return;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
        const txt = (own || (el.children.length === 0 ? (el.textContent || '') : '')).trim();
        if (!txt) return;
        const fs = parseFloat(s.fontSize);
        const bold = parseInt(s.fontWeight) >= 700;
        const large = fs >= 18 || (fs >= 14 && bold);
        texts.push({el, fg: s.color, fs, bold, large, txt: txt.slice(0, 60)});
      });
      const step = Math.max(1, Math.floor(texts.length / 220));
      for (let i = 0; i < texts.length; i += step) out.text.push(texts[i]);
      // undersized tap targets (interactive, in viewport) only meaningful on narrow screens
      if (vw <= 820) {
        document.querySelectorAll('button, a, [role=button], input, select, [role=tab]').forEach(el => {
          if (out.taps.length > 8) return;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return;
          if (r.left > vw || r.top > vh) return;
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return;
          if (r.width < 22 || r.height < 22) {
            out.taps.push({tag: el.tagName, cls: String(el.className).slice(0, 30), w: Math.round(r.width), h: Math.round(r.height),
                           label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)});
          }
        });
      }
      document.querySelectorAll('img').forEach(el => {
        if (!el.getAttribute('alt') && el.getBoundingClientRect().width > 4) {
          out.alts.push({src: (el.getAttribute('src') || '').slice(0, 60)});
        }
      });
      out.stats.textNodes = texts.length;
      return out;
    }"""
    )


def collect(page, shot_file: str) -> Dict[str, Any]:
    """Collect UX metrics for the current page state. Never raises."""
    try:
        raw = _gather_el_metrics(page)
    except Exception as e:  # pragma: no cover
        return {"error": f"collect failed: {e}"}

    issues: Dict[str, List[str]] = {"overflow": [], "contrast": [], "tap": [], "alt": []}
    for o in raw.get("overflow", []):
        issues["overflow"].append(
            f"<{o['tag']} class='{o['cls']}'> sticks {o['right']}px past right edge{o['text'] and ' — ' + o['text']!r}"
        )

    contrast_done = 0
    for t in raw.get("text", []):
        if contrast_done > 14:
            break
        fg = _parse_css_color(t["fg"])
        if fg is None or fg[3] < 0.99:
            continue
        try:
            bg = _composite_bg(page, t["el"])
        except Exception:
            bg = None
        if not bg:
            continue
        ratio = contrast_ratio(fg[:3], bg)
        need = 3.0 if t["large"] else 4.5
        if ratio < need:
            contrast_done += 1
            issues["contrast"].append(
                f"ratio {ratio:.2f} (need {need}) on {'large' if t['large'] else 'small'} text {t['txt']!r} ({t['el'].tagName})"
            )
    for tp in raw.get("taps", []):
        issues["tap"].append(
            f"<{tp['tag']}> {tp['w']}x{tp['h']}px target {tp['label']!r}"
        )
    for a in raw.get("alts", [])[:6]:
        issues["alt"].append(f"img without alt: {a['src']!r}")

    stats = dict(raw.get("stats", {}))
    stats["viewport"] = {"w": page.viewport_size["width"], "h": page.viewport_size["height"]}
    return {"issues": issues, "stats": stats, "shot": shot_file}


def summarize(metrics_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate collected metrics across screens for the report."""
    agg = {"screens": len(metrics_list), "overflow": 0, "contrast": 0, "tap": 0, "alt": 0}
    for m in metrics_list:
        iss = m.get("issues", {})
        for k in ("overflow", "contrast", "tap", "alt"):
            agg[k] += len(iss.get(k, []))
    return agg
