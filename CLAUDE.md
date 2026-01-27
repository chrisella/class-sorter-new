# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run the Electron desktop app (launches Vite dev server + Electron)
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

**Prerequisites:** Node.js

## Architecture

This is an **Electron** desktop application for teachers to sort students into balanced classes. The frontend is React 19 + TypeScript + Vite, with Tailwind CSS for styling.

### State Management

Uses **Zustand** with localStorage persistence. Three stores in `src/stores/`:

- **studentStore** - Student CRUD, CSV import, class assignments. Key: `class-sorter-students`
- **classStore** - Class CRUD, sorting configuration, sorting results. Key: `class-sorter-classes`
- **uiStore** - Navigation state (current view, sorting progress)

### Data Model

**Student** (`src/types/student.ts`):
- `id`, `name`, `gender` ('male'|'female'), `isEAL` (boolean)
- `preferredFriends` (max 3 student IDs), `blacklistedStudents` (student IDs)
- `assignedClassId`

**Class** (`src/types/class.ts`):
- `id`, `name`, `targetSize`, `teacherName`

### Views

Tab-based navigation in `App.tsx` with five views:
1. **Students** - Table with inline editing for gender/EAL, CSV import
2. **Classes** - Define target classes for sorting
3. **Sort** - Configure and run the sorting algorithm
4. **Results** - View/modify class assignments
5. **Statistics** - Class balance metrics

### Sorting Algorithm

`src/utils/sortingAlgorithm.ts` uses **simulated annealing**:
- Greedy initial assignment (most constrained students first)
- Hard constraint: blacklist violations are never allowed
- Soft constraints optimized: friend placement, gender balance, EAL balance
- Runs in chunks via setTimeout to avoid blocking UI

### Component Patterns

- Components organized by feature: `src/components/{students,classes,sorting,results,statistics}/`
- Table rendering uses **TanStack React Table**
- Multi-select dropdowns use custom `StudentSelect` component
- Forms use controlled inputs with local state, then call store actions on submit

## Documentation

Keep these files updated when making changes:
- **PLAN.md** - Update "Implemented Features" section when adding new functionality
- **CLAUDE.md** - Update architecture/patterns sections if introducing new patterns or significant structural changes
