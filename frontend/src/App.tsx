import React, { useState } from 'react';
import { Header } from './components/Header';
import { PromptInput } from './components/PromptInput';
import { DiagramCanvas } from './components/DiagramCanvas';
import { DiagramErrorBoundary } from './components/DiagramErrorBoundary';
import { MarkdownEditor } from './components/MarkdownEditor';
import { useGenerate } from './hooks/useGenerate';

export type Mode = 'diagram' | 'document';

export interface DiagramData {
  nodes: Array<{
    id: string;
    label: string;
    icon: string;
    group?: string;
    x: number;
    y: number;
  }>;
  connections: Array<{
    from: string;
    to: string;
    label?: string;
    color?: string;
    arrowStyle?: 'closed' | 'open' | 'none';
  }>;
  groups: Array<{
    id: string;
    label: string;
    color: string;
  }>;
}

/**
 * Returns the parsed node-graph if `content` is a diagram payload
 * (`{ nodes: [...], connections: [...] }` with at least one valid node),
 * otherwise null. Used to render diagrams by content shape rather than
 * relying solely on the API's outputType label.
 */
function parseDiagramGraph(content: string): DiagramData | null {
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as { nodes?: unknown; connections?: unknown };
  if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) return null;
  const hasValidNode = obj.nodes.some(
    (n) => typeof n === 'object' && n !== null && typeof (n as { id?: unknown }).id === 'string',
  );
  if (!hasValidNode) return null;
  // connections is optional but must be an array when present.
  if (obj.connections !== undefined && !Array.isArray(obj.connections)) return null;
  return parsed as DiagramData;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('diagram');
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');

  const { generate, isLoading, error } = useGenerate();

  const showDiagram = (data: DiagramData) => {
    setDiagramData(data);
    setDocumentContent('');
  };

  const showDocument = (content: string) => {
    setDocumentContent(content);
    setDiagramData(null);
  };

  const handleGenerate = async (prompt: string, options: Record<string, string>) => {
    const result = await generate(prompt, { ...options, mode });
    if (!result) return;

    // Prefer content shape over the response's outputType label. A node-graph
    // payload ({ nodes, connections }) must always render on the canvas, even
    // if the API mislabels it as a document (e.g. a stale serverless deploy).
    const graph = parseDiagramGraph(result.content);
    if (graph) {
      showDiagram(graph);
      return;
    }

    if (result.outputType === 'diagram') {
      // outputType says diagram but content isn't a parseable graph — surface
      // the raw content in the editor so nothing is silently lost.
      showDocument(result.content);
      return;
    }

    showDocument(result.content);
  };

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <PromptInput
          mode={mode}
          onModeChange={setMode}
          onGenerate={handleGenerate}
          isLoading={isLoading}
          error={error}
        />

        {diagramData && (
          <DiagramErrorBoundary>
            <DiagramCanvas data={diagramData} onChange={setDiagramData} />
          </DiagramErrorBoundary>
        )}

        {documentContent && !diagramData && (
          <MarkdownEditor content={documentContent} onChange={setDocumentContent} />
        )}
      </main>
      <footer className="app-footer">
        <p><strong>Ezekiel Matomi Lucky</strong></p>
      </footer>
    </div>
  );
}
