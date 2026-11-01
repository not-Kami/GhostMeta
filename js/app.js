/**
 * GhostMeta - Client Application Logic
 * Zero-Trace Metadata & C2PA Eraser
 */

import { sanitizeFile } from './sanitizer/index.js';

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const toolbar = document.getElementById('toolbar');
const fileList = document.getElementById('fileList');
const filesCountEl = document.getElementById('filesCount');
const c2paDetectedCountEl = document.getElementById('c2paDetectedCount');
const totalSavedBytesEl = document.getElementById('totalSavedBytes');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

// State
const processedFiles = [];

// Drag and drop event listeners
['dragenter', 'dragover'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropzone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
  });
});

dropzone.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFiles(files);
  }
});

browseBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFiles(fileInput.files);
    fileInput.value = '';
  }
});

clearAllBtn.addEventListener('click', () => {
  processedFiles.length = 0;
  fileList.innerHTML = '';
  updateToolbar();
});

downloadAllBtn.addEventListener('click', async () => {
  if (processedFiles.length === 0) return;

  if (typeof JSZip === 'undefined') {
    alert('JSZip library is still loading, please try again in a second.');
    return;
  }

  const zip = new JSZip();
  processedFiles.forEach(item => {
    const cleanName = getCleanFilename(item.name, item.ext);
    zip.file(cleanName, item.sanitized);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghostmeta_cleaned_${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

async function handleFiles(files) {
  for (const file of Array.from(files)) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const result = sanitizeFile(bytes, file.name);

      const processedItem = {
        id: crypto.randomUUID(),
        name: file.name,
        originalSize: result.originalSize,
        sanitizedSize: result.sanitizedSize,
        savedBytes: result.savedBytes,
        removed: result.removed,
        hasC2PA: result.hasC2PA,
        format: result.format,
        mime: result.mime,
        ext: result.ext,
        sanitized: result.sanitized
      };

      processedFiles.push(processedItem);
      renderFileCard(processedItem);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
      renderErrorCard(file.name, err.message);
    }
  }

  updateToolbar();
}

function renderFileCard(item) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.id = `card-${item.id}`;

  const formatLabels = {
    jpeg: 'PHOTO JPG',
    png: 'PNG / AI',
    webp: 'WEBP',
    mp4: 'VIDEO MP4',
    pdf: 'PDF DOC',
    mp3: 'AUDIO MP3',
    wav: 'AUDIO WAV',
    flac: 'AUDIO FLAC'
  };

  const badgeText = formatLabels[item.format] || item.format.toUpperCase();

  const removedChipsHtml = item.removed.length > 0
    ? item.removed.map(tag => {
        const isC2PA = /c2pa|jumb|provenance/i.test(tag);
        return `<span class="badge-wiped ${isC2PA ? 'badge-wiped-c2pa' : ''}">🛡️ ${escapeHtml(tag)}</span>`;
      }).join('')
    : '<span class="badge-wiped">No metadata detected (Clean file)</span>';

  card.innerHTML = `
    <div class="file-info-main">
      <div class="file-format-badge">${badgeText}</div>
      <div class="file-name-group">
        <span class="file-title">${escapeHtml(item.name)}</span>
        <span class="file-size-diff">
          ${formatBytes(item.originalSize)} → ${formatBytes(item.sanitizedSize)}
          ${item.savedBytes > 0 ? `<span class="saved">(-${formatBytes(item.savedBytes)})</span>` : ''}
        </span>
      </div>
    </div>
    <div class="file-wiped-details">
      ${removedChipsHtml}
    </div>
    <div class="file-actions">
      <button class="btn-download-single" data-id="${item.id}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download Clean
      </button>
    </div>
  `;

  card.querySelector('.btn-download-single').addEventListener('click', () => {
    downloadSingle(item);
  });

  fileList.prepend(card);
}

function renderErrorCard(filename, errorMsg) {
  const card = document.createElement('div');
  card.className = 'file-card';
  card.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  card.innerHTML = `
    <div class="file-info-main">
      <div class="file-format-badge" style="color: #f87171; border-color: #ef4444;">ERROR</div>
      <div class="file-name-group">
        <span class="file-title">${escapeHtml(filename)}</span>
        <span class="file-size-diff" style="color: #f87171;">${escapeHtml(errorMsg)}</span>
      </div>
    </div>
  `;
  fileList.prepend(card);
}

function downloadSingle(item) {
  const blob = new Blob([item.sanitized], { type: item.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getCleanFilename(item.name, item.ext);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getCleanFilename(originalName, defaultExt) {
  const dotIndex = originalName.lastIndexOf('.');
  if (dotIndex !== -1) {
    const base = originalName.substring(0, dotIndex);
    const ext = originalName.substring(dotIndex + 1);
    return `${base}_ghost.${ext}`;
  }
  return `${originalName}_ghost.${defaultExt}`;
}

function updateToolbar() {
  if (processedFiles.length === 0) {
    toolbar.classList.add('hidden');
    return;
  }

  toolbar.classList.remove('hidden');
  filesCountEl.textContent = `${processedFiles.length} file(s)`;

  const c2paCount = processedFiles.filter(f => f.hasC2PA).length;
  c2paDetectedCountEl.textContent = `${c2paCount} C2PA tag(s) neutralized`;

  const totalSaved = processedFiles.reduce((acc, f) => acc + f.savedBytes, 0);
  totalSavedBytesEl.textContent = `${formatBytes(totalSaved)} stripped`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
