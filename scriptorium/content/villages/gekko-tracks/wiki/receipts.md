# Receipts & OCR

Receipts are a parallel system that runs alongside transaction classification — from the moment a card is swiped to the moment Finance signs the batch off. This page covers how receipt OCR works, what the standard operating procedure is, and what to do when things go wrong.

## Standard operating procedure

1. **Upload or photograph** the receipt (phone camera or file upload on desktop).
2. **Hit Extract** — the server runs OCR and stores the extracted text against the receipt.
3. **Match** — the system auto-scores the receipt against open transactions. High-confidence matches attach automatically; low-confidence ones land in the manual-review queue for the cardholder to confirm.

That's it. No manual OCR step, no tool to choose.

## OCR engine stack

The system tries three engines in order, falling back automatically if one fails or is unreachable:

| Priority | Engine | Where it runs | When it's used |
|---|---|---|---|
| 1 | **glm-ocr** (visual model) | gkgpu-01 via Ollama | Always attempted first |
| 2 | **Claude Vision** | Anthropic API | If Ollama is unreachable and `CLAUDE_OCR_ENABLE=1` |
| 3 | **Tesseract** | gvdi-30 (local) | Final fallback — always available |

**glm-ocr is the default.** It runs on the RTX 4060 on gkgpu-01 and produces noticeably better results on phone photos of receipts — tilted images, poor lighting, thermal paper — compared to Tesseract. For clean digital PDFs (e.g. a LinkedIn invoice), the difference is smaller.

Tesseract is always available locally, so a receipt will never fail to extract — it just may be lower quality if gkgpu-01 is down.

## gkgpu-01 dependency

The glm-ocr engine runs as an Ollama service on gkgpu-01 (`192.168.0.59`). It is configured to start on boot (`systemctl enable ollama`).

If gkgpu-01 is shut down, unreachable, or restarting, OCR falls back to Tesseract silently. No alert fires, no user action is required — the system degrades gracefully. Quality of results on blurry/photo receipts will be lower until gkgpu-01 is back.

To check Ollama status on gkgpu-01:
```bash
ssh gkgpu-01 'systemctl is-active ollama && nvidia-smi --query-gpu=name,memory.free --format=csv,noheader'
```

To restart it if needed (requires sudo on gkgpu-01):
```bash
sudo systemctl restart ollama
```

## Re-extracting receipts with wrong amounts

Receipts that were OCR'd before glm-ocr was set up may have incorrect extracted amounts. The stored OCR text is not updated automatically — someone needs to trigger a fresh extract.

To fix an individual receipt: open the receipt in Gekko Tracks → **hit Extract again**. The system re-runs the full OCR chain and overwrites the stored text. The receipt can then be re-matched.

The most common symptom of a bad OCR read is a receipt matching to a transaction with a significantly different amount (e.g. `$260.10` showing as `$2,760.10` due to Tesseract merging adjacent characters).

## Why some receipts still look garbled

glm-ocr improves on Tesseract for most phone photos, but it does not fix:
- **Genuinely illegible source images** — very blurry, heavily overexposed, or physically damaged receipts
- **Very low resolution scans** — small print on thermal paper photographed from far away

In those cases, the cardholder needs to re-photograph the receipt more clearly before re-extracting.

## Env vars (backend .env)

| Variable | Purpose | Default |
|---|---|---|
| `OLLAMA_OCR_URL` | Ollama base URL for glm-ocr | *(unset = skip Ollama)* |
| `OLLAMA_OCR_MODEL` | Model name to use | `glm-ocr:q8_0` |
| `CLAUDE_OCR_ENABLE` | Enable Claude Vision as second fallback | `0` |
| `CLAUDE_OCR_MODEL` | Claude model for Vision OCR | `claude-haiku-4-5-20251001` |

Current production values are set in `/home/lauchlandupreez/Operations/Gekko-Tracks/backend/.env`.
