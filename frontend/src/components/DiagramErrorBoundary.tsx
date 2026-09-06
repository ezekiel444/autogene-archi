import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches runtime errors thrown while rendering the diagram canvas so that a
 * crash surfaces a visible message instead of silently failing (which
 * previously could leave the UI showing raw content elsewhere).
 */
export class DiagramErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    // Surface to the console for debugging.
    // eslint-disable-next-line no-console
    console.error('[DiagramCanvas] render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            margin: '16px',
            padding: '16px',
            border: '1px solid #fca5a5',
            background: '#fef2f2',
            borderRadius: 8,
            color: '#991b1b',
            fontFamily: 'sans-serif',
          }}
        >
          <strong>The diagram failed to render.</strong>
          <div style={{ marginTop: 8, fontSize: 13 }}>{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
