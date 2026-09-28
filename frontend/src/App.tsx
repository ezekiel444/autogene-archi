import React, { useState } from 'react';
import { Header } from './components/Header';
import { PromptInput } from './components/PromptInput';
import { DiagramCanvas } from './components/DiagramCanvas';
import { DiagramErrorBoundary } from './components/DiagramErrorBoundary';
import { MarkdownEditor } from './components/MarkdownEditor';
import { useGenerate } from './hooks/useGenerate';
import { parseDiagramGraph, type DiagramData } from './utils/parseDiagramGraph';

export type Mode = 'diagram' | 'document';
export type { DiagramData } from './utils/parseDiagramGraph';

export default function App() {
  const [mode, setMode] = useState<Mode>('diagram');
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');

  const { generate, isLoading, error, setError } = useGenerate();

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

    if (mode === 'diagram' || result.outputType === 'diagram') {
      setError('The response did not contain a renderable diagram. Please try again.');
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
