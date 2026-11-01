/**
 * GhostMeta - JPEG Sanitizer
 * Strips EXIF, XMP, IPTC, COM comments, and C2PA (JUMBF / Content Credentials)
 */

export function sanitizeJpeg(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  // Check JPEG SOI (FF D8)
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Invalid JPEG signature');
  }

  const chunks = [];
  // Keep SOI
  chunks.push(bytes.slice(0, 2));

  let offset = 2;
  const len = bytes.length;
  let inScan = false;

  while (offset < len) {
    if (bytes[offset] !== 0xff) {
      // Misaligned marker or scan data
      if (inScan) {
        // Collect remaining bytes until end
        chunks.push(bytes.slice(offset));
        break;
      }
      offset++;
      continue;
    }

    // Skip consecutive 0xFF padding
    while (offset < len && bytes[offset] === 0xff) {
      offset++;
    }
    if (offset >= len) break;

    const marker = bytes[offset++];

    // Standalone markers without payload
    if (marker === 0xd9) { // EOI (End of Image)
      chunks.push(new Uint8Array([0xff, 0xd9]));
      break; // Ignore any junk/watermarks appended after EOI
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(new Uint8Array([0xff, marker]));
      continue;
    }

    if (offset + 1 >= len) break;
    const segLength = (bytes[offset] << 8) | bytes[offset + 1];
    const segEnd = offset + segLength;
    if (segEnd > len) break;

    const markerStart = offset - 2; // Position where FF <marker> was

    // SOS (Start of Scan) - entropy coded data follows
    if (marker === 0xda) {
      inScan = true;
      // Copy SOS and everything up to EOI
      chunks.push(bytes.slice(markerStart, segEnd));
      offset = segEnd;
      // Now scan for EOI in the entropy data
      while (offset < len - 1) {
        if (bytes[offset] === 0xff) {
          if (bytes[offset + 1] === 0xd9) { // EOI
            chunks.push(bytes.slice(segEnd, offset + 2));
            offset += 2;
            break;
          }
        }
        offset++;
      }
      break;
    }

    // Identify and filter metadata markers
    let shouldStrip = false;
    let desc = null;

    if (marker === 0xe1) {
      // APP1: EXIF, XMP, or C2PA
      const header = String.fromCharCode(...bytes.slice(offset + 2, offset + 30));
      if (/c2pa|jumbf/i.test(header)) {
        desc = 'C2PA / Provenance Manifest (APP1)';
      } else if (header.startsWith('Exif')) {
        desc = 'EXIF Metadata (APP1)';
      } else if (header.startsWith('http://') || header.includes('xmp')) {
        desc = 'XMP Data (Adobe/AI) (APP1)';
      } else {
        desc = 'APP1 Metadata';
      }
      shouldStrip = true;
    } else if (marker === 0xeb) {
      // APP11: JUMBF / C2PA Content Credentials Manifests
      desc = 'C2PA / JUMBF AI Provenance Manifest (APP11)';
      shouldStrip = true;
    } else if (marker === 0xed) {
      // APP13: Photoshop IPTC / IRB
      desc = 'IPTC / Photoshop Metadata';
      shouldStrip = true;
    } else if (marker === 0xfe) {
      // COM: Comment
      desc = 'JPEG Comment (COM)';
      shouldStrip = true;
    } else if (marker === 0xe2) {
      // APP2: FlashPix / MPF / ICC
      const header = String.fromCharCode(...bytes.slice(offset + 2, offset + 14));
      if (header.startsWith('FPXR') || header.startsWith('MPF')) {
        desc = 'FlashPix/MPF Metadata';
        shouldStrip = true;
      }
      // Keep ICC_PROFILE for proper color rendering unless stripped
    } else if (marker >= 0xe3 && marker <= 0xef && marker !== 0xee) {
      // APP3..APP15 except APP14 (Adobe color transform)
      desc = `APP${marker - 0xe0} Metadata`;
      shouldStrip = true;
    }

    if (shouldStrip) {
      if (!removed.includes(desc)) {
        removed.push(desc);
      }
    } else {
      // Keep essential image marker (SOF, DQT, DHT, DRI, etc.)
      chunks.push(bytes.slice(markerStart, segEnd));
    }

    offset = segEnd;
  }

  // Ensure EOI is present
  const lastChunk = chunks[chunks.length - 1];
  if (!lastChunk || lastChunk.length < 2 || lastChunk[lastChunk.length - 2] !== 0xff || lastChunk[lastChunk.length - 1] !== 0xd9) {
    chunks.push(new Uint8Array([0xff, 0xd9]));
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
