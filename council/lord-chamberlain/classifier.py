"""Claude classification for The Lord Chamberlain."""

from __future__ import annotations

import json
import logging
import os

import anthropic

log = logging.getLogger(__name__)

_SYSTEM = """You are Lord Chamberlain, the intake officer for the Gekko Digital team.
You classify inbound work requests and route them to the right place.
Respond with a JSON object only — no prose outside the JSON:
{
  "classification": "bug|feature|support|internal-tool|it-request|rd-idea|unclear",
  "priority": "High|Medium|Low",
  "confidence": "high|medium|low",
  "reasoning": "One paragraph explaining the classification decision."
}"""


def classify(task: dict) -> dict:
    """Classify a task using Claude Sonnet.

    Returns a dict with classification, priority, confidence, reasoning.
    Falls back to a safe 'unclear' result on any error.
    """
    name = task.get("name", "")
    notes = task.get("notes", "") or "(none)"
    user_content = f"Task: {name}\n\nNotes: {notes}"

    fallback = {
        "classification": "unclear",
        "priority": "Medium",
        "confidence": "low",
        "reasoning": "Classification failed — Claude response could not be parsed.",
    }

    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=512,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_content}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown fences if Claude wraps the JSON
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                l for l in lines if not l.startswith("```")
            )

        result = json.loads(raw)

        valid_classifications = {"bug", "feature", "support", "internal-tool", "it-request", "rd-idea", "unclear"}
        if result.get("classification") not in valid_classifications:
            log.warning("Claude returned unknown classification '%s'", result.get("classification"))
            result["classification"] = "unclear"

        return result

    except json.JSONDecodeError as exc:
        log.error("Could not parse Claude response as JSON: %s", exc)
        return fallback
    except Exception as exc:
        log.error("Claude classification failed: %s", exc)
        return fallback
