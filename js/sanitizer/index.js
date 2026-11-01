/**
 * GhostMeta - Unified Sanitizer Dispatcher
 * Automatically detects format, strips metadata & C2PA tags, and returns sanitized buffer
 */

import { sanitizeJpeg } from './jpeg.js';
import { sanitizePng } from './png.js';
import { sanitizeWebp } from './webp.js';
import { sanitizePdf } from './pdf.js';
import { sanitizeMp4 } from './mp4.js';
import { sanitizeAudio } from './audio.js';

export function detectFormat(bytes, filename = '') {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: 'jpeg', mime: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: 'png', mime: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { format: 'webp', mime: 'image/webp', ext: 'webp' };
  }
  if (bytes.length >= 5 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { format: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  }
  if (bytes.length >= 8 &&
      (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' ||
       String.fromCharCode(...bytes.slice(4, 8)) === 'moov')) {
    return { format: 'mp4', mime: 'video/mp4', ext: 'mp4' };
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { format: 'mp3', mime: 'audio/mpeg', ext: 'mp3' };
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    return { format: 'wav', mime: 'audio/wav', ext: 'wav' };
  }
  if (bytes.length >= 4 &&
      bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { format: 'flac', mime: 'audio/flac', ext: 'flac' };
  }

  // Fallback to filename extension
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg'].includes(ext)) return { format: 'jpeg', mime: 'image/jpeg', ext: 'jpg' };
  if (ext === 'png') return { format: 'png', mime: 'image/png', ext: 'png' };
  if (ext === 'webp') return { format: 'webp', mime: 'image/webp', ext: 'webp' };
  if (ext === 'pdf') return { format: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  if (['mp4', 'mov', 'm4v'].includes(ext)) return { format: 'mp4', mime: 'video/mp4', ext: ext };
  if (ext === 'mp3') return { format: 'mp3', mime: 'audio/mpeg', ext: 'mp3' };
  if (ext === 'wav') return { format: 'wav', mime: 'audio/wav', ext: 'wav' };
  if (ext === 'flac') return { format: 'flac', mime: 'audio/flac', ext: 'flac' };

  return null;
}

export function sanitizeFile(data, filename = '') {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const detected = detectFormat(bytes, filename);

  if (!detected) {
    throw new Error(`Unsupported or unrecognized format for "${filename || 'file'}"`);
  }

  let result;
  switch (detected.format) {
    case 'jpeg':
      result = sanitizeJpeg(bytes);
      break;
    case 'png':
      result = sanitizePng(bytes);
      break;
    case 'webp':
      result = sanitizeWebp(bytes);
      break;
    case 'pdf':
      result = sanitizePdf(bytes);
      break;
    case 'mp4':
      result = sanitizeMp4(bytes);
      break;
    case 'mp3':
    case 'wav':
    case 'flac':
      result = sanitizeAudio(bytes);
      break;
    default:
      throw new Error(`Sanitizer not found for format: ${detected.format}`);
  }

  const hasC2PA = result.removed.some(r => /c2pa|jumb|provenance/i.test(r));

  return {
    sanitized: result.sanitized,
    removed: result.removed,
    originalSize: bytes.length,
    sanitizedSize: result.sanitized.length,
    savedBytes: Math.max(0, bytes.length - result.sanitized.length),
    format: detected.format,
    mime: detected.mime,
    ext: detected.ext,
    hasC2PA
  };
}
