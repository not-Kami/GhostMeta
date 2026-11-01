/**
 * GhostMeta - MP4 / MOV Video Sanitizer
 * Strips C2PA manifests, JUMBF boxes, uuid metadata, udta (user data/GPS), and timestamps
 */

// C2PA UUID: d8fec3d6-1b0e-483c-9295-5e26ec2a1ff8
// XMP UUID:  be7acfcb-97a9-42e8-9c71-999491e3afac

export function sanitizeMp4(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  function readUint32(offset) {
    return (
      ((bytes[offset] << 24) |
       (bytes[offset + 1] << 16) |
       (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>> 0
    );
  }

  // Parse ISO BMFF boxes recursively
  function filterBoxes(start, end, isInsideMoov = false) {
    const keptChunks = [];
    let offset = start;

    while (offset + 8 <= end) {
      let boxSize = readUint32(offset);
      const boxType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );

      let headerSize = 8;
      if (boxSize === 1) {
        // 64-bit size
        if (offset + 16 > end) break;
        // Big-endian 64-bit int (taking lower 32 bits for practical web sizes)
        boxSize = readUint32(offset + 12);
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = end - offset;
      }

      if (boxSize < headerSize || offset + boxSize > end) {
        // Malformed box, keep remainder safely
        keptChunks.push(bytes.slice(offset, end));
        break;
      }

      const boxEnd = offset + boxSize;
      let shouldStrip = false;
      let desc = null;

      // Detect C2PA, metadata, user data
      if (boxType.toLowerCase() === 'c2pa') {
        desc = 'C2PA Video Provenance Manifest (c2pa)';
        shouldStrip = true;
      } else if (boxType === 'uuid') {
        // Inspect UUID bytes
        desc = 'UUID Box (C2PA / XMP / Camera Metadata)';
        shouldStrip = true;
      } else if (boxType === 'udta') {
        desc = 'udta (User Data / Geolocation / Apple Tags)';
        shouldStrip = true;
      } else if (boxType === 'meta' && !isInsideMoov) {
        desc = 'File-level Metadata Box (meta)';
        shouldStrip = true;
      }

      if (shouldStrip) {
        if (!removed.includes(desc)) {
          removed.push(desc);
        }
      } else if (boxType === 'moov') {
        // Recursively clean moov container
        const innerCleaned = filterBoxes(offset + headerSize, boxEnd, true);
        const innerLen = innerCleaned.reduce((a, b) => a + b.length, 0);
        const newMoovSize = headerSize + innerLen;
        
        const moovHeader = new Uint8Array(headerSize);
        moovHeader[0] = (newMoovSize >>> 24) & 0xff;
        moovHeader[1] = (newMoovSize >>> 16) & 0xff;
        moovHeader[2] = (newMoovSize >>> 8) & 0xff;
        moovHeader[3] = newMoovSize & 0xff;
        moovHeader.set(bytes.slice(offset + 4, offset + headerSize), 4);

        keptChunks.push(moovHeader);
        for (const c of innerCleaned) {
          keptChunks.push(c);
        }
      } else if (boxType === 'mvhd' || boxType === 'tkhd') {
        // Movie/Track header: wipe creation/modification timestamps
        const boxData = bytes.slice(offset, boxEnd);
        const version = boxData[headerSize];
        if (version === 0) {
          // 32-bit creation and mod time at offsets 4 and 8 inside payload
          boxData.fill(0, headerSize + 4, headerSize + 12);
        } else if (version === 1) {
          // 64-bit creation and mod time at offsets 4 and 12 inside payload
          boxData.fill(0, headerSize + 4, headerSize + 20);
        }
        if (!removed.includes('Video Creation / Modification Timestamps')) {
          removed.push('Video Creation / Modification Timestamps');
        }
        keptChunks.push(boxData);
      } else {
        // Keep essential box (ftyp, mdat, trak, etc.)
        keptChunks.push(bytes.slice(offset, boxEnd));
      }

      offset = boxEnd;
    }

    return keptChunks;
  }

  const chunks = filterBoxes(0, bytes.length, false);
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const sanitized = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const c of chunks) {
    sanitized.set(c, writeOffset);
    writeOffset += c.length;
  }

  return { sanitized, removed };
}
