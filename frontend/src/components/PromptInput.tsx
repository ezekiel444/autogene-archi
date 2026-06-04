import React, { useState, useEffect } from 'react';
import type { Mode } from '../App';

interface Template {
  id: string;
  name: string;
  type: string;
}

interface Props {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onGenerate: (prompt: string, options: Record<string, string>) => void;
  isLoading: boolean;
  error: string | null;
}

const DIAGRAM_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'flowchart', label: 'Flowchart' },
  { value: 'er-diagram', label: 'ER Diagram' },
  { value: 'cloud-architecture', label: 'Cloud Architecture' },
  { value: 'sequence', label: 'Sequence Diagram' },
  { value: 'bpmn', label: 'BPMN' },
  { value: 'class-diagram', label: 'Class Diagram' },
  { value: 'network', label: 'Network Diagram' },
  { value: 'state-diagram', label: 'State Diagram' },
  { value: 'data-flow', label: 'Data Flow' },
];

export function PromptInput({ mode, onModeChange, onGenerate, isLoading, error }: Props) {
  const [prompt, setPrompt] = useState('');
  const [diagramType, setDiagramType] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    loadTemplates();
  }, [mode]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) return;
      const data: Template[] = await response.json();
      setTemplates(data.filter((t) => t.type === mode));
    } catch {
      // Templates API not available, continue without
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const options: Record<string, string> = {};
    if (diagramType) options.diagramType = diagramType;
    if (templateId) options.templateId = templateId;
    if (mode === 'diagram') options.outputFormat = 'mermaid';

    onGenerate(prompt, options);
  };

  return (
    <div className="prompt-section">
      {/* Mode Toggle */}
      <div className="mode-toggle" role="tablist" aria-label="Generation mode">
        <button
          className={`mode-tab ${mode === 'diagram' ? 'active' : ''}`}
          role="tab"
          aria-selected={mode === 'diagram'}
          onClick={() => onModeChange('diagram')}
        >
          Generate Diagram
        </button>
        <button
          className={`mode-tab ${mode === 'document' ? 'active' : ''}`}
          role="tab"
          aria-selected={mode === 'document'}
          onClick={() => onModeChange('document')}
        >
          Generate Document
        </button>
      </div>

      {/* Generation Form */}
      <form className="generation-card" onSubmit={handleSubmit} aria-label="Generation request form">
        {/* Prompt Textarea */}
        <div className="form-group prompt-group">
          <label htmlFor="prompt-input" className="form-label">
            Describe what you need
          </label>
          <textarea
            id="prompt-input"
            className={`prompt-textarea ${error ? 'has-error' : ''}`}
            placeholder={
              mode === 'diagram'
                ? 'e.g. Create a flowchart showing a user login process with email verification...'
                : 'e.g. Write a technical specification for a REST API authentication system...'
            }
            rows={6}
            maxLength={10000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            required
          />
          <div className="prompt-meta">
            {error && (
              <span className="validation-error" role="alert">
                {error}
              </span>
            )}
            <span className="char-counter" aria-live="polite">
              {prompt.length.toLocaleString()} / 10,000
            </span>
          </div>
        </div>

        {/* Options Row */}
        <div className="options-row">
          {/* Template Selection */}
          <div className="form-group">
            <label htmlFor="template-select" className="form-label">
              Template
            </label>
            <select
              id="template-select"
              className="form-select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">None (free-form)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Diagram Type (only in diagram mode) */}
          {mode === 'diagram' && (
            <div className="form-group">
              <label htmlFor="diagram-type-select" className="form-label">
                Diagram Type
              </label>
              <select
                id="diagram-type-select"
                className="form-select"
                value={diagramType}
                onChange={(e) => setDiagramType(e.target.value)}
              >
                {DIAGRAM_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="generate-btn"
            disabled={isLoading || !prompt.trim()}
            aria-label="Generate output"
          >
            {isLoading ? (
              <>
                <span className="btn-spinner" aria-hidden="true">
                  <svg
                    className="spinner-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                  </svg>
                </span>
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
