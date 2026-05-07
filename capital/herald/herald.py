#!/usr/bin/env python3
"""
The Herald — Composes Telegraph, the kingdom's daily paper.
Gathers reports from the Royal Court, ranks findings, and publishes the morning edition.
"""

import os
import sys
import subprocess
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import requests

def _load_telegram_creds() -> tuple:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    env_file = Path.home() / "telegram_notify_service" / ".env"
    if not (token and chat_id) and env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                if k.strip() == "TELEGRAM_BOT_TOKEN":
                    token = token or v.strip()
                if k.strip() == "TELEGRAM_CHAT_ID":
                    chat_id = chat_id or v.strip()
    return token, chat_id

TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID = _load_telegram_creds()


@dataclass
class Finding:
    """A ranked finding to be included in the Telegraph."""
    source: str           # "captain" | "steward" | "quartermaster" | etc.
    severity: str         # "critical" | "high" | "medium" | "low" | "info"
    summary: str          # one-liner for Telegraph
    details: str          # full markdown details
    category: str         # "incident" | "resource" | "service" | etc.
    timestamp: datetime = field(default_factory=datetime.now)
    score: float = 0.0    # computed ranking score

    def __lt__(self, other):
        """Sort by score descending (higher scores first)."""
        return self.score > other.score


