"""ai_probe.py — preflight probe of the local AI backend (llama.cpp behind MemoryProxy on :8080).

Runs OUTSIDE the browser and records:
  * available models
  * non-stream + stream latency profile (first token vs full)
  * whether replies come back as `content` (app-compatible) or only `reasoning_content`
  * a structured JSON "action engine" prompt attempt (mirrors what Ask-AI sends)
This gives an honest baseline so model quirks are not misattributed to the app.
"""
import json
import time

import requests

AI_BASE = "http://localhost:8080/v1"
MODEL = "Qwen3.8-4B-Q4_K_M.gguf"


def models():
    r = requests.get(f"{AI_BASE}/models", timeout=15)
    r.raise_for_status()
    return r.json()


def _chat(messages, stream=False, max_tokens=900, temperature=0.7, extra=None):
    payload = {"model": MODEL, "messages": messages, "stream": stream,
               "max_tokens": max_tokens, "temperature": temperature}
    if extra:
        payload.update(extra)
    t0 = time.time()
    resp = requests.post(f"{AI_BASE}/chat/completions", json=payload, timeout=420, stream=stream)
    resp.raise_for_status()
    if not stream:
        body = resp.json()
        msg = body["choices"][0]["message"]
        return {
            "latency_s": round(time.time() - t0, 2),
            "content": msg.get("content", ""),
            "reasoning": (msg.get("reasoning_content") or "")[:400],
            "finish": body["choices"][0].get("finish_reason"),
            "usage": body.get("usage", {}),
        }
    # stream: measure time to first content delta
    first_at = None
    full = ""
    reasoning = ""
    finish = None
    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
        except Exception:
            continue
        delta = (chunk.get("choices") or [{}])[0].get("delta", {})
        c = delta.get("content")
        rc = delta.get("reasoning_content")
        if c:
            if first_at is None:
                first_at = time.time()
            full += c
        if rc:
            reasoning += rc
        fr = (chunk.get("choices") or [{}])[0].get("finish_reason")
        if fr:
            finish = fr
    return {
        "first_content_s": round(first_at - t0, 2) if first_at else None,
        "total_s": round(time.time() - t0, 2),
        "content": full,
        "reasoning_len": len(reasoning),
        "finish": finish,
    }


def run(out_path="qa_bot/probe.json"):
    print("AI probe: listing models...")
    m = models()
    ids = [x.get("id") or x.get("name") for x in m.get("data", m.get("models", []))]
    result = {"ai_base": AI_BASE, "model": MODEL, "models": ids, "checks": {}}

    print("AI probe: non-stream chat...")
    ns = _chat([{"role": "user", "content": "Reply with exactly: PONG"}], stream=False, max_tokens=80)
    result["checks"]["non_stream_short"] = ns

    print("AI probe: streaming chat (first-token timing)...")
    st = _chat([{"role": "user", "content": "Write a single sentence about what a personal knowledge graph is."}], stream=True)
    result["checks"]["stream_sentence"] = st

    print("AI probe: structured action JSON attempt...")
    action_prompt = (
        "You are an assistant that executes user requests by returning ONLY a JSON array of actions. "
        'Valid actions: {"action":"create_note","title":"...","content":"..."} or {"action":"create_link","from":"...","to":"..."}. '
        'Do not add commentary. Request: create a note titled "AI Probe Note" with content "Probe content line one." '
        "and link it from \"Welcome to AetherMind\"."
    )
    js = _chat([{"role": "user", "content": action_prompt}], stream=False, max_tokens=700)
    result["checks"]["structured_action"] = js

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=1, default=str)
    print("AI probe saved ->", out_path)
    return result


if __name__ == "__main__":
    run()
