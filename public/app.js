/**
 * AI Diagram & Document Generator — Client-Side Application
 *
 * Handles form interactions, file attachments, API calls, and result display.
 * Uses Drawflow for interactive drag-and-drop diagram rendering.
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

// ─── Cloud Provider Icon SVGs ────────────────────────────────────────────────

const CLOUD_ICONS = {
  'aws-lambda': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5z"/><path d="M8 10l2 4 2-4 2 4 2-4"/></svg>',
  'aws-s3': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>',
  'aws-dynamodb': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 6h16v12H4z"/><path d="M4 10h16"/><path d="M4 14h16"/><path d="M10 6v12"/></svg>',
  'aws-api-gateway': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 4h16v16H4z"/><path d="M9 8l3 4-3 4"/><path d="M15 8l-3 4 3 4"/></svg>',
  'aws-cloudwatch': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  'aws-ec2': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8z"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/></svg>',
  'aws-rds': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v4c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 10v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/><path d="M5 14v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/></svg>',
  'aws-sqs': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h4M7 14h6"/><path d="M15 10l2 2-2 2"/></svg>',
  'aws-cloudfront': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M2 12h20"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  'aws-sns': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M12 3v4M12 17v4"/><circle cx="12" cy="12" r="4"/><path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  'aws-ecs': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6" y="6" width="5" height="5" rx="1"/><rect x="13" y="6" width="5" height="5" rx="1"/><rect x="6" y="13" width="5" height="5" rx="1"/></svg>',
  'aws-eks': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>',
  'aws-elasticache': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'aws-kinesis': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><path d="M4 8c4-2 8 2 12 0s4-2 4-2"/><path d="M4 12c4-2 8 2 12 0s4-2 4-2"/><path d="M4 16c4-2 8 2 12 0s4-2 4-2"/></svg>',
  'aws-step-functions': '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9900" stroke-width="1.5"><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="20" r="2"/><path d="M12 6v4M12 14v4"/></svg>',
  'azure': '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><path d="M6 20L13 4h5l-3 8h4L8 20h-2z"/></svg>',
  'azure-functions': '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'azure-storage': '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  'azure-sql': '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/></svg>',
  'azure-cosmos-db': '<svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/></svg>',
  'gcp': '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M14.5 3.5L12 2 9.5 3.5 7 2v4l2.5 1.5L12 6l2.5 1.5L17 6V2l-2.5 1.5z"/><path d="M7 8v8l5 3 5-3V8l-5-3-5 3z"/></svg>',
  'gcp-cloud-functions': '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'gcp-cloud-storage': '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
  'gcp-bigquery': '<svg viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M12 11v5M16 9v7"/></svg>',
  'kubernetes': '<svg viewBox="0 0 24 24" fill="none" stroke="#326CE5" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7.5 9.5l9 5M7.5 14.5l9-5"/></svg>',
  'docker': '<svg viewBox="0 0 24 24" fill="none" stroke="#2496ED" stroke-width="1.5"><path d="M4 12h3v3H4zM8 12h3v3H8zM12 12h3v3h-3zM8 8h3v3H8zM12 8h3v3h-3zM16 12h3v3h-3z"/><path d="M2 14c0 0 1 4 10 4s10-4 10-4"/></svg>',
  'database': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/></svg>',
  'server': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 7h.01M7 18h.01"/></svg>',
  'cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  'user': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  'load-balancer': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><path d="M12 8v3M9 13l-3 3M15 13l3 3"/></svg>',
  'firewall': '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18M15 3v18M3 15h18"/></svg>',
  'queue': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="2" y="7" width="4" height="10" rx="1"/><rect x="8" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="10" rx="1"/><path d="M20 12h2M20 10l2 2-2 2"/></svg>',
  'cache': '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  'cdn': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M2 12h20"/><path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z"/></svg>',
  'monitoring': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M7 13l3-3 2 2 5-5"/><path d="M8 21h8M12 17v4"/></svg>',
  'default': '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/></svg>',
};

function getIconSVG(iconName) {
  return CLOUD_ICONS[iconName] || CLOUD_ICONS['default'];
}

// ─── State ───────────────────────────────────────────────────────────────────

let currentMode = 'diagram'; // 'diagram' | 'document'
let attachedFiles = []; // File[]
let isGenerating = false;
let drawflowEditor = null;
let currentDiagramJSON = null; // Store current diagram JSON data

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
  initDiagramPreview();
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
      if (outputFormatGroup) outputFormatGroup.hidden = true; // always hidden now

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
    // Always use mermaid format for backend compatibility (output is JSON anyway)
    body.outputFormat = 'mermaid';
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

    showDiagramPreview(data.content);
    initCodeEditor(data.content, 'json');
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
  resultFormatBadge.textContent = data.diagramType || data.documentType || '';

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


// ─── Drawflow Diagram Renderer ───────────────────────────────────────────────

function initDrawflow() {
  const container = document.getElementById('drawflow');
  if (!container || drawflowEditor) return;

  drawflowEditor = new Drawflow(container);
  drawflowEditor.reroute = true;
  drawflowEditor.reroute_fix_curvature = true;
  drawflowEditor.force_first_input = false;
  drawflowEditor.start();
}

function renderDiagramFromJSON(jsonData) {
  if (!drawflowEditor) initDrawflow();
  if (!drawflowEditor) {
    showDiagramError('Drawflow library not loaded');
    return;
  }

  // Clear existing diagram
  drawflowEditor.clear();

  // Parse the JSON data
  let diagram;
  try {
    diagram = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  } catch {
    showDiagramError('Failed to parse diagram data');
    return;
  }

  // Store current diagram JSON
  currentDiagramJSON = diagram;

  // Add nodes
  const nodeIdMap = {}; // maps our node id to drawflow's internal id
  for (const node of diagram.nodes || []) {
    const html = createNodeHTML(node);
    const drawflowId = drawflowEditor.addNode(
      node.id,         // name
      1,               // inputs
      1,               // outputs
      node.x || 100,   // x position
      node.y || 100,   // y position
      node.group || '', // class
      {},              // data
      html             // html content
    );
    nodeIdMap[node.id] = drawflowId;
  }

  // Add connections
  for (const conn of diagram.connections || []) {
    const fromId = nodeIdMap[conn.from];
    const toId = nodeIdMap[conn.to];
    if (fromId && toId) {
      drawflowEditor.addConnection(fromId, toId, 'output_1', 'input_1');
    }
  }

  hideDiagramError();
}

function createNodeHTML(node) {
  const iconSvg = getIconSVG(node.icon);
  return `
    <div class="diagram-node" data-group="${node.group || ''}">
      <div class="diagram-node-icon">${iconSvg}</div>
      <div class="diagram-node-label">${escapeHtml(node.label)}</div>
    </div>
  `;
}

// ─── Diagram Preview Panel ───────────────────────────────────────────────────

const diagramPreviewSection = document.getElementById('diagram-preview-section');
const diagramPreviewViewport = document.getElementById('diagram-preview-viewport');
const diagramErrorBanner = document.getElementById('diagram-error-banner');
const diagramErrorMessage = document.getElementById('diagram-error-message');
const diagramFallbackCode = document.getElementById('diagram-fallback-code');
const diagramFallbackCodeContent = document.getElementById('diagram-fallback-code-content');
const zoomLevelIndicator = document.getElementById('zoom-level-indicator');

/**
 * Initialize diagram preview panel controls and event listeners.
 */
