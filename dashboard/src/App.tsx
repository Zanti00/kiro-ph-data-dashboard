/**
 * ============================================================================
 * PHILIPPINE FLOOD CONTROL DATA DASHBOARD
 * Workshop: Building High-Performance Dashboards with DuckDB-WASM
 * ============================================================================
 */

import { DuckDBProvider } from './contexts/DuckDBContext';
import { FilterProvider } from './contexts/FilterContext';
import { SummaryCards } from './components/SummaryCards';
import { BudgetByRegionChart } from './components/BudgetByRegionChart';
import { FilterToolbar } from './components/FilterToolbar';
import { ProjectMap } from './components/ProjectMap';
import { ProjectsOverTimeChart } from './components/ProjectsOverTimeChart';
import { CompletionStatusChart } from './components/CompletionStatusChart';
import { TopContractorsChart } from './components/TopContractorsChart';
import { TypeOfWorkChart } from './components/TypeOfWorkChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDuckDB } from './hooks/useDuckDB';

function DashboardContent() {
  const { loading, error, ready } = useDuckDB();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Initializing DuckDB-WASM
          </h2>
          <p className="text-gray-600">Loading 9,827 flood control projects...</p>
          <p className="text-sm text-gray-500 mt-2">Expected time: {'<'}3 seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-800 mb-2">
            ❌ Initialization Failed
          </h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🌊 Philippine Flood Control Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Powered by DuckDB-WASM • Zero Server Costs • Sub-100ms Queries
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Data Source</div>
              <div className="text-lg font-semibold text-blue-600">DPWH</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ErrorBoundary fallbackTitle="Filter Toolbar Error">
          <FilterToolbar />
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Summary Cards Error">
          <SummaryCards />
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Geographic Map Error">
          <ProjectMap />
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Budget By Region Chart Error">
          <BudgetByRegionChart />
        </ErrorBoundary>
        
        {/* 2-Column Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ErrorBoundary fallbackTitle="Projects Over Time Error">
            <ProjectsOverTimeChart />
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Completion Status Error">
            <CompletionStatusChart />
          </ErrorBoundary>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ErrorBoundary fallbackTitle="Top Contractors Error">
            <TopContractorsChart />
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Type of Work Error">
            <TypeOfWorkChart />
          </ErrorBoundary>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>
              <strong>Workshop Demo:</strong> Client-side analytics with DuckDB-WASM
            </p>
            <p className="mt-2">
              💡 <strong>Key Insight:</strong> All queries run in your browser.
              No API server. No database costs. Infinite scale on Vercel CDN.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <DuckDBProvider>
      <FilterProvider>
        <DashboardContent />
      </FilterProvider>
    </DuckDBProvider>
  );
}

export default App;
