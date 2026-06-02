/**
 * AI Diagram & Document Generator — Client-Side Application
 *
 * Handles form interactions, file attachments, API calls, and result display.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const SUPPORTED_EXTENSIONS = new Set([
  'png', 'jpeg', 'jpg',
  'pdf',
  'txt', 'md',
  'py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rb', 'rs',
  'html', 'css', 'json', 'yaml', 'yml', 'xml', 'sh',
]);

// ─── State ───────────────────────────────────────────────────────────────────

let currentMode = 'diagram'; // 'diagram' | 'document'
let attachedFiles = []; // File[]
let isGenerating = false;

// ─── DOM Elements ────────────────────────────────────────────────────────────

const form = document.getElementById('generation-form');
const promptInput = document.getElementById('prompt-input');
const promptCounter = document.getElementById('prompt-counter');
const promptError = document.getElementById('prompt-error');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const filePickerBtn = document.getElementById('file-picker-btn');
const fileList = document.getElementById('file-list');
const attachmentError = document.getElementById('attachment-error');
const templateSelect = document.getElementById('template-select');
const diagramTypeGroup = document.getElementById('diagram-type-group');
const diagramTypeSelect = document.getElementById('diagram-type-select');
const outputFormatGroup = document.getElementById('output-format-group');
const generateBtn = document.getElementById('generate-btn');
const btnText = generateBtn.querySelector('.btn-text');
const btnSpinner = generateBtn.querySelector('.btn-spinner');
const resultsSection = document.getElementById('results-section');
const resultsContent = document.querySelector('#results-content code');
const resultTypeBadge = document.getElementById('result-type-badge');
const resultFormatBadge = document.getElementById('result-format-badge');
const modeTabs = document.querySelectorAll('.mode-tab');

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initModeToggle();
  initPromptInput();
  initFileAttachments();
  loadTemplates();
});

// ─── Mode Toggle ─────────────────────────────────────────────────────────────

function initModeToggle() {
  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      if (mode === currentMode) return;

      currentMode = mode;

      // Update tab states
      modeTabs.forEach((t) => {
        const isActive = t.dataset.mode === mode;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Show/hide diagram-specific options
      const isDiagram = mode === 'diagram';
      diagramTypeGroup.hidden = !isDiagram;
      outputFormatGroup.hidden = !isDiagram;

      // Reload templates for the selected mode
      loadTemplates();
    });
  });
}

// ─── Prompt Input ────────────────────────────────────────────────────────────

function initPromptInput() {
  promptInput.addEventListener('input', () => {
    updateCharCounter();
    clearPromptError();
  });

  // Handle paste to check length
  promptInput.addEventListener('paste', () => {
    requestAnimationFrame(updateCharCounter);
  });
}

function updateCharCounter() {
  const length = promptInput.value.length;
  promptCounter.textContent = `${length.toLocaleString()} / 10,000`;

  promptCounter.classList.remove('near-limit', 'at-limit');
  if (length >= MAX_PROMPT_LENGTH) {
    promptCounter.classList.add('at-limit');
  } else if (length >= MAX_PROMPT_LENGTH * 0.9) {
    promptCounter.classList.add('near-limit');
  }
}

function setPromptError(message) {
  promptError.textContent = message;
  promptInput.classList.add('has-error');
}

function clearPromptError() {
  promptError.textContent = '';
  promptInput.classList.remove('has-error');
}

function validatePrompt() {
  const prompt = promptInput.value;

  if (!prompt || prompt.trim().length === 0) {
    setPromptError('Prompt must contain non-whitespace content.');
    return false;
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    setPromptError(`Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH.toLocaleString()} characters.`);
    return false;
  }

  clearPromptError();
  return true;
}

// ─── File Attachments ────────────────────────────────────────────────────────

function initFileAttachments() {
  // Click on drop zone or browse button opens file picker
  filePickerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target !== filePickerBtn) {
      fileInput.click();
    }
  });

  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // File input change
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = ''; // Reset so same file can be re-selected
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

function handleFiles(fileListInput) {
  clearAttachmentError();

  const files = Array.from(fileListInput);

  for (const file of files) {
    // Check max attachments
    if (attachedFiles.length >= MAX_ATTACHMENTS) {
      setAttachmentError(`Maximum of ${MAX_ATTACHMENTS} files allowed.`);
      break;
    }

    // Check file extension
    const ext = getFileExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      setAttachmentError(`"${file.name}" has an unsupported file type. Supported: PNG, JPEG, PDF, TXT, MD, and source code files.`);
      continue;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setAttachmentError(`"${file.name}" exceeds the 10 MB size limit.`);
      continue;
    }

    // Check for empty files
    if (file.size === 0) {
      setAttachmentError(`"${file.name}" is empty.`);
      continue;
    }

    // Check for duplicate filenames
    if (attachedFiles.some((f) => f.name === file.name)) {
      continue; // silently skip duplicates
    }

    attachedFiles.push(file);
  }

  renderFileList();
}

function removeFile(index) {
  attachedFiles.splice(index, 1);
  clearAttachmentError();
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';

  attachedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <div class="file-item-info">
        <span class="file-item-name">${escapeHtml(file.name)}</span>
        <span class="file-item-size">(${formatFileSize(file.size)})</span>
      </div>
      <button
        type="button"
        class="file-remove-btn"
        aria-label="Remove ${escapeHtml(file.name)}"
        data-index="${index}"
      >&times;</button>
    `;

    li.querySelector('.file-remove-btn').addEventListener('click', () => {
      removeFile(index);
    });

    fileList.appendChild(li);
  });
}

function setAttachmentError(message) {
  attachmentError.textContent = message;
}

function clearAttachmentError() {
  attachmentError.textContent = '';
}

// ─── Templates ───────────────────────────────────────────────────────────────

async function loadTemplates() {
  try {
    const response = await fetch('/api/templates');
    if (!response.ok) return;

    const templates = await response.json();

    // Clear existing options (keep the "None" option)
    templateSelect.innerHTML = '<option value="">None (free-form)</option>';

    // Filter templates by current mode
    const filtered = templates.filter((t) => t.type === currentMode);

    filtered.forEach((template) => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
  } catch {
    // If API isn't available yet, silently continue with empty templates
  }
}

// ─── Form Submission ─────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isGenerating) return;
  if (!validatePrompt()) return;

  await submitGeneration();
});

async function submitGeneration() {
  setLoading(true);

  try {
    const requestBody = await buildRequestBody();
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message = errorData?.error?.message || `Request failed with status ${response.status}`;
      setPromptError(message);
      return;
    }

    const data = await response.json();
    displayResults(data);
  } catch (err) {
    setPromptError('Failed to connect to the server. Please ensure the backend is running.');
  } finally {
    setLoading(false);
  }
}

async function buildRequestBody() {
  const body = {
    prompt: promptInput.value,
  };

  // Always include the current mode so the backend knows user intent
  body.mode = currentMode;

  // Template
  const templateId = templateSelect.value;
  if (templateId) {
    body.templateId = templateId;
  }

  // Diagram-specific options
  if (currentMode === 'diagram') {
    const diagramType = diagramTypeSelect.value;
    if (diagramType) {
      body.diagramType = diagramType;
    }

    const outputFormat = document.querySelector('input[name="outputFormat"]:checked')?.value;
    if (outputFormat) {
      body.outputFormat = outputFormat;
    }
  }

  // Attachments (convert to base64)
  if (attachedFiles.length > 0) {
    body.attachments = await Promise.all(
      attachedFiles.map(async (file) => ({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64: await fileToBase64(file),
      }))
    );
  }

  return body;
}

function displayResults(data) {
  resultsSection.hidden = false;

  const outputType = data.outputType;

  if (outputType === 'diagram') {
    // Show diagram preview (hero) + code editor (collapsed)
    // Hide markdown editor
    hideMarkdownEditor();

    const format = data.format || 'mermaid';
    showDiagramPreview(data.content, format);
    initCodeEditor(data.content, format);
    setCodeEditorCollapsed(true);
    codeEditorSection.hidden = false;

    // Hide raw results
    if (resultsContent && resultsContent.parentElement) {
      resultsContent.parentElement.hidden = true;
    }

  } else if (outputType === 'document') {
    // Show markdown editor, hide diagram panels
    hideDiagramPreview();
    if (codeEditorSection) codeEditorSection.hidden = true;

    showMarkdownEditor(data.content || '');

    if (resultsContent && resultsContent.parentElement) {
      resultsContent.parentElement.hidden = true;
    }

  } else {
    // Unknown: show raw content
    hideDiagramPreview();
    if (codeEditorSection) codeEditorSection.hidden = true;
    hideMarkdownEditor();

    if (resultsContent && resultsContent.parentElement) {
      resultsContent.parentElement.hidden = false;
    }
    resultsContent.textContent = data.content || '';
  }

  // Update badges
  resultTypeBadge.textContent = data.outputType || '';
  resultFormatBadge.textContent = data.format || data.diagramType || data.documentType || '';

  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Loading State ───────────────────────────────────────────────────────────

function setLoading(loading) {
  isGenerating = loading;
  generateBtn.disabled = loading;
  btnText.textContent = loading ? 'Generating...' : 'Generate';
  btnSpinner.hidden = !loading;
  promptInput.disabled = loading;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Markdown Editor ─────────────────────────────────────────────────────────

const MD_MAX_CHARS = 100_000;
const MD_DEBOUNCE_MS = 500; // 500ms debounce gives <1s total response time

let mdInstance = null;
let mdDebounceTimer = null;
let mdSaveConfirmTimer = null;

// DOM elements for Markdown editor
const mdEditorSection = document.getElementById('markdown-editor-section');
const mdEditorTextarea = document.getElementById('md-editor-textarea');
const mdPreviewContent = document.getElementById('md-preview-content');
const mdCharCounter = document.getElementById('md-char-counter');
const mdLimitNotification = document.getElementById('md-limit-notification');
const mdSaveConfirmation = document.getElementById('md-save-confirmation');
const mdSaveBtn = document.getElementById('md-save-btn');
const mdRenderError = document.getElementById('md-render-error');

/**
 * Initialize the markdown-it instance.
 * Falls back gracefully if markdown-it CDN hasn't loaded.
 */
