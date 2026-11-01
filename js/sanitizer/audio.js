/**
 * GhostMeta - Audio Sanitizer
 * Strips ID3v1, ID3v2, RIFF INFO, Vorbis comments, album art, and timestamps from MP3, WAV, and FLAC
 */

export function sanitizeAudio(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  // Check format
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // MP3 with ID3v2
    return sanitizeMp3(bytes, removed);
  } else if (bytes.length >= 12 &&
             bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
             bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
    // WAV
    return sanitizeWav(bytes, removed);
  } else if (bytes.length >= 4 &&
             bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    // FLAC
    return sanitizeFlac(bytes, removed);
  } else if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    // Raw MP3 stream without leading ID3v2
    return sanitizeMp3(bytes, removed);
  }

  throw new Error('Unsupported or unrecognized audio format');
}

function sanitizeMp3(bytes, removed) {
  let startOffset = 0;
  const len = bytes.length;

  // Check ID3v2 at beginning
  if (len >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    // Syncsafe size
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
       (bytes[9] & 0x7f);

    startOffset = 10 + tagSize;
    // Check if footer flag (bit 4 of byte 5) is set
    if (bytes[5] & 0x10) {
      startOffset += 10;
    }
    removed.push('ID3v2 Audio Metadata (Artist, Title, Album, C2PA)');
  }

  let endOffset = len;
  // Check ID3v1 at end (128 bytes)
  if (endOffset - startOffset >= 128) {
    const tailIndex = endOffset - 128;
    if (bytes[tailIndex] === 0x54 && bytes[tailIndex + 1] === 0x41 && bytes[tailIndex + 2] === 0x47) { // "TAG"
      endOffset = tailIndex;
      removed.push('ID3v1 Audio Metadata Tag');
    }
  }

  // Check APE tag at end (32 bytes header starting with "APETAGEX")
  if (endOffset - startOffset >= 32) {
    const apeIndex = endOffset - 32;
    const apeHeader = String.fromCharCode(...bytes.slice(apeIndex, apeIndex + 8));
    if (apeHeader === 'APETAGEX') {
      const apeSize =
        bytes[apeIndex + 12] |
        (bytes[apeIndex + 13] << 8) |
        (bytes[apeIndex + 14] << 16) |
        (bytes[apeIndex + 15] << 24);
      endOffset = Math.max(startOffset, endOffset - apeSize);
      removed.push('APE Tag Metadata');
    }
  }

  const sanitized = bytes.slice(startOffset, endOffset);
  return { sanitized, removed };
}

function sanitizeWav(bytes, removed) {
  const chunks = [];
  let offset = 12; // Skip RIFF + Size + WAVE
  const len = bytes.length;

  while (offset + 8 <= len) {
    const chunkId = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const chunkSize =
      bytes[offset + 4] |
      (bytes[offset + 5] << 8) |
      (bytes[offset + 6] << 16) |
      (bytes[offset + 7] << 24);

    const paddedSize = chunkSize + (chunkSize % 2);
    const chunkEnd = offset + 8 + paddedSize;

    let shouldStrip = false;
    let desc = null;

    if (chunkId === 'LIST' && offset + 12 <= len) {
      const listType = String.fromCharCode(...bytes.slice(offset + 8, offset + 12));
      if (listType === 'INFO') {
        desc = 'WAV LIST INFO Chunk (Artist, Date, Software)';
        shouldStrip = true;
      }
    } else if (chunkId.toLowerCase() === 'id3 ' || chunkId === 'ID3 ') {
      desc = 'WAV ID3 Chunk';
      shouldStrip = true;
    }

    if (shouldStrip) {
      if (!removed.includes(desc)) {
        removed.push(desc);
      }
    } else {
      chunks.push(bytes.slice(offset, Math.min(chunkEnd, len)));
    }

    offset = chunkEnd;
  }

  const keptLength = chunks.reduce((a, b) => a + b.length, 0);
  const totalLength = 12 + keptLength;
  const sanitized = new Uint8Array(totalLength);

  // Write RIFF header
  sanitized.set(bytes.slice(0, 4), 0); // RIFF
  const riffSize = totalLength - 8;
  sanitized[4] = riffSize & 0xff;
  sanitized[5] = (riffSize >> 8) & 0xff;
  sanitized[6] = (riffSize >> 16) & 0xff;
  sanitized[7] = (riffSize >> 24) & 0xff;
  sanitized.set(bytes.slice(8, 12), 8); // WAVE

  let writeOffset = 12;
  for (const c of chunks) {
    sanitized.set(c, writeOffset);
    writeOffset += c.length;
  }

  return { sanitized, removed };
}

function sanitizeFlac(bytes, removed) {
  const kept = [bytes.slice(0, 4)]; // 'fLaC' signature
  let offset = 4;
  const len = bytes.length;
  let isLast = false;

  const metadataBlocks = [];

  while (offset + 4 <= len && !isLast) {
    const headerByte = bytes[offset];
    isLast = (headerByte & 0x80) !== 0;
    const blockType = headerByte & 0x7f;
    const blockLength =
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
       bytes[offset + 3];

    const blockEnd = offset + 4 + blockLength;
    if (blockEnd > len) break;

    // Type 4: VORBIS_COMMENT, Type 6: PICTURE
    if (blockType === 4) {
      removed.push('FLAC Vorbis Comment (Tags/Artist/Title)');
    } else if (blockType === 6) {
      removed.push('FLAC Album Art Picture Block');
    } else {
      metadataBlocks.push({
        data: bytes.slice(offset, blockEnd),
        type: blockType
      });
    }

    offset = blockEnd;
  }

  // Ensure isLast bit is set on the last metadata block
  if (metadataBlocks.length > 0) {
    const lastBlock = metadataBlocks[metadataBlocks.length - 1];
    lastBlock.data[0] |= 0x80;
    for (const b of metadataBlocks) {
      kept.push(b.data);
    }
  }

  // Audio frames remainder
  if (offset < len) {
    kept.push(bytes.slice(offset));
  }

  const totalLength = kept.reduce((a, b) => a + b.length, 0);
  const sanitized = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const c of kept) {
    sanitized.set(c, writeOffset);
    writeOffset += c.length;
  }

  return { sanitized, removed };
}
