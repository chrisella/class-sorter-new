import { useUIStore } from './stores';
import { StudentView } from './components/students/StudentView';
import { ClassesView } from './components/classes/ClassesView';
import { SortingView } from './components/sorting/SortingView';
import { ResultsView } from './components/results/ResultsView';
import { StatisticsView } from './components/statistics/StatisticsView';

type View = 'students' | 'classes' | 'sorting' | 'results' | 'statistics';

const navItems: { id: View; label: string }[] = [
  { id: 'students', label: 'Students' },
  { id: 'classes', label: 'Classes' },
  { id: 'sorting', label: 'Sort' },
  { id: 'results', label: 'Results' },
  { id: 'statistics', label: 'Statistics' },
];

function App() {
  const { currentView, setView } = useUIStore();

  const renderView = () => {
    switch (currentView) {
      case 'students':
        return <StudentView />;
      case 'classes':
        return <ClassesView />;
      case 'sorting':
        return <SortingView />;
      case 'results':
        return <ResultsView />;
      case 'statistics':
        return <StatisticsView />;
      default:
        return <StudentView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Class Sorter</h1>
        <p className="text-sm text-gray-500">Organize students into balanced classes</p>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                currentView === item.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