function initMarkdownIt() {
  if (mdInstance) return mdInstance;

  if (typeof markdownit === 'function') {
    mdInstance = markdownit({
      html: false,
      linkify: true,
      typographer: false,
    });
  }

  return mdInstance;
}

/**
 * Show the Markdown editor section with content.
 */
function showMarkdownEditor(content) {
  if (!mdEditorSection) return;

  mdEditorSection.hidden = false;
  mdEditorTextarea.value = content;

  // Initialize markdown-it
  initMarkdownIt();

  // Set up event listeners (remove old ones first to avoid duplicates)
  mdEditorTextarea.removeEventListener('input', handleMdEditorInput);
  mdEditorTextarea.addEventListener('input', handleMdEditorInput);

  mdSaveBtn.removeEventListener('click', handleMdSave);
  mdSaveBtn.addEventListener('click', handleMdSave);

  // Initial render and counter update
  updateMdCharCounter();
  renderMarkdownPreview();
}

/**
 * Hide the Markdown editor section.
 */
function hideMarkdownEditor() {
  if (!mdEditorSection) return;
  mdEditorSection.hidden = true;
}

/**
 * Handle input events on the Markdown editor textarea.
 * Debounces rendering and enforces character limit.
 */
function handleMdEditorInput() {
  const content = mdEditorTextarea.value;

  // Enforce character limit
  if (content.length > MD_MAX_CHARS) {
    mdEditorTextarea.value = content.slice(0, MD_MAX_CHARS);
    mdLimitNotification.hidden = false;
    mdEditorTextarea.disabled = true;

    // Re-enable after a short moment so user can delete content
    setTimeout(() => {
      mdEditorTextarea.disabled = false;
      mdEditorTextarea.focus();
    }, 100);
  } else {
    mdLimitNotification.hidden = true;
  }

  updateMdCharCounter();

  // Debounce preview render (500ms for <1s total update time)
  if (mdDebounceTimer) {
    clearTimeout(mdDebounceTimer);
  }
  mdDebounceTimer = setTimeout(() => {
    renderMarkdownPreview();
  }, MD_DEBOUNCE_MS);
}

