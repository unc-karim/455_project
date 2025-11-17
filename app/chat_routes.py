"""
Chatbot route for the ECC expert assistant.

Uses a lightweight HTTP call to OpenRouter so the browser never sees the API key.
"""

import os
from typing import List, Dict, Any

import requests
from flask import jsonify, request


SYSTEM_PROMPT = (
    "You are the Elliptic Curve Calculator assistant. You must only answer questions about "
    "elliptic-curve cryptography or this site’s features. If asked about anything unrelated, "
    "politely decline and redirect to ECC topics.\n\n"
    "Site context: an educational ECC dashboard with curve initialization (custom a,b,p or presets "
    "like secp256k1-like, P-256-like, E23/E31/E47/E97/E127), point discovery, modular/real visualizations, "
    "point addition and scalar multiplication, Diffie-Hellman demo, discrete logarithm demo, encryption/decryption "
    "workflow, history/export, tutorials, theme toggle, keyboard help, and menu/profile panels.\n\n"
    "Style: be concise, step-by-step, prefer plain language with small numeric examples where helpful, "
    "keep answers brief and actionable."
)


def _coerce_messages(data: Any) -> List[Dict[str, str]]:
    """Return a sanitized list of chat messages from the request payload."""
    if not isinstance(data, list):
        return []

    cleaned: List[Dict[str, str]] = []
    for item in data[-10:]:  # keep recent history only
        role = item.get("role") if isinstance(item, dict) else None
        content = item.get("content") if isinstance(item, dict) else None
        if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
            cleaned.append({"role": role, "content": content.strip()})
    return cleaned


def _post_chat(payload: Dict[str, Any], api_key: str, base_url: str) -> str:
    """Send the chat payload to OpenRouter and return reply text."""
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": request.host_url.rstrip("/"),
        "X-Title": "Elliptic Curve Calculator",
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    choice = data.get("choices", [{}])[0]
    message = choice.get("message", {}) if isinstance(choice, dict) else {}
    content = message.get("content") or ""
    return content or "No reply received."


def register_chat_routes(app):
    @app.route("/api/chatbot", methods=["POST"])
    def chatbot():
        """Proxy chatbot requests to OpenRouter using the server-side API key."""
        api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
        if not api_key:
            return jsonify({"success": False, "error": "Missing OpenRouter API key"}), 500

        data = request.get_json(silent=True) or {}
        user_message = (data.get("message") or "").strip()
        history = _coerce_messages(data.get("messages", []))

        if not user_message and not history:
            return jsonify({"success": False, "error": "Message is required"}), 400

        # Always prepend ECC system context
        chat_messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
        chat_messages.extend(history)
        if user_message:
            chat_messages.append({"role": "user", "content": user_message})

        payload = {
            "model": data.get("model") or "openai/gpt-4o-mini",
            "messages": chat_messages,
            "max_tokens": 600,
            "temperature": 0.2,
        }

        api_url = (os.getenv("OPENROUTER_API_BASE") or "https://openrouter.ai/api/v1").strip()

        try:
            reply = _post_chat(payload, api_key, api_url)
            return jsonify({"success": True, "reply": reply})
        except requests.exceptions.Timeout:
            return jsonify({"success": False, "error": "OpenRouter timeout, try again"}), 504
        except requests.exceptions.HTTPError as exc:
            resp = exc.response
            status = resp.status_code if resp is not None else None
            try:
                text = resp.text or ""
            except Exception:
                text = ""

            if status == 401:
                return jsonify({
                    "success": False,
                    "error": "OpenRouter rejected the API key (401). Check that OPENROUTER_API_KEY is correct and active."
                }), 502

            return jsonify({"success": False, "error": f"OpenRouter HTTP {status}: {text}"}), 502
        except requests.exceptions.RequestException as exc:
            msg = str(exc)
            if "Failed to resolve" in msg or "Name or service not known" in msg:
                return jsonify({
                    "success": False,
                    "error": "DNS resolution failed for OpenRouter. Check internet/DNS or set OPENROUTER_API_BASE to a reachable host."
                }), 502
            return jsonify({"success": False, "error": f"OpenRouter connection error: {msg}"}), 502
        except Exception as exc:  # pylint: disable=broad-except
            return jsonify({"success": False, "error": str(exc)}), 502
