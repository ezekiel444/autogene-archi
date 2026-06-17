import { toPng, toSvg } from 'html-to-image';

export async function exportDiagram(format: 'svg' | 'png' | 'json', data?: unknown) {
  const element = document.querySelector('.react-flow') as HTMLElement;
  if (!element && format !== 'json') return;

  if (format === 'json' && data) {
    const exportData = {
      ...(data as object),
      _meta: {
        generator: 'AI Diagram Generator by Ezekiel Matomi Lucky',
        exportedAt: new Date().toISOString(),
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    download(blob, 'diagram.json');
    return;
  }

  if (format === 'svg' && element) {
    const dataUrl = await toSvg(element, {
      filter: (node) => {
        // Skip minimap and controls from export
        if (node?.classList?.contains('react-flow__minimap')) return false;
        if (node?.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    download(blob, 'diagram.svg');
  } else if (format === 'png' && element) {
    const dataUrl = await toPng(element, {
      pixelRatio: 3,
      quality: 1,
      backgroundColor: '#ffffff',
      filter: (node) => {
        if (node?.classList?.contains('react-flow__minimap')) return false;
        if (node?.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    download(blob, 'diagram.png');
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