/**
 * Update the character counter display.
 */
function updateMdCharCounter() {
  const length = mdEditorTextarea.value.length;
  mdCharCounter.textContent = `${length.toLocaleString()} / 100,000`;

  mdCharCounter.classList.remove('near-limit', 'at-limit');
  if (length >= MD_MAX_CHARS) {
    mdCharCounter.classList.add('at-limit');
  } else if (length >= MD_MAX_CHARS * 0.9) {
    mdCharCounter.classList.add('near-limit');
  }
}

/**
 * Render Markdown content to HTML preview.
 * Falls back to raw text display on rendering failure.
 */
function renderMarkdownPreview() {
  const content = mdEditorTextarea.value;

  try {
    const md = initMarkdownIt();

    if (!md) {
      // markdown-it not available — show raw text
      showRawTextFallback(content);
      return;
    }

    const html = md.render(content);
    mdPreviewContent.innerHTML = html;
    mdPreviewContent.classList.remove('raw-text');
    mdRenderError.hidden = true;
  } catch (err) {
    // Rendering failed — show raw text with error indication
    showRawTextFallback(content);
  }
}

/**
 * Display raw text in preview pane when rendering fails.
 */
function showRawTextFallback(content) {
  mdPreviewContent.textContent = content;
  mdPreviewContent.classList.add('raw-text');
  mdRenderError.hidden = false;
}

