import { noop } from 'lodash';
import { FormEvent } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { PinnedKeyConfig } from '../../../variables/PinnedAdHocFilters/types';
import { AdHocVariableForm } from '../components/AdHocVariableForm';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
  inline?: boolean;
}

// Extended state interface to include pinnedKeys
interface ExtendedAdHocFiltersVariableState {
  pinnedKeys?: PinnedKeyConfig[];
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const state = variable.useState();
  const { datasource: datasourceRef, defaultKeys, allowCustomValue } = state;

  // Access pinnedKeys from extended state (stored as custom property)
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const pinnedKeys = (state as unknown as ExtendedAdHocFiltersVariableState).pinnedKeys;

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters.';

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    variable.setState({
      datasource: dsRef,
      supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
    });
  };

  const onDefaultKeysChange = (defaultKeys?: MetricFindValue[]) => {
    variable.setState({
      defaultKeys,
    });
  };

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  const onPinnedKeysChange = (keys?: PinnedKeyConfig[]) => {
    // Store pinnedKeys as a custom property on the variable state
    // The AdHocFiltersVariable state doesn't officially include pinnedKeys,
    // but we can add it as a custom extension that gets serialized with the dashboard
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const stateWithPinnedKeys = { pinnedKeys: keys } as Partial<typeof state>;
    variable.setState(stateWithPinnedKeys);
  };

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      allowCustomValue={allowCustomValue}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      inline={props.inline}
      datasourceSupported={datasourceSettings?.getTagKeys ? true : false}
      pinnedKeys={pinnedKeys}
      onPinnedKeysChange={onPinnedKeysChange}
    />
  );
}

export function getAdHocFilterOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof AdHocFiltersVariable)) {
    console.warn('getAdHocFilterOptions: variable is not an AdHocFiltersVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <AdHocFiltersVariableEditor variable={variable} onRunQuery={noop} inline={true} />,
    }),
  ];
}
