import React, { useState } from 'react';
import { Header } from './components/Header';
import { PromptInput } from './components/PromptInput';
import { DiagramCanvas } from './components/DiagramCanvas';
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

export default function App() {
  const [mode, setMode] = useState<Mode>('diagram');
  const [diagramData, setDiagramData] = useState<DiagramData | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');

  const { generate, isLoading, error } = useGenerate();

  const handleGenerate = async (prompt: string, options: Record<string, string>) => {
    const result = await generate(prompt, { ...options, mode });

    if (result) {
      if (result.outputType === 'diagram') {
        try {
          const parsed = JSON.parse(result.content);
          setDiagramData(parsed);
          setDocumentContent('');
        } catch {
          // If not valid JSON, show as document
          setDocumentContent(result.content);
          setDiagramData(null);
        }
      } else {
        setDocumentContent(result.content);
        setDiagramData(null);
      }
    }
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
          <DiagramCanvas data={diagramData} onChange={setDiagramData} />
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