/**
 * Handle save button click.
 * Downloads the Markdown as a .md file and shows confirmation.
 */
function handleMdSave() {
  const content = mdEditorTextarea.value;

  if (!content.trim()) return;

  try {
    // Create a Blob and trigger download
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show save confirmation
    showSaveConfirmation();
  } catch (err) {
    // If download fails, try copying to clipboard as fallback
    navigator.clipboard.writeText(content).then(() => {
      showSaveConfirmation();
    }).catch(() => {
      // Silently fail
    });
  }
}

/**
 * Show the save confirmation message briefly.
 */
function showSaveConfirmation() {
  mdSaveConfirmation.hidden = false;

  if (mdSaveConfirmTimer) {
    clearTimeout(mdSaveConfirmTimer);
  }

  mdSaveConfirmTimer = setTimeout(() => {
    mdSaveConfirmation.hidden = true;
  }, 3000);
}


// ─── Code Editor ─────────────────────────────────────────────────────────────

const EDITOR_DEBOUNCE_MS = 2000; // 2-second debounce (1s idle + 1s render)

// DOM Elements — Code Editor
const codeEditorSection = document.getElementById('code-editor-section');
const codeEditor = document.getElementById('code-editor');
const lineNumbers = document.getElementById('line-numbers');
const editorErrors = document.getElementById('editor-errors');
const editorStatus = document.getElementById('editor-status');

let editorDebounceTimer = null;
let lastValidRender = null; // Stores the last successfully rendered code
let currentDiagramFormat = null; // 'mermaid' | 'plantuml'

/**
 * Initialize the code editor when a diagram is generated.
 * Called from displayResults when outputType is 'diagram'.
 */
function initCodeEditor(code, format) {
  if (!codeEditorSection || !codeEditor) return;

  currentDiagramFormat = format || 'mermaid';
  codeEditor.value = code;
  lastValidRender = code;

  // Show the editor section
  codeEditorSection.hidden = false;

  // Update line numbers
  updateLineNumbers();

  // Clear any previous errors
  clearEditorErrors();
  setEditorStatus('');

  // Attach event listeners (only once)
  if (!codeEditor._editorInitialized) {
    codeEditor.addEventListener('input', onEditorInput);
    codeEditor.addEventListener('scroll', syncLineNumberScroll);
    codeEditor.addEventListener('keydown', onEditorKeydown);
    codeEditor._editorInitialized = true;
  }
}

/**
 * Handle editor input with debounced re-render.
 */
function onEditorInput() {
  updateLineNumbers();
  setEditorStatus('Editing...', 'saving');

  // Clear previous debounce timer
  if (editorDebounceTimer) {
    clearTimeout(editorDebounceTimer);
  }

  // Set new debounce timer — 2 seconds after last keystroke
  editorDebounceTimer = setTimeout(() => {
    triggerEditorReRender();
  }, EDITOR_DEBOUNCE_MS);
}

/**
 * Handle special keyboard shortcuts in the editor.
 * Native undo/redo (Ctrl+Z / Ctrl+Shift+Z / Cmd+Z / Cmd+Shift+Z)
 * is handled by the browser's textarea behavior.
 */
function onEditorKeydown(e) {
  // Tab key inserts spaces instead of changing focus
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    const value = codeEditor.value;

    codeEditor.value = value.substring(0, start) + '  ' + value.substring(end);
    codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;

    // Trigger input event so debounce picks it up
    codeEditor.dispatchEvent(new Event('input'));
  }
}

/**
 * Trigger re-render of the diagram after debounce.
 * Validates the code and updates the preview.
 */
