/**
 * GhostMeta Test Suite
 * Validates metadata & C2PA tag wiping across all supported formats
 */

import assert from 'node:assert';
import { sanitizeJpeg } from '../js/sanitizer/jpeg.js';
import { sanitizePng } from '../js/sanitizer/png.js';
import { sanitizeWebp } from '../js/sanitizer/webp.js';
import { sanitizePdf } from '../js/sanitizer/pdf.js';
import { sanitizeMp4 } from '../js/sanitizer/mp4.js';
import { sanitizeAudio } from '../js/sanitizer/audio.js';
import { sanitizeFile, detectFormat } from '../js/sanitizer/index.js';
import { crc32 } from '../js/sanitizer/crc32.js';

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n--- Running GhostMeta Sanitizer Tests ---\n');

// 1. JPEG Tests
test('JPEG: Strips EXIF, XMP, IPTC, and C2PA (APP11) markers', () => {
  // Construct mock JPEG: SOI + APP1(Exif) + APP11(C2PA) + COM + SOF0 + SOS + EOI
  const parts = [];
  parts.push(new Uint8Array([0xff, 0xd8])); // SOI

  // APP1 (Exif) - len 14
  const exifPayload = [0xff, 0xe1, 0x00, 0x0e, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04];
  parts.push(new Uint8Array(exifPayload));

  // APP11 (C2PA JUMBF manifest) - len 8 (2 len bytes + 6 bytes data)
  const c2paPayload = [0xff, 0xeb, 0x00, 0x08, 0x4a, 0x55, 0x4d, 0x42, 0x46, 0x00];
  parts.push(new Uint8Array(c2paPayload));

  // COM - len 6 (2 len bytes + 4 bytes "test")
  const comPayload = [0xff, 0xfe, 0x00, 0x06, 0x74, 0x65, 0x73, 0x74];
  parts.push(new Uint8Array(comPayload));

  // SOF0 (Frame header) - len 11 (essential)
  const sofPayload = [0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x40, 0x00, 0x40, 0x01, 0x01];
  parts.push(new Uint8Array(sofPayload));

  // SOS (Start of Scan) - len 8
  const sosPayload = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00];
  parts.push(new Uint8Array(sosPayload));

  // Entropy scan data + EOI
  parts.push(new Uint8Array([0x12, 0x34, 0x56, 0xff, 0xd9]));

  const totalLen = parts.reduce((a, b) => a + b.length, 0);
  const jpegBytes = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    jpegBytes.set(p, off);
    off += p.length;
  }

  const { sanitized, removed } = sanitizeJpeg(jpegBytes);

  assert.strictEqual(sanitized[0], 0xff);
  assert.strictEqual(sanitized[1], 0xd8);
  assert.strictEqual(sanitized[sanitized.length - 2], 0xff);
  assert.strictEqual(sanitized[sanitized.length - 1], 0xd9);

  // Check that APP1 and APP11 and COM are gone
  let hasApp1 = false;
  let hasC2pa = false;
  let hasCom = false;
  for (let i = 0; i < sanitized.length - 1; i++) {
    if (sanitized[i] === 0xff) {
      if (sanitized[i + 1] === 0xe1) hasApp1 = true;
      if (sanitized[i + 1] === 0xeb) hasC2pa = true;
      if (sanitized[i + 1] === 0xfe) hasCom = true;
    }
  }
  assert.strictEqual(hasApp1, false, 'APP1 should be removed');
  assert.strictEqual(hasC2pa, false, 'C2PA marker should be removed');
  assert.strictEqual(hasCom, false, 'COM marker should be removed');
  assert(removed.some(r => r.includes('C2PA')), 'Removed list should mention C2PA');
});

