import { useClassStore, useStudentStore, useUIStore } from './stores';
import { StudentView } from './components/students/StudentView';
import { ClassesView } from './components/classes/ClassesView';
import { SortingView } from './components/sorting/SortingView';
import { ResultsView } from './components/results/ResultsView';

type View = 'students' | 'classes' | 'sorting' | 'results';

const navItems: { id: View; label: string; step: number }[] = [
  { id: 'students', label: 'Pupils', step: 1 },
  { id: 'classes', label: 'Classes', step: 2 },
  { id: 'sorting', label: 'Create Groups', step: 3 },
  { id: 'results', label: 'Review Groups', step: 4 },
];

function App() {
  const { currentView, setView } = useUIStore();
  const { students } = useStudentStore();
  const { classes } = useClassStore();

  const hasPupils = students.length > 0;
  const hasClasses = classes.length > 0;
  const hasResults = students.some((student) => student.assignedClassId !== null);

  const stepStatus: Record<View, 'complete' | 'current' | 'upcoming'> = {
    students: hasPupils ? 'complete' : currentView === 'students' ? 'current' : 'upcoming',
    classes: hasClasses ? 'complete' : currentView === 'classes' ? 'current' : 'upcoming',
    sorting:
      hasPupils && hasClasses
        ? currentView === 'sorting' && !hasResults
          ? 'current'
          : hasResults
            ? 'complete'
            : 'current'
        : 'upcoming',
    results: hasResults ? (currentView === 'results' ? 'current' : 'complete') : 'upcoming',
  };

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
      default:
        return <StudentView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
                Class Sorter
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Create balanced classes without the spreadsheet juggling
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Work through the four steps below. Advanced controls stay available, but the main flow
                keeps the setup simple.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[24rem]">
              <HeaderStat label="Pupils" value={students.length.toString()} />
              <HeaderStat label="Classes" value={classes.length.toString()} />
              <HeaderStat label="Status" value={hasResults ? 'Ready to review' : hasPupils && hasClasses ? 'Ready to create groups' : 'Setup needed'} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {navItems.map((item) => {
              const status = stepStatus[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    currentView === item.id
                      ? 'border-sky-600 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Step {item.step}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{item.label}</p>
                    </div>
                    <StepBadge status={status} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">{renderView()}</main>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StepBadge({ status }: { status: 'complete' | 'current' | 'upcoming' }) {
  const badgeClassName =
    status === 'complete'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'current'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-slate-200 text-slate-600';

  const label =
    status === 'complete' ? 'Done' : status === 'current' ? 'Current' : 'Waiting';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName}`}>
      {label}
    </span>
  );
}

export default App;