async function triggerEditorReRender() {
  const code = codeEditor.value;

  if (!code.trim()) {
    clearEditorErrors();
    setEditorStatus('');
    return;
  }

  setEditorStatus('Rendering...', 'saving');

  try {
    // Validate the diagram code via the backend
    const validationResult = await validateDiagramCode(code, currentDiagramFormat);

    if (validationResult.isValid) {
      clearEditorErrors();
      lastValidRender = code;
      setEditorStatus('Valid', 'saved');

      // Update the results content display
      if (resultsContent) {
        resultsContent.textContent = code;
      }

      // Dispatch a custom event for the diagram renderer (task 12.4 will handle this)
      window.dispatchEvent(new CustomEvent('diagram-code-updated', {
        detail: { code, format: currentDiagramFormat }
      }));
    } else {
      // Show syntax errors
      displayEditorErrors(validationResult.errors || []);
      setEditorStatus('Syntax errors', 'saving');

      // Highlight error lines in line numbers
      highlightErrorLines(validationResult.errors || []);
    }
  } catch (err) {
    // Network or server error — still show the code, don't block editing
    setEditorStatus('Validation unavailable', '');
  }
}

/**
 * Validate diagram code against the backend DSL validator.
 */
async function validateDiagramCode(code, format) {
  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, format }),
    });

    if (response.ok) {
      return await response.json();
    }

    // If the validation endpoint doesn't exist yet, treat as valid
    if (response.status === 404) {
      return { isValid: true, errors: [] };
    }

    return { isValid: false, errors: [{ line: 1, column: 1, message: 'Validation failed', severity: 'error' }] };
  } catch {
    // If server is unreachable, don't block editing
    return { isValid: true, errors: [] };
  }
}

/**
 * Update line numbers to match textarea content.
 */
function updateLineNumbers() {
  if (!lineNumbers || !codeEditor) return;

  const lineCount = codeEditor.value.split('\n').length;
  let html = '';

  for (let i = 1; i <= lineCount; i++) {
    html += `<span class="line-number" data-line="${i}">${i}</span>`;
  }

  lineNumbers.innerHTML = html;
}

/**
 * Sync line numbers scroll position with textarea scroll.
 */
function syncLineNumberScroll() {
  if (lineNumbers && codeEditor) {
    lineNumbers.scrollTop = codeEditor.scrollTop;
  }
}

/**
 * Display syntax errors in the error panel.
 */
function displayEditorErrors(errors) {
  if (!editorErrors) return;

  if (!errors || errors.length === 0) {
    clearEditorErrors();
    return;
  }

  editorErrors.innerHTML = errors.map((err) => `
    <div class="editor-error-item">
      <span class="editor-error-location">Ln ${err.line}${err.column ? `:${err.column}` : ''}</span>
      <span class="editor-error-message">${escapeHtml(err.message)}</span>
    </div>
  `).join('');
}

/**
 * Highlight lines with errors in the line number gutter.
 */
function highlightErrorLines(errors) {
  if (!lineNumbers) return;

  // Remove all existing error highlights
  lineNumbers.querySelectorAll('.line-number.has-error').forEach((el) => {
    el.classList.remove('has-error');
  });

  // Add error highlights
  if (errors && errors.length > 0) {
    errors.forEach((err) => {
      const lineEl = lineNumbers.querySelector(`[data-line="${err.line}"]`);
      if (lineEl) {
        lineEl.classList.add('has-error');
      }
    });
  }
}

/**
 * Clear all editor errors.
 */
function clearEditorErrors() {
  if (editorErrors) {
    editorErrors.innerHTML = '';
  }

  // Remove error highlights from line numbers
  if (lineNumbers) {
    lineNumbers.querySelectorAll('.line-number.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }
}

/**
 * Set the editor status indicator text.
 */
function setEditorStatus(text, className) {
  if (!editorStatus) return;

  editorStatus.textContent = text;
  editorStatus.className = 'editor-status';
  if (className) {
    editorStatus.classList.add(className);
  }
}

/**
 * Get the current code editor content.
 * Useful for other components that need the current edited code.
 */
function getEditorCode() {
  return codeEditor ? codeEditor.value : '';
}

/**
 * Get the last valid render code (for fallback when syntax errors exist).
 */
function getLastValidRender() {
  return lastValidRender;
}

// ─── Code Editor Collapse/Expand ─────────────────────────────────────────────

/**
 * Set the code editor body collapsed or expanded.
 */
function setCodeEditorCollapsed(collapsed) {
  const body = document.getElementById('code-editor-body');
  const toggle = document.getElementById('code-editor-toggle');
  if (!body || !toggle) return;

  if (collapsed) {
    body.classList.remove('expanded');
    body.classList.add('collapsed');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.toggle-text').textContent = 'Show Code';
  } else {
    body.classList.remove('collapsed');
    body.classList.add('expanded');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.toggle-text').textContent = 'Hide Code';
  }
}

/**
 * Hide the code editor section entirely.
 */
function hideCodeEditor() {
  if (codeEditorSection) {
    codeEditorSection.hidden = true;
  }
}

// Initialize code editor toggle button
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('code-editor-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const body = document.getElementById('code-editor-body');
      if (!body) return;
      const isCollapsed = body.classList.contains('collapsed');
      setCodeEditorCollapsed(!isCollapsed);
    });
  }
});


