/**
 * GhostMeta - PNG Sanitizer
 * Strips tEXt, zTXt, iTXt (AI Prompts & Workflows), eXIf, tIME, c2pa, and post-IEND data
 */

import { crc32 } from './crc32.js';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export function sanitizePng(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  // Verify PNG signature
  if (bytes.length < 8) {
    throw new Error('File too short to be a valid PNG');
  }
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature');
    }
  }

  const chunks = [];
  // Keep PNG 8-byte header
  chunks.push(bytes.slice(0, 8));

  let offset = 8;
  const len = bytes.length;
  let reachedIEnd = false;

  while (offset + 8 <= len && !reachedIEnd) {
    const chunkLength =
      ((bytes[offset] << 24) |
       (bytes[offset + 1] << 16) |
       (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>> 0;

    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const chunkType = String.fromCharCode(...typeBytes);

    const chunkTotalSize = 12 + chunkLength; // 4 len + 4 type + data + 4 crc
    if (offset + chunkTotalSize > len) {
      break; // Truncated chunk
    }

    let shouldStrip = false;
    let desc = null;

    if (chunkType === 'tEXt') {
      desc = 'tEXt (AI Prompts / Text Metadata)';
      shouldStrip = true;
    } else if (chunkType === 'zTXt') {
      desc = 'zTXt (Compressed AI Prompts / Workflows)';
      shouldStrip = true;
    } else if (chunkType === 'iTXt') {
      desc = 'iTXt (XMP / C2PA / International Metadata)';
      shouldStrip = true;
    } else if (chunkType === 'eXIf') {
      desc = 'eXIf (EXIF Camera & GPS Data)';
      shouldStrip = true;
    } else if (chunkType === 'tIME') {
      desc = 'tIME (File Modification Timestamp)';
      shouldStrip = true;
    } else if (chunkType === 'dSIG') {
      desc = 'dSIG (Digital Signature)';
      shouldStrip = true;
    } else if (chunkType.toLowerCase() === 'c2pa' || chunkType.toLowerCase() === 'jumb') {
      desc = 'C2PA AI Provenance Chunk';
      shouldStrip = true;
    }

    if (chunkType === 'IEND') {
      reachedIEnd = true;
    }

    if (shouldStrip) {
      if (!removed.includes(desc)) {
        removed.push(desc);
      }
    } else {
      // Keep valid chunk
      chunks.push(bytes.slice(offset, offset + chunkTotalSize));
    }

    offset += chunkTotalSize;
  }

  if (offset < len) {
    removed.push('Trailing data after IEND (Steganography / Watermark)');
  }

  // Calculate total size and assemble
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const sanitized = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const c of chunks) {
    sanitized.set(c, writeOffset);
    writeOffset += c.length;
  }

  return { sanitized, removed };
}
