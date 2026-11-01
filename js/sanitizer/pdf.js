/**
 * GhostMeta - PDF Sanitizer
 * Strips PDF /Info dictionaries, /Metadata (XMP/C2PA) streams, and author/creation timestamps
 */

export function sanitizePdf(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const removed = [];

  // Check PDF signature %PDF-
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== '%PDF-') {
    throw new Error('Invalid PDF signature');
  }

  // Work on a copy of the buffer so we can perform byte-preserving neutralization
  const sanitized = new Uint8Array(bytes);
  const decoder = new TextDecoder('latin1');
  const encoder = new TextEncoder();
  const text = decoder.decode(sanitized);

  // 1. Neutralize /Metadata stream objects (XMP packet & C2PA manifests)
  const metaRegex = /\/Metadata\s+(\d+\s+\d+\s+R)/g;
  let match;
  let hasMeta = false;
  while ((match = metaRegex.exec(text)) !== null) {
    hasMeta = true;
    const matchStart = match.index;
    const matchLen = match[0].length;
    // Replace with spaces so cross-reference offsets remain valid
    for (let i = 0; i < matchLen; i++) {
      sanitized[matchStart + i] = 0x20;
    }
  }
  if (hasMeta) {
    removed.push('PDF /Metadata Stream (XMP / C2PA Provenance)');
  }

  // 2. Clear out XMP metadata packets embedded in streams <?xpacket ... ?xpacket>
  const xpacketRegex = /<\?xpacket begin[\s\S]*?\?xpacket end="[rw]"\?>/g;
  let hasXpacket = false;
  while ((match = xpacketRegex.exec(text)) !== null) {
    hasXpacket = true;
    const matchStart = match.index;
    const matchLen = match[0].length;
    for (let i = 0; i < matchLen; i++) {
      sanitized[matchStart + i] = 0x20;
    }
  }
  if (hasXpacket) {
    removed.push('Embedded XMP Packet');
  }

  // 3. Neutralize /Info dictionary references in trailers
  const infoRefRegex = /\/Info\s+(\d+\s+\d+\s+R)/g;
  let hasInfoRef = false;
  while ((match = infoRefRegex.exec(text)) !== null) {
    hasInfoRef = true;
    const matchStart = match.index;
    const matchLen = match[0].length;
    for (let i = 0; i < matchLen; i++) {
      sanitized[matchStart + i] = 0x20;
    }
  }
  if (hasInfoRef) {
    removed.push('PDF /Info Dictionary Reference');
  }

  // 4. Blank out metadata keys inside info objects (Author, Creator, Producer, Dates)
  const metaKeys = [
    '/Author', '/Creator', '/Producer', '/CreationDate', '/ModDate',
    '/Title', '/Subject', '/Keywords', '/Company', '/SourceModified'
  ];

  for (const key of metaKeys) {
    const keyRegex = new RegExp(key + '\\s*\\((?:[^\\\\)]|\\\\.)*\\)', 'g');
    let hasKey = false;
    while ((match = keyRegex.exec(text)) !== null) {
      hasKey = true;
      const matchStart = match.index;
      const matchLen = match[0].length;
      for (let i = 0; i < matchLen; i++) {
        sanitized[matchStart + i] = 0x20;
      }
    }
    if (hasKey && !removed.includes('Document Information & Author Metadata')) {
      removed.push('Document Information & Author Metadata');
    }
  }

  return { sanitized, removed };
}
