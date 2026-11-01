# GhostMeta 👻

> **Zero-Trace Metadata & C2PA Provenance Eraser**  
> Lightweight, local-first, zero-trace privacy tool to strip surveillance metadata, EXIF tags, generative AI prompts, and **C2PA / Content Credentials** manifests from photos, videos, audio, and documents.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Zero Network Transfer](https://img.shields.io/badge/Privacy-100%25%20Local-blue.svg)](#privacy--zero-trace)
[![Tests Passing](https://img.shields.io/badge/Tests-7%2F7%20passing-success.svg)](#testing)

---

## 🎯 Why GhostMeta?

Major AI platforms, camera manufacturers, and operating systems automatically embed tracking metadata and provenance records into files:
- **C2PA / Content Credentials** (Adobe, OpenAI, Midjourney, Google, TikTok, Leica) embed cryptographically signed JUMBF manifests detailing when, where, and how an asset was generated or edited.
- **AI Generators** (Stable Diffusion, ComfyUI, Automatic1111) write your exact prompts, negative prompts, seed numbers, and model hashes directly into image chunks.
- **Smartphones & Cameras** embed exact GPS coordinates, camera serial numbers, lens models, and timestamp signatures into EXIF/XMP blocks.
- **Video & Audio** containers store track modification histories, Apple quicktime user tags, and author identifiers.

**GhostMeta strips these records bit-by-bit at the binary level without re-encoding or degrading media quality.**

---

## 🛡️ Supported Formats & Sanitization

| Media Type | Formats | What Gets Stripped |
| :--- | :--- | :--- |
| **Photos & Images** | `.jpg`, `.jpeg` | `APP11` (JUMBF / C2PA Manifests), `APP1` (EXIF, XMP, GPS), `APP13` (IPTC/Photoshop), `COM` comments, non-essential APP markers |
| **PNG Images & AI** | `.png` | `tEXt`, `zTXt`, `iTXt` (Prompts, ComfyUI node graphs, A1111 workflows), `eXIf`, `tIME`, `c2pa` chunks, and post-`IEND` steganographic trailing bytes |
| **WebP Images** | `.webp` | `EXIF`, `XMP`, `c2pa` chunks, with header bitflags (`VP8X`) automatically recalculated |
| **Movies & Video** | `.mp4`, `.mov`, `.m4v` | ISO-BMFF `c2pa` boxes, `uuid` metadata boxes, `udta` (User Data, Apple tags, GPS), and creation/modification timestamps in `mvhd`/`tkhd` reset to 0 |
| **Audio Files** | `.mp3`, `.wav`, `.flac` | ID3v1, ID3v2, APE tags, RIFF `LIST INFO` chunks, Vorbis comments, and embedded album art pictures |
| **Documents** | `.pdf` | `/Metadata` XMP streams, `/Info` author/creator dictionaries, and embedded `<?xpacket?>` provenance blocks |

---

## 🚀 Quick Start

GhostMeta runs completely offline with zero external build tools.

### Option 1: Run with Node.js
```bash
npm start
```
Open **[http://localhost:8780](http://localhost:8780)** in your browser.

### Option 2: Run with Python
```bash
python serve.py
```
Open **[http://localhost:8780](http://localhost:8780)** in your browser.

---

## 🧪 Testing

Run the automated test suite verifying byte-level sanitization across all formats:

```bash
npm test
# or
node test/run-tests.js
```

---

## 🔒 Privacy & Zero-Trace Guarantee

- **100% Client-Side / Local**: Processing takes place directly in your browser session using native typed arrays (`Uint8Array`). Not a single byte leaves your machine.
- **Lossless Sanitization**: GhostMeta directly parses container structures and strips metadata chunks rather than drawing onto a canvas or re-compressing lossy data. Video frames and photo pixel matrices remain completely bit-identical.
- **C2PA Invalidation**: Once JUMBF boxes and assertions are pruned, public C2PA validators (such as CAI's *Verify*) will detect no provenance record or cryptographic signature.

---

## 📁 Repository Structure

```
GhostMeta/
├── index.html              # Modern dark-theme UI with multi-file drag & drop
├── css/
│   └── styles.css          # Responsive design & status animations
├── js/
│   ├── app.js              # Application logic & ZIP batch downloader
│   ├── lib/
│   │   └── jszip.min.js    # Client-side ZIP packager
│   └── sanitizer/
│       ├── crc32.js        # Fast CRC32 recalculator for PNG chunks
│       ├── jpeg.js         # JPEG segment parser & C2PA stripper
│       ├── png.js          # PNG chunk filter (prompts, C2PA, eXIf, trailing bytes)
│       ├── webp.js         # RIFF WebP parser & VP8X flag adjuster
│       ├── mp4.js          # ISO-BMFF MP4/MOV box filter (c2pa, uuid, udta)
│       ├── pdf.js          # PDF /Metadata and /Info neutralizer
│       ├── audio.js        # Audio tag stripper (ID3, WAV INFO, FLAC Vorbis)
│       └── index.js        # Format auto-detection & unified dispatcher
├── server.js               # Zero-dependency local Node.js server (port 8780)
├── serve.py                # Zero-dependency local Python server (port 8780)
└── test/
    └── run-tests.js        # Comprehensive unit test suite
```

---

## ⚖️ License

[MIT](LICENSE)
