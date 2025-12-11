import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, AdHocFilterWithLabels } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { PinnedFilterDropdown } from './PinnedFilterDropdown';
import { PinnedKeyConfig } from './types';

/** The operator used for pinned filters - "one of" */
const PINNED_FILTER_OPERATOR = '=|';

interface PinnedAdHocFiltersRendererProps {
  /** The AdHocFiltersVariable to sync with */
  variable: AdHocFiltersVariable;
  /** The keys that should be pinned/always visible */
  pinnedKeys: PinnedKeyConfig[];
}

/**
 * Renders pinned AdHoc filter keys as always-visible multi-select dropdowns.
 * These filters use the "one of" (=|) operator and sync with the parent
 * AdHocFiltersVariable.
 */
export function PinnedAdHocFiltersRenderer({ variable, pinnedKeys }: PinnedAdHocFiltersRendererProps) {
  const styles = useStyles2(getStyles);
  const variableState = variable.useState();

  // Extract current values for pinned keys from the variable's filters
  const pinnedFilterValues = useMemo(() => {
    const values: Record<string, string[]> = {};

    for (const config of pinnedKeys) {
      values[config.key] = [];
    }

    // Find filters that match our pinned keys
    for (const filter of variableState.filters) {
      if (pinnedKeys.some((pk) => pk.key === filter.key)) {
        // Handle both single values and multi-values
        if (filter.operator === PINNED_FILTER_OPERATOR && filter.value) {
          // Multi-value operator: value is pipe-separated
          values[filter.key] = filter.value.split('|').filter((v) => v.length > 0);
        } else if (filter.operator === '=' && filter.value) {
          // Single value equality
          values[filter.key] = [filter.value];
        }
      }
    }

    return values;
  }, [variableState.filters, pinnedKeys]);

  // Handle value changes from a pinned filter dropdown
  const handleValuesChange = useCallback(
    (key: string, newValues: string[]) => {
      const currentFilters = [...variableState.filters];

      // Find existing filter for this key
      const existingFilterIndex = currentFilters.findIndex(
        (f) => f.key === key && (f.operator === PINNED_FILTER_OPERATOR || f.operator === '=')
      );

      if (newValues.length === 0) {
        // Remove the filter if no values selected
        if (existingFilterIndex >= 0) {
          currentFilters.splice(existingFilterIndex, 1);
          variable.setState({ filters: currentFilters });
        }
      } else if (newValues.length === 1) {
        // Use single value operator for one value
        const newFilter: AdHocFilterWithLabels = {
          key,
          operator: '=',
          value: newValues[0],
          valueLabels: newValues,
        };

        if (existingFilterIndex >= 0) {
          currentFilters[existingFilterIndex] = newFilter;
        } else {
          currentFilters.push(newFilter);
        }
        variable.setState({ filters: currentFilters });
      } else {
        // Use multi-value operator for multiple values
        const newFilter: AdHocFilterWithLabels = {
          key,
          operator: PINNED_FILTER_OPERATOR,
          value: newValues.join('|'),
          valueLabels: newValues,
        };

        if (existingFilterIndex >= 0) {
          currentFilters[existingFilterIndex] = newFilter;
        } else {
          currentFilters.push(newFilter);
        }
        variable.setState({ filters: currentFilters });
      }
    },
    [variable, variableState.filters]
  );

  if (pinnedKeys.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {pinnedKeys.map((keyConfig) => (
        <PinnedFilterDropdown
          key={keyConfig.key}
          keyConfig={keyConfig}
          variable={variable}
          selectedValues={pinnedFilterValues[keyConfig.key] || []}
          onValuesChange={handleValuesChange}
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  }),
});
