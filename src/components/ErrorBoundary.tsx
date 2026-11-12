import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white border border-slate-300 rounded-lg p-8 max-w-md shadow-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Une erreur inattendue est survenue
            </h1>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Une extension du navigateur ou une modification du texte a interrompu l'affichage. Veuillez recharger la page pour reprendre votre session.
            </p>
            {this.state.error && (
              <div className="mb-4 text-left p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs font-mono overflow-auto max-h-48">
                <div className="font-bold mb-1">Détail de l'erreur :</div>
                <div className="text-[11px] whitespace-pre-wrap">{this.state.error.message || String(this.state.error)}</div>
                {this.state.error.stack && (
                  <div className="mt-2 text-[10px] text-red-600 whitespace-pre-wrap">{this.state.error.stack}</div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-xs"
            >
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