// ─── Diagram Visual Renderer Panel ──────────────────────────────────────────

const DIAGRAM_RENDER_DEBOUNCE_MS = 2000; // 2-second debounce for re-render on edit
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4.0;

// Icon pack registration for architecture-beta diagrams
const ICON_PACKS = ['aws', 'azure', 'gcp', 'logos'];
let iconPacksRegistered = false;

async function registerIconPacks() {
  if (iconPacksRegistered) return;
  if (typeof mermaid === 'undefined') return;

  for (const pack of ICON_PACKS) {
    try {
      const response = await fetch(`https://unpkg.com/@iconify-json/${pack}/icons.json`);
      if (response.ok) {
        const iconData = await response.json();
        mermaid.registerIconPacks([{ name: pack, icons: iconData }]);
      }
    } catch {
      console.warn(`Failed to load icon pack: ${pack}`);
    }
  }
  iconPacksRegistered = true;
}

function isArchitectureBeta(code) {
  const firstLine = code.trim().split('\n')[0].trim();
  return firstLine.startsWith('architecture-beta');
}

// Diagram preview state
let diagramZoom = 1.0;
let diagramPanX = 0;
let diagramPanY = 0;
let diagramIsPanning = false;
let diagramPanStartX = 0;
let diagramPanStartY = 0;
let lastValidDiagramSvg = '';
let lastValidDiagramCode = '';
let diagramRenderDebounceTimer = null;
let diagramRenderCounter = 0; // Unique ID counter for mermaid render calls
let mermaidInitialized = false;

// DOM Elements — Diagram Preview
const diagramPreviewSection = document.getElementById('diagram-preview-section');
const diagramPreviewViewport = document.getElementById('diagram-preview-viewport');
const diagramPreviewCanvas = document.getElementById('diagram-preview-canvas');
const diagramPreviewContent = document.getElementById('diagram-preview');
const diagramErrorBanner = document.getElementById('diagram-error-banner');
const diagramErrorMessage = document.getElementById('diagram-error-message');
const diagramFallbackCode = document.getElementById('diagram-fallback-code');
const diagramFallbackCodeContent = document.getElementById('diagram-fallback-code-content');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomResetBtn = document.getElementById('zoom-reset-btn');
const zoomLevelIndicator = document.getElementById('zoom-level-indicator');

/**
 * Initialize Mermaid.js for client-side rendering.
 */
async function initMermaid() {
  if (mermaidInitialized) return;
  if (typeof mermaid === 'undefined') return;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'var(--font-sans)',
  });

  mermaidInitialized = true;

  // Register icon packs for architecture-beta diagrams
  await registerIconPacks();
}

// ─── Diagram Export Functions ─────────────────────────────────────────────────

function exportDiagramAsSvg() {
  if (!lastValidDiagramSvg) return;
  const blob = new Blob([lastValidDiagramSvg], { type: 'image/svg+xml' });
  downloadBlob(blob, 'diagram.svg');
}

function exportDiagramAsPng() {
  if (!lastValidDiagramSvg) return;
  svgToImage(lastValidDiagramSvg, 'image/png', 'diagram.png');
}

function exportDiagramAsJpg() {
  if (!lastValidDiagramSvg) return;
  svgToImage(lastValidDiagramSvg, 'image/jpeg', 'diagram.jpg');
}

function svgToImage(svgString, mimeType, filename) {
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * 2; // 2x for retina quality
    canvas.height = img.naturalHeight * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      downloadBlob(blob, filename);
      URL.revokeObjectURL(url);
    }, mimeType, 0.95);
  };
  img.src = url;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Initialize diagram preview panel controls and event listeners.
 */
