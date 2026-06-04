import React, { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

const MAX_CHARS = 100_000;
const DEBOUNCE_MS = 500;

interface Props {
  content: string;
  onChange: (content: string) => void;
}

export function MarkdownEditor({ content, onChange }: Props) {
  const [source, setSource] = useState(content);
  const [preview, setPreview] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external content changes
  useEffect(() => {
    setSource(content);
    renderPreview(content);
  }, [content]);

  const renderPreview = useCallback((text: string) => {
    try {
      const html = md.render(text);
      setPreview(html);
    } catch {
      setPreview(`<pre>${text}</pre>`);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = e.target.value;

    // Enforce max chars
    if (value.length > MAX_CHARS) {
      value = value.slice(0, MAX_CHARS);
    }

    setSource(value);
    onChange(value);

    // Debounce preview rendering
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      renderPreview(value);
    }, DEBOUNCE_MS);
  };

  const handleSave = () => {
    if (!source.trim()) return;

    try {
      const blob = new Blob([source], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowSaveConfirm(true);
      setTimeout(() => setShowSaveConfirm(false), 3000);
    } catch {
      // Fallback to clipboard
      navigator.clipboard.writeText(source);
      setShowSaveConfirm(true);
      setTimeout(() => setShowSaveConfirm(false), 3000);
    }
  };

  return (
    <div className="markdown-editor-section" aria-label="Markdown editor">
      <div className="markdown-editor-header">
        <h3 className="markdown-editor-title">Document Editor</h3>
        <div className="markdown-editor-actions">
          <span className="md-char-counter" aria-live="polite">
            {source.length.toLocaleString()} / 100,000
          </span>
          <button
            type="button"
            className="md-save-btn"
            onClick={handleSave}
            aria-label="Save document"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>Save</span>
          </button>
        </div>
      </div>

      {showSaveConfirm && (
        <div className="md-save-confirmation" role="status" aria-live="polite">
          Document saved successfully.
        </div>
      )}

      {source.length >= MAX_CHARS && (
        <div className="md-limit-notification" role="alert" aria-live="assertive">
          Content exceeds the 100,000 character limit. Further input is disabled.
        </div>
      )}

      <div className="markdown-split-pane">
        <div className="markdown-pane markdown-pane-editor">
          <div className="markdown-pane-label">Markdown</div>
          <textarea
            className="md-editor-textarea"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="Markdown source editor"
            placeholder="Edit your Markdown document here..."
            value={source}
            onChange={handleInput}
          />
        </div>
        <div className="markdown-pane-divider" aria-hidden="true" />
        <div className="markdown-pane markdown-pane-preview">
          <div className="markdown-pane-label">Preview</div>
          <div
            className="md-preview-content"
            role="document"
            aria-label="Rendered Markdown preview"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}
