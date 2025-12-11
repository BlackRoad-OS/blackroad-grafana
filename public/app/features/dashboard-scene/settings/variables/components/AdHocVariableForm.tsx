import { FormEvent, useCallback } from 'react';

import { DataSourceInstanceSettings, MetricFindValue, readCSV } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { EditorField } from '@grafana/plugin-ui';
import { DataSourceRef } from '@grafana/schema';
import { Alert, CodeEditor, Field, Switch, Box, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { PinnedKeyConfig } from '../../../variables/PinnedAdHocFilters/types';

import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableLegend } from './VariableLegend';

export interface AdHocVariableFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings) => void;
  allowCustomValue?: boolean;
  infoText?: string;
  defaultKeys?: MetricFindValue[];
  onDefaultKeysChange?: (keys?: MetricFindValue[]) => void;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  inline?: boolean;
  datasourceSupported: boolean;
  /** Pinned keys that should always be visible as multi-select dropdowns */
  pinnedKeys?: PinnedKeyConfig[];
  onPinnedKeysChange?: (keys?: PinnedKeyConfig[]) => void;
}

export function AdHocVariableForm({
  datasource,
  infoText,
  allowCustomValue,
  onDataSourceChange,
  onDefaultKeysChange,
  onAllowCustomValueChange,
  defaultKeys,
  inline,
  datasourceSupported,
  pinnedKeys,
  onPinnedKeysChange,
}: AdHocVariableFormProps) {
  const updateStaticKeys = useCallback(
    (csvContent: string) => {
      const df = readCSV('key,value\n' + csvContent)[0];
      const options = [];
      for (let i = 0; i < df.length; i++) {
        options.push({ text: df.fields[0].values[i], value: df.fields[1].values[i] });
      }

      onDefaultKeysChange?.(options);
    },
    [onDefaultKeysChange]
  );

  const updatePinnedKeys = useCallback(
    (csvContent: string) => {
      // Parse CSV format: key,label,description (label and description are optional)
      const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
      const keys: PinnedKeyConfig[] = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          key: parts[0] || '',
          label: parts[1] || undefined,
          description: parts[2] || undefined,
        };
      });
      onPinnedKeysChange?.(keys.filter((k) => k.key.length > 0));
    },
    [onPinnedKeysChange]
  );

  return (
    <>
      {!inline && (
        <VariableLegend>
          <Trans i18nKey="dashboard-scene.ad-hoc-variable-form.adhoc-options">Ad-hoc options</Trans>
        </VariableLegend>
      )}

      <Box marginBottom={2}>
        <EditorField
          label={t('dashboard-scene.ad-hoc-variable-form.label-data-source', 'Data source')}
          htmlFor="data-source-picker"
          tooltip={infoText}
        >
          <DataSourcePicker
            current={datasource}
            onChange={onDataSourceChange}
            width={30}
            variables={true}
            dashboard={true}
            noDefault
          />
        </EditorField>
      </Box>

      {datasourceSupported === false ? (
        <Alert
          title={t(
            'dashboard-scene.ad-hoc-variable-form.alert-not-supported',
            'This data source does not support ad hoc filters'
          )}
          severity="warning"
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.infoText}
        />
      ) : null}

      {datasourceSupported && onDefaultKeysChange && (
        <>
          <Field
            label={t(
              'dashboard-scene.ad-hoc-variable-form.label-use-static-key-dimensions',
              'Use static key dimensions'
            )}
            description={t(
              'dashboard-scene.ad-hoc-variable-form.description-provide-dimensions-as-csv-dimension-name-dimension-id',
              'Provide dimensions as CSV: {{name}}, {{value}}',
              { name: 'dimensionName', value: 'dimensionId' }
            )}
          >
            <Switch
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.AdHocFiltersVariable.modeToggle}
              value={defaultKeys != null}
              onChange={(e) => {
                if (defaultKeys == null) {
                  onDefaultKeysChange([]);
                } else {
                  onDefaultKeysChange(undefined);
                }
              }}
            />
          </Field>

          {defaultKeys != null && (
            <CodeEditor
              height={300}
              language="csv"
              value={defaultKeys.map((o) => `${o.text},${o.value}`).join('\n')}
              onBlur={updateStaticKeys}
              onSave={updateStaticKeys}
              showMiniMap={false}
              showLineNumbers={true}
            />
          )}
        </>
      )}

      {datasourceSupported && onAllowCustomValueChange && (
        <VariableCheckboxField
          value={allowCustomValue ?? true}
          name={t('dashboard-scene.ad-hoc-variable-form.name-allow-custom-values', 'Allow custom values')}
          description={t(
            'dashboard-scene.ad-hoc-variable-form.description-enables-users-custom-values',
            'Enables users to add custom values to the list'
          )}
          onChange={onAllowCustomValueChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
        />
      )}

      {datasourceSupported && onPinnedKeysChange && (
        <>
          {/* eslint-disable-next-line no-restricted-syntax */}
          <Field
            label={t('dashboard-scene.ad-hoc-variable-form.label-pinned-filters', 'Pinned filters')}
            description={t(
              'dashboard-scene.ad-hoc-variable-form.description-pinned-filters',
              'Keys that are always visible as multi-select dropdowns (one per line: key,label,description)'
            )}
          >
            <Switch
              data-testid="AdHocFiltersVariable-pinned-keys-toggle"
              value={pinnedKeys != null && pinnedKeys.length > 0}
              onChange={() => {
                if (pinnedKeys == null || pinnedKeys.length === 0) {
                  onPinnedKeysChange([]);
                } else {
                  onPinnedKeysChange(undefined);
                }
              }}
            />
          </Field>

          {pinnedKeys != null && (
            <>
              <Box marginBottom={1}>
                <Text color="secondary" variant="bodySmall">
                  <Trans i18nKey="dashboard-scene.ad-hoc-variable-form.pinned-keys-format">
                    Enter one key per line. Optional: key,label,description
                  </Trans>
                </Text>
              </Box>
              <CodeEditor
                height={150}
                language="plaintext"
                value={pinnedKeys.map((k) => [k.key, k.label || '', k.description || ''].join(',')).join('\n')}
                onBlur={updatePinnedKeys}
                onSave={updatePinnedKeys}
                showMiniMap={false}
                showLineNumbers={true}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