// 2. PNG Tests
test('PNG: Strips tEXt, iTXt (C2PA / AI prompts), eXIf, and trailing watermarks', () => {
  const parts = [];
  // PNG Signature
  parts.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

  function makeChunk(typeStr, dataBytes) {
    const len = dataBytes.length;
    const buf = new Uint8Array(12 + len);
    buf[0] = (len >>> 24) & 0xff;
    buf[1] = (len >>> 16) & 0xff;
    buf[2] = (len >>> 8) & 0xff;
    buf[3] = len & 0xff;
    buf[4] = typeStr.charCodeAt(0);
    buf[5] = typeStr.charCodeAt(1);
    buf[6] = typeStr.charCodeAt(2);
    buf[7] = typeStr.charCodeAt(3);
    buf.set(dataBytes, 8);
    const crc = crc32(buf, 4, 4 + len);
    buf[8 + len] = (crc >>> 24) & 0xff;
    buf[9 + len] = (crc >>> 16) & 0xff;
    buf[10 + len] = (crc >>> 8) & 0xff;
    buf[11 + len] = crc & 0xff;
    return buf;
  }

  // IHDR (13 bytes)
  parts.push(makeChunk('IHDR', new Uint8Array([0,0,0,1, 0,0,0,1, 8, 2, 0, 0, 0])));
  // tEXt (AI Prompt)
  parts.push(makeChunk('tEXt', new TextEncoder().encode('prompt\0cyberpunk ghost')));
  // iTXt (C2PA provenance manifest)
  parts.push(makeChunk('iTXt', new TextEncoder().encode('c2pa.manifest\0\0\0\0\0{"c2pa":true}')));
  // eXIf
  parts.push(makeChunk('eXIf', new Uint8Array([1, 2, 3, 4])));
  // IDAT
  parts.push(makeChunk('IDAT', new Uint8Array([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])));
  // IEND
  parts.push(makeChunk('IEND', new Uint8Array([])));
  // Trailing steganography watermark
  parts.push(new TextEncoder().encode('HIDDEN_WATERMARK_TRAIL'));

  const totalLen = parts.reduce((a, b) => a + b.length, 0);
  const pngBytes = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    pngBytes.set(p, off);
    off += p.length;
  }

  const { sanitized, removed } = sanitizePng(pngBytes);

  const text = new TextDecoder('latin1').decode(sanitized);
  assert(!text.includes('tEXt'), 'tEXt should be removed');
  assert(!text.includes('iTXt'), 'iTXt should be removed');
  assert(!text.includes('eXIf'), 'eXIf should be removed');
  assert(!text.includes('HIDDEN_WATERMARK_TRAIL'), 'Trailing watermark should be stripped');
  assert(text.includes('IHDR'), 'IHDR must be preserved');
  assert(text.includes('IDAT'), 'IDAT must be preserved');
  assert(text.includes('IEND'), 'IEND must be preserved');
  assert(removed.some(r => r.includes('tEXt')));
  assert(removed.some(r => r.includes('iTXt')));
});

// 3. WebP Tests
test('WebP: Strips EXIF, XMP, and C2PA chunks, updates VP8X flags', () => {
  const parts = [];
  // RIFF header placeholder (12 bytes)
  parts.push(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]));

  // VP8X with flags: EXIF (0x08) + XMP (0x04) set -> 0x0c
  const vp8xPayload = new Uint8Array([0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  parts.push(new Uint8Array([0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, ...vp8xPayload]));

  // EXIF chunk
  parts.push(new Uint8Array([0x45, 0x58, 0x49, 0x46, 4, 0, 0, 0, 1, 2, 3, 4]));

  // XMP chunk
  parts.push(new Uint8Array([0x58, 0x4d, 0x50, 0x20, 4, 0, 0, 0, 5, 6, 7, 8]));

  // VP8 image chunk
  parts.push(new Uint8Array([0x56, 0x50, 0x38, 0x20, 4, 0, 0, 0, 9, 10, 11, 12]));

  const totalLen = parts.reduce((a, b) => a + b.length, 0);
  const webpBytes = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    webpBytes.set(p, off);
    off += p.length;
  }

  const { sanitized, removed } = sanitizeWebp(webpBytes);
  const text = new TextDecoder('latin1').decode(sanitized);

  assert(!text.includes('EXIF'), 'EXIF chunk should be removed');
  assert(!text.includes('XMP '), 'XMP chunk should be removed');
  assert(text.includes('VP8 '), 'VP8 image data must remain');

  // Check VP8X flag was cleared (bits 0x08 and 0x04 cleared)
  const vp8xIndex = text.indexOf('VP8X');
  assert(vp8xIndex !== -1);
  const flagByte = sanitized[vp8xIndex + 8];
  assert.strictEqual(flagByte & 0x0c, 0, 'EXIF and XMP bits in VP8X should be 0');
});

