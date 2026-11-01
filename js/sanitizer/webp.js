/**
 * GhostMeta - WebP Sanitizer
 * Strips EXIF, XMP, and C2PA metadata chunks from WebP RIFF files
 */

export function sanitizeWebp(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  if (bytes.length < 12) {
    throw new Error('File too short to be a valid WebP');
  }

  const magic = String.fromCharCode(...bytes.slice(0, 4));
  const type = String.fromCharCode(...bytes.slice(8, 12));

  if (magic !== 'RIFF' || type !== 'WEBP') {
    throw new Error('Invalid WebP signature (RIFF/WEBP)');
  }

  const chunks = [];
  let offset = 12;
  const len = bytes.length;
  let vp8xChunk = null;

  while (offset + 8 <= len) {
    const fourCC = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const chunkSize =
      bytes[offset + 4] |
      (bytes[offset + 5] << 8) |
      (bytes[offset + 6] << 16) |
      (bytes[offset + 7] << 24);

    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkTotalSize = 8 + paddedSize;

    if (offset + 8 + chunkSize > len) {
      break;
    }

    let shouldStrip = false;
    let desc = null;

    if (fourCC === 'EXIF') {
      desc = 'WebP EXIF Metadata';
      shouldStrip = true;
    } else if (fourCC === 'XMP ') {
      desc = 'WebP XMP Metadata';
      shouldStrip = true;
    } else if (fourCC.toLowerCase() === 'c2pa') {
      desc = 'WebP C2PA AI Provenance';
      shouldStrip = true;
    }

    if (shouldStrip) {
      if (!removed.includes(desc)) {
        removed.push(desc);
      }
    } else {
      const chunkData = bytes.slice(offset, offset + chunkTotalSize);
      if (fourCC === 'VP8X') {
        vp8xChunk = chunkData;
      }
      chunks.push(chunkData);
    }

    offset += chunkTotalSize;
  }

  // If we had a VP8X header and stripped EXIF or XMP, update the VP8X flag bits
  if (vp8xChunk && vp8xChunk.length >= 18) {
    // Flag byte is at offset 8 (after 4 byte FourCC and 4 byte size)
    // Bit 2 (0x04) is XMP, Bit 3 (0x08) is EXIF
    vp8xChunk[8] &= ~(0x04 | 0x08);
  }

  // Calculate new total size: 12 (RIFF header) + sum of kept chunks
  const keptChunksLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const totalLength = 12 + keptChunksLength;
  const sanitized = new Uint8Array(totalLength);

  // Write RIFF header
  sanitized.set(bytes.slice(0, 4), 0); // 'RIFF'
  const riffSize = totalLength - 8;
  sanitized[4] = riffSize & 0xff;
  sanitized[5] = (riffSize >> 8) & 0xff;
  sanitized[6] = (riffSize >> 16) & 0xff;
  sanitized[7] = (riffSize >> 24) & 0xff;
  sanitized.set(bytes.slice(8, 12), 8); // 'WEBP'

  let writeOffset = 12;
  for (const c of chunks) {
    sanitized.set(c, writeOffset);
    writeOffset += c.length;
  }

  return { sanitized, removed };
}
