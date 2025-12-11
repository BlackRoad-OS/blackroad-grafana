import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { useStyles2, MultiCombobox, Field, ComboboxOption } from '@grafana/ui';

import { PinnedKeyConfig } from './types';

interface PinnedFilterDropdownProps {
  /** The pinned key configuration */
  keyConfig: PinnedKeyConfig;
  /** The parent AdHocFiltersVariable */
  variable: AdHocFiltersVariable;
  /** Currently selected values for this key */
  selectedValues: string[];
  /** Callback when values change */
  onValuesChange: (key: string, values: string[]) => void;
}

/**
 * Renders a single pinned filter as a multi-select dropdown.
 * This looks and behaves like a regular multi-select variable
 * but syncs with the AdHocFiltersVariable using the "one of" (=|) operator.
 */
export function PinnedFilterDropdown({
  keyConfig,
  variable,
  selectedValues,
  onValuesChange,
}: PinnedFilterDropdownProps) {
  const styles = useStyles2(getStyles);
  const [options, setOptions] = useState<Array<ComboboxOption<string>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Fetch options for this key
  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const ds = await getDataSourceSrv().get(variable.state.datasource);
      if (!ds || !ds.getTagValues) {
        setOptions([]);
        setLoading(false);
        return;
      }

      const timeRange = sceneGraph.getTimeRange(variable).state.value;

      const response = await ds.getTagValues({
        key: keyConfig.key,
        filters: [],
        timeRange,
      });

      if ('error' in response && response.error) {
        setError(response.error.message);
        setOptions([]);
      } else {
        const values = Array.isArray(response) ? response : response.data || [];
        setOptions(
          values.map((v) => ({
            label: v.text || String(v.value),
            value: String(v.value ?? v.text),
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [keyConfig.key, variable]);

  // Load options when component mounts or key changes
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Handle value changes
  const handleChange = useCallback(
    (selected: Array<ComboboxOption<string>>) => {
      const values = selected.map((s) => s.value).filter((v): v is string => v !== undefined);
      onValuesChange(keyConfig.key, values);
    },
    [keyConfig.key, onValuesChange]
  );

  // Convert selected values to combobox format
  const selectedOptions = useMemo(() => {
    return selectedValues.map((v) => {
      const opt = options.find((o) => o.value === v);
      return opt || { label: v, value: v };
    });
  }, [selectedValues, options]);

  const label = keyConfig.label || keyConfig.key;

  return (
    <div className={styles.container}>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <Field label={label} description={keyConfig.description} className={styles.field}>
        <MultiCombobox
          options={options}
          value={selectedOptions}
          onChange={handleChange}
          loading={loading}
          placeholder={t('dashboard-scene.pinned-filter.placeholder', 'Select {{label}}...', { label })}
          width={30}
          isClearable
        />
      </Field>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'flex-start',
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(1),
  }),
  field: css({
    marginBottom: 0,
  }),
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(0.5),
  }),
});