function initDiagramPreview() {
  if (!diagramPreviewSection) return;

  // Zoom controls
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomResetBtn = document.getElementById('zoom-reset-btn');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (drawflowEditor) {
        drawflowEditor.zoom_in();
        updateZoomIndicator();
      }
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (drawflowEditor) {
        drawflowEditor.zoom_out();
        updateZoomIndicator();
      }
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      if (drawflowEditor) {
        drawflowEditor.zoom_reset();
        updateZoomIndicator();
      }
    });
  }

  // Export controls
  const exportSvgBtn = document.getElementById('export-svg-btn');
  const exportPngBtn = document.getElementById('export-png-btn');
  const exportJpgBtn = document.getElementById('export-jpg-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');

  if (exportSvgBtn) exportSvgBtn.addEventListener('click', exportDiagramAsSvg);
  if (exportPngBtn) exportPngBtn.addEventListener('click', exportDiagramAsPng);
  if (exportJpgBtn) exportJpgBtn.addEventListener('click', exportDiagramAsJpg);
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportDiagramAsJSON);

  // Listen for code editor updates
  window.addEventListener('diagram-code-updated', (e) => {
    const { code } = e.detail;
    try {
      renderDiagramFromJSON(code);
    } catch {
      showDiagramError('Invalid diagram JSON');
    }
  });
}

