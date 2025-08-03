import { lazy } from 'react';

// Lazy load heavy components
export const LazyTimerPage = lazy(() => 
  import('./features/TimerPage').then(module => ({ default: module.TimerPage }))
);

export const LazyTimeEntryPage = lazy(() => 
  import('./features/TimeEntryPage').then(module => ({ default: module.TimeEntryPage }))
);

export const LazyReportsPage = lazy(() => 
  import('./features/ReportsPage').then(module => ({ default: module.ReportsPage }))
);

export const LazyProjectManagement = lazy(() => 
  import('./features/ProjectManagement').then(module => ({ default: module.ProjectManagement }))
);

// UserSettings component not yet implemented
// export const LazyUserSettings = lazy(() => 
//   import('./features/UserSettings').then(module => ({ default: module.UserSettings }))
// );