class Herald:
    def __init__(self):
        self.council_home = Path.home() / "Kingdom" / "council"
        self.severity_weights = {
            "critical": 100,
            "high": 50,
            "medium": 20,
            "low": 5,
            "info": 1
        }

    def _compute_score(self, severity: str, age_hours: float = 0, source_count: int = 1, total_sources: int = 1) -> float:
        """Compute ranking score for a finding."""
        base = self.severity_weights.get(severity, 1)
        recency_bonus = 1.0 if age_hours < 24 else max(0.1, 2.0 - age_hours / 24)
        source_penalty = 1.0 - (0.1 * source_count / max(1, total_sources))
        return base * recency_bonus * source_penalty

    def _extract_captain_findings(self, text: str) -> List[Finding]:
        """Extract critical/high incidents from Captain's briefing."""
        findings = []
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if "critical" in line.lower() or "incident" in line.lower():
                finding = Finding(
                    source="captain",
                    severity="critical" if "critical" in line.lower() else "high",
                    summary=line[:100],
                    details=line,
                    category="incident"
                )
                findings.append(finding)
        return findings

    def _extract_steward_findings(self, text: str) -> List[Finding]:
        """Extract unhealthy/degraded service status from Steward."""
        findings = []
        lines = text.split("\n")
        for line in lines:
            # Skip summary/header lines (e.g. "**Status:** 4✅ 0⚠️ 2❌") — not per-service findings
            if "Status:" in line or "**" in line:
                continue
            if "❌" in line or "unhealthy" in line.lower():
                finding = Finding(
                    source="steward",
                    severity="critical",
                    summary=line.replace("❌", "").strip()[:100],
                    details=line,
                    category="service"
                )
                findings.append(finding)
            elif "⚠️" in line or "degraded" in line.lower():
                finding = Finding(
                    source="steward",
                    severity="medium",
                    summary=line.replace("⚠️", "").strip()[:100],
                    details=line,
                    category="service"
                )
                findings.append(finding)
        return findings

    def _extract_quartermaster_findings(self, text: str) -> List[Finding]:
        """Extract quota/resource warnings from Quartermaster."""
        findings = []
        seen = set()
        lines = text.split("\n")
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("```"):
                continue
            if "exhaustion" in line.lower() and ("day" in line.lower() or "hour" in line.lower()):
                summary = line[:80]
                if summary not in seen:
                    match = re.search(r'(\d+)\s*days?', line, re.IGNORECASE)
                    days = int(match.group(1)) if match else 0
                    severity = "critical" if days <= 3 else "high" if days <= 7 else "medium"
                    finding = Finding(
                        source="quartermaster",
                        severity=severity,
                        summary=summary,
                        details=line,
                        category="resource"
                    )
                    findings.append(finding)
                    seen.add(summary)
            elif "exceed" in line.lower() or ("full" in line.lower() and "capacity" in line.lower()):
                summary = line[:80]
                if summary not in seen:
                    finding = Finding(
                        source="quartermaster",
                        severity="critical",
                        summary=summary,
                        details=line,
                        category="resource"
                    )
                    findings.append(finding)
                    seen.add(summary)
        return findings

    def _extract_master_of_works_findings(self, text: str) -> List[Finding]:
        """Extract critical resource utilization from Master of Works."""
        findings = []
        lines = text.split("\n")
        for line in lines:
            # Look for percentage utilization
            match = re.search(r'(\w+).*?(\d+)%', line)
            if match:
                resource = match.group(1)
                utilization = int(match.group(2))
                if utilization >= 95:
                    severity = "critical"
                elif utilization >= 85:
                    severity = "high"
                elif utilization >= 75:
                    severity = "medium"
                else:
                    severity = "info"

                if severity in ["critical", "high"]:
                    finding = Finding(
                        source="master_of_works",
                        severity=severity,
                        summary=f"{resource}: {utilization}% utilization",
                        details=line,
                        category="resource"
                    )
                    findings.append(finding)
        return findings

    def _extract_hand_findings(self, text: str) -> List[Finding]:
        """Extract P1/P2 priorities from Hand."""
        findings = []
        lines = text.split("\n")
        for line in lines:
            if "🔴" in line or "[P1]" in line:
                finding = Finding(
                    source="hand",
                    severity="critical",
                    summary=line.replace("🔴", "").replace("[P1]", "").strip()[:100],
                    details=line,
                    category="priority"
                )
                findings.append(finding)
            elif "🟡" in line or "[P2]" in line:
                finding = Finding(
                    source="hand",
                    severity="high",
                    summary=line.replace("🟡", "").replace("[P2]", "").strip()[:100],
                    details=line,
                    category="priority"
                )
                findings.append(finding)
        return findings

    def _rank_findings(self, findings: List[Finding], section: str, limit: int = 3) -> List[Finding]:
        """Rank and filter findings, enforcing source diversity."""
        if not findings:
            return []

        # Compute scores
        source_counts = {}
        for f in findings:
            source_counts[f.source] = source_counts.get(f.source, 0) + 1
        total_sources = len(source_counts)

        for f in findings:
            age_hours = (datetime.now() - f.timestamp).total_seconds() / 3600
            f.score = self._compute_score(f.severity, age_hours, source_counts[f.source], total_sources)

        # Sort by score descending
        findings.sort()

        # Enforce max 2 findings per source
        result = []
        source_used = {}
        for f in findings:
            if source_used.get(f.source, 0) < 2:
                result.append(f)
                source_used[f.source] = source_used.get(f.source, 0) + 1
                if len(result) >= limit:
                    break

        return result

    def gather_briefing(self) -> Dict[str, str]:
        """Gather briefings from all active council members.

        RULE: Every subprocess call here MUST use a read-only subcommand
        (brief/report/scan/status). Never call telegram, send, or any
        subcommand that mutates state or sends external messages.
        Violating this sends duplicate Telegram traffic on every Herald run.
        """
        briefings = {}

        # The Hand's agenda
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-hand-of-the-king", "brief"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                briefings["hand"] = result.stdout
        except Exception as e:
            print(f"Error getting Hand briefing: {e}")

        # The Maester's index
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-maester", "brief"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                briefings["maester"] = result.stdout
        except Exception as e:
            print(f"Error getting Maester briefing: {e}")

        # The Steward's health report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-steward", "report"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                briefings["steward"] = result.stdout
        except Exception as e:
            print(f"Error getting Steward briefing: {e}")

        # The Master of Works' infrastructure report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-master-of-works", "check"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                briefings["master_of_works"] = result.stdout.strip()
        except Exception as e:
            print(f"Error getting Master of Works briefing: {e}")

        # The Quartermaster's resource report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-quartermaster"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                # Strip the JSON block — only keep the markdown section
                text = result.stdout
                json_start = text.find("\n```json")
                if json_start != -1:
                    text = text[:json_start]
                lines = [l for l in text.split("\n") if l and not l.startswith("```")]
                if lines:
                    briefings["quartermaster"] = "\n".join(lines)
        except Exception as e:
            print(f"Error getting Quartermaster briefing: {e}")

        # The Captain's incident report
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-captain-of-the-guard", "scan"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout:
                briefings["captain"] = result.stdout
        except Exception as e:
            print(f"Error getting Captain briefing: {e}")

        # The Master of Whisperers' intelligence report (Arts & Tech)
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-master-of-whisperers", "report"],
                capture_output=True,
                text=True,
                timeout=20,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout.strip():
                briefings["whisperers"] = result.stdout.strip()
        except Exception as e:
            print(f"Error getting Whisperers briefing: {e}")

        # The Castellan's brief (castle cleanliness)
        try:
            result = subprocess.run(
                ["python3", "-m", "council.the-castellan", "brief"],
                capture_output=True,
                text=True,
                timeout=15,
                cwd=os.path.expanduser("~/Kingdom")
            )
            if result.returncode == 0 and result.stdout.strip():
                briefings["castellan"] = result.stdout.strip()
        except Exception as e:
            print(f"Error getting Castellan briefing: {e}")

        return briefings

    def compose_telegraph(self, briefings: Dict[str, str], edition: str = "daily") -> str:
        """Compose the daily Telegraph from council briefings, ranked by urgency."""
        today = datetime.now().strftime("%A, %B %d, %Y")

        lines = [
            "═" * 60,
            "📰 TELEGRAPH — THE KINGDOM'S DAILY PAPER",
            today,
            "═" * 60,
            ""
        ]

        # Extract findings from each source
        all_findings = {
            "incident": [],
            "priority": [],
            "service": [],
            "resource": []
        }

        if "captain" in briefings:
            all_findings["incident"].extend(self._extract_captain_findings(briefings["captain"]))

        if "hand" in briefings:
            all_findings["priority"].extend(self._extract_hand_findings(briefings["hand"]))

        if "steward" in briefings:
            all_findings["service"].extend(self._extract_steward_findings(briefings["steward"]))

        if "master_of_works" in briefings:
            all_findings["resource"].extend(self._extract_master_of_works_findings(briefings["master_of_works"]))

        if "quartermaster" in briefings:
            all_findings["resource"].extend(self._extract_quartermaster_findings(briefings["quartermaster"]))

        # Front Page: Urgent incidents and critical resources
        lines.append("🔴 FRONT PAGE — What Demands Immediate Attention")
        lines.append("")

        critical_incidents = [f for f in all_findings["incident"] if f.severity in ["critical", "high"]]
        critical_resources = [f for f in all_findings["resource"] if f.severity == "critical"]
        critical_services = [f for f in all_findings["service"] if f.severity == "critical"]

        all_critical = critical_incidents + critical_services + critical_resources
        ranked_critical = self._rank_findings(all_critical, "urgent", limit=3)

        if ranked_critical:
            for finding in ranked_critical:
                lines.append(f"  • {finding.summary}")
            lines.append("")
        else:
            lines.append("  ✅ No critical issues detected")
            lines.append("")

        # Today's Agenda
        if "hand" in briefings and all_findings["priority"]:
            lines.append("📋 TODAY'S AGENDA — The Hand's Priorities")
            lines.append("")
            ranked_priorities = self._rank_findings(all_findings["priority"], "priority", limit=3)
            for finding in ranked_priorities:
                lines.append(f"  • {finding.summary}")
            lines.append("")

        # The Long Read: System Health
        lines.append("🏰 THE LONG READ — Castle Status")
        lines.append("")

        ranked_services = self._rank_findings(all_findings["service"], "service", limit=2)
        if ranked_services:
            for finding in ranked_services:
                lines.append(f"  • {finding.summary}")
            lines.append("")
        else:
            lines.append("  ✅ All services healthy")
            lines.append("")

        # Resources & Provisions
        if all_findings["resource"]:
            lines.append("📦 PROVISIONS — Resource Status")
            lines.append("")
            ranked_resources = self._rank_findings(all_findings["resource"], "resource", limit=2)
            for finding in ranked_resources:
                lines.append(f"  • {finding.summary}")
            lines.append("")

        # The Maester's Knowledge
        if "maester" in briefings:
            lines.append("📚 LIBRARY & ARCHIVES — What The Maester Knows")
            lines.append("")
            # Keep Maester as-is (it's knowledge, not urgent)
            maester_brief = "\n".join(line for line in briefings["maester"].split("\n")[:10])
            lines.append(maester_brief)
            lines.append("")

        # Arts & Tech — intelligence from the Master of Whisperers
        if "whisperers" in briefings and briefings["whisperers"]:
            lines.append("👁 ARTS & TECH — Intelligence From Beyond the Walls")
            lines.append("")
            for line in briefings["whisperers"].split("\n")[:12]:
                lines.append(line)
            lines.append("")

        # Castle — Castellan's brief
        if "castellan" in briefings and briefings["castellan"]:
            lines.append("🏰 THE CASTLE")
            lines.append("")
            lines.append(briefings["castellan"])
            lines.append("")

        # Footer
        lines.append("═" * 60)
        total_findings = sum(len(f) for f in all_findings.values())
        lines.append(f"Published by The Herald at {datetime.now().strftime('%H:%M:%S UTC')} ({total_findings} findings)")
        lines.append("═" * 60)

        return "\n".join(lines)

    def send_telegram(self, message: str):
        """Send Telegraph via Telegram."""
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            print("Telegram not configured, skipping send")
            return

        # Split into chunks if too long (Telegram limit ~4096 chars)
        max_len = 4000
        chunks = [message[i:i+max_len] for i in range(0, len(message), max_len)]

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

        for chunk in chunks:
            data = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": chunk,
                "parse_mode": "HTML"
            }
            try:
                requests.post(url, json=data, timeout=10)
            except Exception as e:
                print(f"Failed to send Telegram message: {e}")


def main():
    herald = Herald()

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "compose":
            briefings = herald.gather_briefing()
            paper = herald.compose_telegraph(briefings)
            print(paper)

        elif command == "publish":
            briefings = herald.gather_briefing()
            paper = herald.compose_telegraph(briefings)
            herald.send_telegram(paper)
            print("✅ Telegraph published")

        elif command == "brief":
            briefings = herald.gather_briefing()
            # Short version for agent-to-agent communication
            summary = "📰 Telegraph Brief:\n"
            if "captain" in briefings:
                summary += "🔴 Incidents: " + briefings["captain"].split("\n")[0] + "\n"
            if "steward" in briefings:
                summary += "🏰 Health status available\n"
            if "hand" in briefings:
                summary += "📋 Today's agenda available\n"
            print(summary)

    else:
        briefings = herald.gather_briefing()
        paper = herald.compose_telegraph(briefings)
        print(paper)


if __name__ == "__main__":
    main()
