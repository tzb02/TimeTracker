import { initializeMockDatabase, getDatabase } from './index';

let resetFlag = false;

export function resetDatabase(): void {
  resetFlag = true;
}

export { initializeMockDatabase, getDatabase };