// 4. PDF Tests
test('PDF: Strips /Metadata streams and /Info author tags', () => {
  const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R /Metadata 3 0 R >>
endobj
3 0 obj
<< /Type /Metadata /Subtype /XML >>
stream
<?xpacket begin="test"?>
<c2pa:manifest>PROVENANCE</c2pa:manifest>
<?xpacket end="w"?>
endstream
endobj
trailer
<< /Root 1 0 R /Info 4 0 R >>
%%EOF`;

  const pdfBytes = new TextEncoder().encode(samplePdf);
  const { sanitized, removed } = sanitizePdf(pdfBytes);
  const text = new TextDecoder('latin1').decode(sanitized);

  assert(!text.includes('/Metadata 3 0 R'), '/Metadata ref should be blanked');
  assert(!text.includes('<c2pa:manifest>'), 'XMP c2pa content should be blanked');
  assert(!text.includes('/Info 4 0 R'), '/Info ref should be blanked');
  assert(removed.some(r => r.includes('Metadata')));
});

// 5. MP4 Tests
test('MP4: Strips C2PA box and udta metadata', () => {
  function makeBox(type, payload) {
    const size = 8 + payload.length;
    const buf = new Uint8Array(size);
    buf[0] = (size >>> 24) & 0xff;
    buf[1] = (size >>> 16) & 0xff;
    buf[2] = (size >>> 8) & 0xff;
    buf[3] = size & 0xff;
    for (let i = 0; i < 4; i++) buf[4 + i] = type.charCodeAt(i);
    buf.set(payload, 8);
    return buf;
  }

  const ftyp = makeBox('ftyp', new Uint8Array([0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 1]));
  const c2pa = makeBox('c2pa', new TextEncoder().encode('C2PA_VIDEO_MANIFEST'));
  const udta = makeBox('udta', new TextEncoder().encode('GPS_COORDINATES_AND_AUTHOR'));
  const moovInner = makeBox('mvhd', new Uint8Array(24)); // mvhd
  const moov = makeBox('moov', moovInner);
  const mdat = makeBox('mdat', new Uint8Array([1, 2, 3, 4]));

  const mp4Bytes = new Uint8Array(ftyp.length + c2pa.length + udta.length + moov.length + mdat.length);
  let off = 0;
  for (const b of [ftyp, c2pa, udta, moov, mdat]) {
    mp4Bytes.set(b, off);
    off += b.length;
  }

  const { sanitized, removed } = sanitizeMp4(mp4Bytes);
  const text = new TextDecoder('latin1').decode(sanitized);

  assert(!text.includes('c2pa'), 'c2pa box should be stripped');
  assert(!text.includes('udta'), 'udta box should be stripped');
  assert(text.includes('ftyp'), 'ftyp must remain');
  assert(text.includes('moov'), 'moov must remain');
  assert(text.includes('mdat'), 'mdat must remain');
  assert(removed.some(r => r.includes('C2PA')));
});

// 6. Audio Tests
test('Audio (MP3): Strips ID3v2 and ID3v1 tags', () => {
  // ID3v2 header: "ID3" + v2.3 (03 00) + flags (00) + syncsafe size (00 00 00 04) -> 4 bytes payload
  const id3v2 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x54, 0x49, 0x54, 0x32]);
  const audioData = new Uint8Array([0xff, 0xfb, 0x90, 0x44, 0x00, 0x00]); // MP3 frame sync
  // ID3v1 tag: 128 bytes starting with "TAG"
  const id3v1 = new Uint8Array(128);
  id3v1[0] = 0x54; id3v1[1] = 0x41; id3v1[2] = 0x47; // "TAG"

  const mp3Bytes = new Uint8Array(id3v2.length + audioData.length + id3v1.length);
  mp3Bytes.set(id3v2, 0);
  mp3Bytes.set(audioData, id3v2.length);
  mp3Bytes.set(id3v1, id3v2.length + audioData.length);

  const { sanitized, removed } = sanitizeAudio(mp3Bytes);

  assert.strictEqual(sanitized[0], 0xff);
  assert.strictEqual(sanitized[1], 0xfb);
  assert.strictEqual(sanitized.length, audioData.length);
  assert(removed.some(r => r.includes('ID3v2')));
  assert(removed.some(r => r.includes('ID3v1')));
});

// 7. Unified Dispatcher Test
test('Unified dispatcher: detects format and reports C2PA tag detection', () => {
  // PNG with C2PA in iTXt
  const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdrLen = [0, 0, 0, 13, 73, 72, 68, 82, 0,0,0,1, 0,0,0,1, 8,2,0,0,0, 0x90, 0x77, 0x53, 0xde];
  const itxtPayload = new TextEncoder().encode('c2pa\0\0\0\0\0content-credentials');
  const itxtChunk = new Uint8Array(12 + itxtPayload.length);
  itxtChunk[3] = itxtPayload.length;
  itxtChunk[4] = 105; itxtChunk[5] = 84; itxtChunk[6] = 88; itxtChunk[7] = 116;
  itxtChunk.set(itxtPayload, 8);
  const iendChunk = [0, 0, 0, 0, 73, 69, 78, 68, 0xae, 0x42, 0x60, 0x82];

  const buf = new Uint8Array(pngSig.length + ihdrLen.length + itxtChunk.length + iendChunk.length);
  let o = 0;
  for (const c of [pngSig, ihdrLen, itxtChunk, iendChunk]) {
    buf.set(c, o);
    o += c.length;
  }

  const result = sanitizeFile(buf, 'photo.png');
  assert.strictEqual(result.format, 'png');
  assert.strictEqual(result.hasC2PA, true);
  assert(result.savedBytes > 0);
  assert(result.sanitizedSize < result.originalSize);
});

console.log(`\nResults: ${passed}/${total} tests passed.\n`);
if (passed !== total) {
  process.exit(1);
}
