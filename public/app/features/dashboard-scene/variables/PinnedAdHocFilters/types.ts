import { MetricFindValue } from '@grafana/data';

/**
 * Configuration for a pinned/static filter key that should always be visible
 * in the dashboard UI as a multi-select dropdown.
 */
export interface PinnedKeyConfig {
  /** The key/field name (e.g., "environment", "region", "host") */
  key: string;
  /** Display label for the filter (defaults to key if not provided) */
  label?: string;
  /** Optional description shown as tooltip */
  description?: string;
}

/**
 * Extended state for AdHocFiltersVariable with pinned keys support
 */
export interface PinnedAdHocFiltersConfig {
  /** Keys that should always be visible as multi-select dropdowns */
  pinnedKeys?: PinnedKeyConfig[];
}

/**
 * Represents the current values selected for a pinned filter
 */
export interface PinnedFilterValue {
  key: string;
  values: string[];
}

/**
 * Options loaded for a pinned filter dropdown
 */
export interface PinnedFilterOptions {
  key: string;
  options: MetricFindValue[];
  loading: boolean;
  error?: string;
}