function updateZoomIndicator() {
  if (!zoomLevelIndicator || !drawflowEditor) return;
  const zoom = drawflowEditor.zoom || 1;
  zoomLevelIndicator.textContent = `${Math.round(zoom * 100)}%`;
}

/**
 * Show the diagram preview panel and render diagram JSON.
 */
function showDiagramPreview(content) {
  if (!diagramPreviewSection) return;

  diagramPreviewSection.hidden = false;
  hideDiagramError();
  hideDiagramFallback();

  // Try parsing as JSON and rendering with Drawflow
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (parsed && parsed.nodes) {
      initDrawflow();
      renderDiagramFromJSON(parsed);
    } else {
      // Not valid diagram JSON, show as fallback
      showDiagramFallback(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
  } catch {
    // Not JSON at all — show as raw code fallback
    showDiagramFallback(content);
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

  // Hide the main drawflow viewport since we're showing raw code
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

// ─── Diagram Export Functions ─────────────────────────────────────────────────

function exportDiagramAsSvg() {
  const container = document.getElementById('drawflow');
  if (!container) return;

  // Serialize the drawflow container content as SVG
  const svgContent = drawflowToSVG(container);
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  downloadBlob(blob, 'diagram.svg');
}

function exportDiagramAsPng() {
  const container = document.getElementById('drawflow');
  if (!container) return;

  containerToImage(container, 'image/png', 'diagram.png');
}

function exportDiagramAsJpg() {
  const container = document.getElementById('drawflow');
  if (!container) return;

  containerToImage(container, 'image/jpeg', 'diagram.jpg');
}

function exportDiagramAsJSON() {
  if (!currentDiagramJSON) return;
  const json = JSON.stringify(currentDiagramJSON, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, 'diagram.json');
}

/**
 * Convert the drawflow container to an SVG string.
 */
function drawflowToSVG(container) {
  const rect = container.getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;

  // Create an SVG with a foreignObject containing the HTML
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
      ${container.innerHTML}
    </div>
  </foreignObject>
</svg>`;
}

/**
 * Convert container to a raster image using canvas.
 */
function containerToImage(container, mimeType, filename) {
  const rect = container.getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;

  // Use html2canvas approach via SVG foreignObject
  const svgStr = drawflowToSVG(container);
  const svgBase64 = btoa(unescape(encodeURIComponent(svgStr)));
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
    }, mimeType, 0.95);
  };
  img.onerror = () => {
    // Fallback: export as SVG
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    downloadBlob(blob, filename.replace(/\.(png|jpg)$/, '.svg'));
  };
  img.src = dataUrl;
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


// ─── Markdown Editor ─────────────────────────────────────────────────────────

const MD_MAX_CHARS = 100_000;
const MD_DEBOUNCE_MS = 500;

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

function showMarkdownEditor(content) {
  if (!mdEditorSection) return;

  mdEditorSection.hidden = false;
  mdEditorTextarea.value = content;

  initMarkdownIt();

  mdEditorTextarea.removeEventListener('input', handleMdEditorInput);
  mdEditorTextarea.addEventListener('input', handleMdEditorInput);

  mdSaveBtn.removeEventListener('click', handleMdSave);
  mdSaveBtn.addEventListener('click', handleMdSave);

  updateMdCharCounter();
  renderMarkdownPreview();
}

function hideMarkdownEditor() {
  if (!mdEditorSection) return;
  mdEditorSection.hidden = true;
}

function handleMdEditorInput() {
  const content = mdEditorTextarea.value;

  if (content.length > MD_MAX_CHARS) {
    mdEditorTextarea.value = content.slice(0, MD_MAX_CHARS);
    mdLimitNotification.hidden = false;
    mdEditorTextarea.disabled = true;

    setTimeout(() => {
      mdEditorTextarea.disabled = false;
      mdEditorTextarea.focus();
    }, 100);
  } else {
    mdLimitNotification.hidden = true;
  }

  updateMdCharCounter();

  if (mdDebounceTimer) {
    clearTimeout(mdDebounceTimer);
  }
  mdDebounceTimer = setTimeout(() => {
    renderMarkdownPreview();
  }, MD_DEBOUNCE_MS);
}

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

function renderMarkdownPreview() {
  const content = mdEditorTextarea.value;

  try {
    const md = initMarkdownIt();

    if (!md) {
      showRawTextFallback(content);
      return;
    }

    const html = md.render(content);
    mdPreviewContent.innerHTML = html;
    mdPreviewContent.classList.remove('raw-text');
    mdRenderError.hidden = true;
  } catch (err) {
    showRawTextFallback(content);
  }
}

function showRawTextFallback(content) {
  mdPreviewContent.textContent = content;
  mdPreviewContent.classList.add('raw-text');
  mdRenderError.hidden = false;
}

function handleMdSave() {
  const content = mdEditorTextarea.value;

  if (!content.trim()) return;

  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSaveConfirmation();
  } catch (err) {
    navigator.clipboard.writeText(content).then(() => {
      showSaveConfirmation();
    }).catch(() => {});
  }
}

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

const EDITOR_DEBOUNCE_MS = 2000;

const codeEditorSection = document.getElementById('code-editor-section');
const codeEditor = document.getElementById('code-editor');
const lineNumbers = document.getElementById('line-numbers');
const editorErrors = document.getElementById('editor-errors');
const editorStatus = document.getElementById('editor-status');

let editorDebounceTimer = null;
let lastValidRender = null;
let currentDiagramFormat = null;

function initCodeEditor(code, format) {
  if (!codeEditorSection || !codeEditor) return;

  currentDiagramFormat = format || 'json';

  // Pretty-print JSON for the code editor
  let displayCode = code;
  try {
    const parsed = JSON.parse(code);
    displayCode = JSON.stringify(parsed, null, 2);
  } catch {
    displayCode = code;
  }

  codeEditor.value = displayCode;
  lastValidRender = displayCode;

  codeEditorSection.hidden = false;
  updateLineNumbers();
  clearEditorErrors();
  setEditorStatus('');

  if (!codeEditor._editorInitialized) {
    codeEditor.addEventListener('input', onEditorInput);
    codeEditor.addEventListener('scroll', syncLineNumberScroll);
    codeEditor.addEventListener('keydown', onEditorKeydown);
    codeEditor._editorInitialized = true;
  }
}

function onEditorInput() {
  updateLineNumbers();
  setEditorStatus('Editing...', 'saving');

  if (editorDebounceTimer) {
    clearTimeout(editorDebounceTimer);
  }

  editorDebounceTimer = setTimeout(() => {
    triggerEditorReRender();
  }, EDITOR_DEBOUNCE_MS);
}

function onEditorKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    const value = codeEditor.value;

    codeEditor.value = value.substring(0, start) + '  ' + value.substring(end);
    codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;

    codeEditor.dispatchEvent(new Event('input'));
  }
}

async function triggerEditorReRender() {
  const code = codeEditor.value;

  if (!code.trim()) {
    clearEditorErrors();
    setEditorStatus('');
    return;
  }

  setEditorStatus('Rendering...', 'saving');

  try {
    // Validate JSON
    JSON.parse(code);
    clearEditorErrors();
    lastValidRender = code;
    setEditorStatus('Valid JSON', 'saved');

    // Update the diagram preview
    window.dispatchEvent(new CustomEvent('diagram-code-updated', {
      detail: { code, format: currentDiagramFormat }
    }));
  } catch (err) {
    displayEditorErrors([{
      line: 1,
      column: 1,
      message: `Invalid JSON: ${err.message}`,
      severity: 'error'
    }]);
    setEditorStatus('JSON errors', 'saving');
  }
}

function updateLineNumbers() {
  if (!lineNumbers || !codeEditor) return;

  const lineCount = codeEditor.value.split('\n').length;
  let html = '';

  for (let i = 1; i <= lineCount; i++) {
    html += `<span class="line-number" data-line="${i}">${i}</span>`;
  }

  lineNumbers.innerHTML = html;
}

function syncLineNumberScroll() {
  if (lineNumbers && codeEditor) {
    lineNumbers.scrollTop = codeEditor.scrollTop;
  }
}

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

function clearEditorErrors() {
  if (editorErrors) {
    editorErrors.innerHTML = '';
  }

  if (lineNumbers) {
    lineNumbers.querySelectorAll('.line-number.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }
}

function setEditorStatus(text, className) {
  if (!editorStatus) return;

  editorStatus.textContent = text;
  editorStatus.className = 'editor-status';
  if (className) {
    editorStatus.classList.add(className);
  }
}

function getEditorCode() {
  return codeEditor ? codeEditor.value : '';
}

function getLastValidRender() {
  return lastValidRender;
}

// ─── Code Editor Collapse/Expand ─────────────────────────────────────────────

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
