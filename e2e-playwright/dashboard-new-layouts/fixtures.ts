import { test as base } from '@grafana/plugin-e2e';

import { importTestDashboard } from './utils';

type ImportDashboardFn = (title: string, dashJSON?: string) => Promise<string>;

/**
 * Extended test fixtures for dashboard-new-layouts tests.
 * Provides `importDashboard` - a wrapped version of `importTestDashboard` that
 * automatically cleans up dashboards after each test.
 */
export const test = base.extend<{ importDashboard: ImportDashboardFn }>({
  // imports dashboard and cleans it up after the test
  importDashboard: async ({ page, selectors, request }, use) => {
    const importedUIDs: string[] = [];

    const importDashboard: ImportDashboardFn = async (title, dashJSON) => {
      const uid = await importTestDashboard(page, selectors, title, dashJSON);
      importedUIDs.push(uid);
      return uid;
    };

    await use(importDashboard);

    for (const uid of importedUIDs) {
      await request.delete(`/api/dashboards/uid/${uid}`);
    }
  },
});

export { expect } from '@grafana/plugin-e2e';
