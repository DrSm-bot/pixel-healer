import { lazy, Suspense } from 'react';
import { useAppStore } from '@/store/app-store';
import { FolderSelect } from './FolderSelect';
import { AnalysisView } from './AnalysisView';
import { ProcessingView } from './ProcessingView';
import { ResultsView } from './ResultsView';

const DevPanel = import.meta.env.DEV
  ? lazy(() => import('@/dev/DevPanel').then((module) => ({ default: module.DevPanel })))
  : null;

function StepIndicator() {
  const step = useAppStore((s) => s.step);

  const steps = [
    { id: 'select', label: 'Select' },
    { id: 'analyze', label: 'Analyze' },
    { id: 'review', label: 'Review' },
    { id: 'process', label: 'Process' },
    { id: 'complete', label: 'Done' },
  ];

  const currentIndex = steps.findIndex((s) => s.id === step);
  const isWorkflowComplete = step === 'complete';

  return (
    <div className="flex items-center justify-center gap-2 py-4 px-8 bg-cosmos-900/30">
      {steps.map((s, i) => {
        const isDone = i < currentIndex || (isWorkflowComplete && i === currentIndex);

        return (
          <div key={s.id} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${isDone ? 'bg-green-600 text-white' : ''}
                ${!isDone && i === currentIndex ? 'bg-cosmos-600 text-white' : ''}
                ${i > currentIndex ? 'bg-cosmos-800 text-gray-500' : ''}
              `}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:inline
                ${i <= currentIndex ? 'text-white' : 'text-gray-500'}
              `}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 mx-2
                  ${i < currentIndex ? 'bg-green-600' : 'bg-cosmos-800'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorBanner() {
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);

  if (!error) return null;

  return (
    <div className="bg-red-900/30 border-b border-red-500/30 px-8 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <p className="font-medium text-red-400">{error.message}</p>
          {error.details && (
            <p className="text-sm text-red-300/70">{error.details}</p>
          )}
        </div>
        <button
          onClick={() => setError(null)}
          className="text-red-400 hover:text-red-300 px-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function App() {
  const step = useAppStore((s) => s.step);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-cosmos-900/50 border-b border-cosmos-800">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔭</span>
            <h1 className="text-xl font-bold">Pixel Healer</h1>
          </div>
          <a
            href="https://github.com/DrSm-bot/pixel-healer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Step Indicator */}
      <StepIndicator />

      {/* Error Banner */}
      <ErrorBanner />

      {/* Main Content */}
      <main className="flex-1">
        {step === 'select' && <FolderSelect />}
        {step === 'analyze' && <AnalysisView />}
        {step === 'review' && <AnalysisView />} {/* Reuse for now, will enhance later */}
        {step === 'process' && <ProcessingView />}
        {step === 'complete' && <ResultsView />}
      </main>

      {/* Footer */}
      <footer className="bg-cosmos-900/30 border-t border-cosmos-800 py-4 px-8">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>
            100% local processing — your images never leave your computer.
          </p>
        </div>
      </footer>

      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </div>
  );
}