function initDiagramPreview() {
  if (!diagramPreviewSection) return;

  initMermaid();

  // Zoom controls
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      setDiagramZoom(diagramZoom + ZOOM_STEP);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      setDiagramZoom(diagramZoom - ZOOM_STEP);
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      resetDiagramView();
    });
  }

  // Export controls
  const exportSvgBtn = document.getElementById('export-svg-btn');
  const exportPngBtn = document.getElementById('export-png-btn');
  const exportJpgBtn = document.getElementById('export-jpg-btn');

  if (exportSvgBtn) exportSvgBtn.addEventListener('click', exportDiagramAsSvg);
  if (exportPngBtn) exportPngBtn.addEventListener('click', exportDiagramAsPng);
  if (exportJpgBtn) exportJpgBtn.addEventListener('click', exportDiagramAsJpg);

  // Mouse wheel zoom
  if (diagramPreviewViewport) {
    diagramPreviewViewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setDiagramZoom(diagramZoom + delta);
    }, { passive: false });

    // Pan via mouse drag
    diagramPreviewViewport.addEventListener('mousedown', onDiagramPanStart);
    document.addEventListener('mousemove', onDiagramPanMove);
    document.addEventListener('mouseup', onDiagramPanEnd);

    // Touch pan support
    diagramPreviewViewport.addEventListener('touchstart', onDiagramTouchStart, { passive: false });
    document.addEventListener('touchmove', onDiagramTouchMove, { passive: false });
    document.addEventListener('touchend', onDiagramTouchEnd);
  }

  // Listen for code editor updates (dispatched by the code editor in task 12.2)
  window.addEventListener('diagram-code-updated', (e) => {
    const { code, format } = e.detail;
    if (format === 'mermaid') {
      renderDiagramPreview(code);
    } else {
      // For non-Mermaid formats, show raw code as fallback
      showDiagramFallback(code);
    }
  });
}

/**
 * Show the diagram preview panel and render diagram code.
 * Called when a new diagram is generated.
 */
function showDiagramPreview(code, format) {
  if (!diagramPreviewSection) return;

  diagramPreviewSection.hidden = false;
  hideDiagramError();
  hideDiagramFallback();

  if (format === 'mermaid') {
    renderDiagramPreview(code);
  } else {
    // Non-Mermaid formats (e.g., PlantUML) fall back to displaying raw code
    showDiagramFallback(code);
  }
}

/**
 * Hide the diagram preview panel.
 */
function hideDiagramPreview() {
  if (!diagramPreviewSection) return;
  diagramPreviewSection.hidden = true;
}

/**
 * Render a Mermaid diagram into the preview panel.
 * On success, stores the SVG as lastValidDiagramSvg.
 * On failure, shows an error banner and retains the last valid render.
 */
async function renderDiagramPreview(code) {
  if (!code || !code.trim()) {
    if (diagramPreviewContent) {
      diagramPreviewContent.innerHTML = '';
    }
    hideDiagramError();
    return;
  }

  await initMermaid();

  if (typeof mermaid === 'undefined') {
    showDiagramFallback(code);
    showDiagramError('Mermaid.js is not loaded. Displaying raw code.');
    return;
  }

  diagramRenderCounter++;
  const renderId = `diagram-render-${diagramRenderCounter}`;

  try {
    // Use mermaid.render to produce SVG
    const { svg } = await mermaid.render(renderId, code);

    // Successful render
    lastValidDiagramSvg = svg;
    lastValidDiagramCode = code;

    if (diagramPreviewContent) {
      diagramPreviewContent.innerHTML = svg;
    }

    hideDiagramError();
    hideDiagramFallback();
  } catch (err) {
    // Rendering failed — show error but retain last valid render
    const errorMsg = extractMermaidError(err);
    showDiagramError(errorMsg);

    if (lastValidDiagramSvg && diagramPreviewContent) {
      // Retain last valid render
      diagramPreviewContent.innerHTML = lastValidDiagramSvg;
    } else {
      // No previous valid render — fall back to raw code
      showDiagramFallback(code);
    }

    // Clean up any error element mermaid may have inserted into DOM
    const errorEl = document.getElementById(renderId);
    if (errorEl) {
      errorEl.remove();
    }
  }
}

/**
 * Extract a meaningful error message from a Mermaid rendering error.
 */
function extractMermaidError(err) {
  if (!err) return 'Diagram rendering failed.';

  // Mermaid v11 may throw with a message containing parse error details
  const msg = err.message || err.str || String(err);

  // Try to extract line number from error message
  const lineMatch = msg.match(/line\s*(\d+)/i) || msg.match(/at position\s*(\d+)/i);
  if (lineMatch) {
    return `Syntax error at line ${lineMatch[1]}: ${msg.slice(0, 120)}`;
  }

  // Truncate long messages
  if (msg.length > 150) {
    return msg.slice(0, 150) + '…';
  }

  return msg || 'Diagram rendering failed.';
}

/**
 * Show the error banner with a message.
 */
function showDiagramError(message) {
  if (!diagramErrorBanner || !diagramErrorMessage) return;

  diagramErrorMessage.textContent = message;
  diagramErrorBanner.hidden = false;
}

/**
 * Hide the error banner.
 */
function hideDiagramError() {
  if (!diagramErrorBanner) return;
  diagramErrorBanner.hidden = true;
}

/**
 * Show fallback raw code display when rendering is not possible.
 */
function showDiagramFallback(code) {
  if (!diagramFallbackCode || !diagramFallbackCodeContent) return;

  diagramFallbackCodeContent.textContent = code;
  diagramFallbackCode.hidden = false;

  // Hide the main preview viewport since we're showing raw code
  if (diagramPreviewViewport) {
    diagramPreviewViewport.style.display = 'none';
  }
}

/**
 * Hide the fallback raw code display and restore the preview viewport.
 */
function hideDiagramFallback() {
  if (!diagramFallbackCode) return;

  diagramFallbackCode.hidden = true;

  if (diagramPreviewViewport) {
    diagramPreviewViewport.style.display = '';
  }
}

// ─── Zoom & Pan Controls ─────────────────────────────────────────────────────

/**
 * Set zoom level with clamping.
 */
function setDiagramZoom(level) {
  diagramZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, level));
  applyDiagramTransform();
  updateZoomIndicator();
}

/**
 * Reset zoom and pan to defaults.
 */
function resetDiagramView() {
  diagramZoom = 1.0;
  diagramPanX = 0;
  diagramPanY = 0;
  applyDiagramTransform();
  updateZoomIndicator();
}

/**
 * Apply current zoom and pan transform to the canvas.
 */
function applyDiagramTransform() {
  if (!diagramPreviewCanvas) return;

  diagramPreviewCanvas.style.transform =
    `translate(${diagramPanX}px, ${diagramPanY}px) scale(${diagramZoom})`;
}

/**
 * Update the zoom level indicator text.
 */
function updateZoomIndicator() {
  if (!zoomLevelIndicator) return;
  zoomLevelIndicator.textContent = `${Math.round(diagramZoom * 100)}%`;
}

// ─── Pan (Mouse Drag) ────────────────────────────────────────────────────────

function onDiagramPanStart(e) {
  // Only start pan on left mouse button
  if (e.button !== 0) return;

  diagramIsPanning = true;
  diagramPanStartX = e.clientX - diagramPanX;
  diagramPanStartY = e.clientY - diagramPanY;

  if (diagramPreviewViewport) {
    diagramPreviewViewport.style.cursor = 'grabbing';
  }

  e.preventDefault();
}

function onDiagramPanMove(e) {
  if (!diagramIsPanning) return;

  diagramPanX = e.clientX - diagramPanStartX;
  diagramPanY = e.clientY - diagramPanStartY;
  applyDiagramTransform();
}

function onDiagramPanEnd() {
  if (!diagramIsPanning) return;

  diagramIsPanning = false;

  if (diagramPreviewViewport) {
    diagramPreviewViewport.style.cursor = 'grab';
  }
}

// ─── Pan (Touch) ─────────────────────────────────────────────────────────────

function onDiagramTouchStart(e) {
  if (e.touches.length !== 1) return;

  diagramIsPanning = true;
  const touch = e.touches[0];
  diagramPanStartX = touch.clientX - diagramPanX;
  diagramPanStartY = touch.clientY - diagramPanY;

  e.preventDefault();
}

function onDiagramTouchMove(e) {
  if (!diagramIsPanning || e.touches.length !== 1) return;

  const touch = e.touches[0];
  diagramPanX = touch.clientX - diagramPanStartX;
  diagramPanY = touch.clientY - diagramPanStartY;
  applyDiagramTransform();

  e.preventDefault();
}

function onDiagramTouchEnd() {
  diagramIsPanning = false;
}

// Initialize diagram preview on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initDiagramPreview();
});
