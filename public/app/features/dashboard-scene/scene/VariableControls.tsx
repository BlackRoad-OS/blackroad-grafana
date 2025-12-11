import { css, cx } from '@emotion/css';

import { VariableHide, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import {
  sceneGraph,
  useSceneObjectState,
  SceneVariable,
  SceneVariableState,
  ControlsLabel,
  ControlsLayout,
  sceneUtils,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { PinnedAdHocFiltersRenderer } from '../variables/PinnedAdHocFilters/PinnedAdHocFiltersRenderer';
import { PinnedKeyConfig } from '../variables/PinnedAdHocFilters/types';

import { DashboardScene } from './DashboardScene';
import { AddVariableButton } from './VariableControlsAddButton';

// Extended state interface to access pinnedKeys from AdHocFiltersVariable
interface ExtendedAdHocFiltersVariableState {
  pinnedKeys?: PinnedKeyConfig[];
}

export function VariableControls({ dashboard }: { dashboard: DashboardScene }) {
  const { variables } = sceneGraph.getVariables(dashboard)!.useState();
  const styles = useStyles2(getStyles);

  return (
    <>
      {variables
        .filter((v) => v.state.hide !== VariableHide.inControlsMenu)
        .map((variable) => (
          <VariableValueSelectWrapper key={variable.state.key} variable={variable} />
        ))}
      {config.featureToggles.dashboardNewLayouts ? (
        <div className={styles.addButton}>
          <AddVariableButton dashboard={dashboard} />
        </div>
      ) : null}
    </>
  );
}

interface VariableSelectProps {
  variable: SceneVariable;
  inMenu?: boolean;
}

export function VariableValueSelectWrapper({ variable, inMenu }: VariableSelectProps) {
  const state = useSceneObjectState<SceneVariableState>(variable, { shouldActivateOrKeepAlive: true });
  const { isSelected, onSelect, isSelectable } = useElementSelection(variable.state.key);
  const styles = useStyles2(getStyles);

  // Check if this is an AdHoc variable with pinned keys
  const isAdHocVariable = sceneUtils.isAdHocVariable(variable);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const extendedState = variable.state as unknown as ExtendedAdHocFiltersVariableState;
  const pinnedKeys = isAdHocVariable ? extendedState.pinnedKeys : undefined;
  const hasPinnedKeys = pinnedKeys && pinnedKeys.length > 0;

  if (state.hide === VariableHide.hideVariable) {
    if (variable.UNSAFE_renderAsHidden) {
      return <variable.Component model={variable} />;
    }

    return null;
  }

  const onPointerDown = (evt: React.PointerEvent) => {
    if (!isSelectable) {
      return;
    }

    // Ignore click if it's inside the value control
    if (evt.target instanceof Element) {
      // multi variable options contain label element so we need a more specific
      //  condition to target variable label to prevent edit pane selection on option click
      const forAttribute = evt.target.closest('label[for]')?.getAttribute('for');

      if (!(forAttribute === `var-${variable.state.key || ''}`)) {
        // Prevent clearing selection when clicking inside value
        evt.stopPropagation();
        return;
      }
    }

    if (isSelectable && onSelect) {
      evt.stopPropagation();
      onSelect(evt);
    }
  };

  // For switch variables in menu, we want to show the switch on the left and the label on the right
  if (inMenu && sceneUtils.isSwitchVariable(variable)) {
    return (
      <div className={styles.switchMenuContainer} data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}>
        <div className={styles.switchControl}>
          <variable.Component model={variable} />
        </div>
        <VariableLabel variable={variable} layout={'vertical'} className={styles.switchLabel} />
      </div>
    );
  }

  if (inMenu) {
    return (
      <div className={styles.verticalContainer} data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}>
        <VariableLabel variable={variable} layout={'vertical'} />
        <variable.Component model={variable} />
      </div>
    );
  }

  // Render pinned filters for AdHoc variables that have them configured
  if (isAdHocVariable && hasPinnedKeys) {
    // We've already confirmed isAdHocVariable is true, so this cast is safe
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const adHocVariable = variable as AdHocFiltersVariable;
    return (
      <div className={styles.pinnedFiltersContainer}>
        <PinnedAdHocFiltersRenderer
          variable={adHocVariable}
          pinnedKeys={pinnedKeys}
        />
        {/* Also render the regular AdHoc filter UI for additional filters */}
        <div
          className={cx(
            styles.container,
            isSelected && 'dashboard-selected-element',
            isSelectable && !isSelected && 'dashboard-selectable-element'
          )}
          onPointerDown={onPointerDown}
          data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
        >
          <VariableLabel variable={variable} className={cx(isSelectable && styles.labelSelectable, styles.label)} />
          <variable.Component model={variable} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        styles.container,
        isSelected && 'dashboard-selected-element',
        isSelectable && !isSelected && 'dashboard-selectable-element'
      )}
      onPointerDown={onPointerDown}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItem}
    >
      <VariableLabel variable={variable} className={cx(isSelectable && styles.labelSelectable, styles.label)} />
      <variable.Component model={variable} />
    </div>
  );
}

function VariableLabel({
  variable,
  className,
  layout,
}: {
  variable: SceneVariable;
  className?: string;
  layout?: ControlsLayout;
}) {
  const { state } = variable;

  if (variable.state.hide === VariableHide.hideLabel) {
    return null;
  }

  const labelOrName = state.label || state.name;
  const elementId = `var-${state.key}`;

  return (
    <ControlsLabel
      htmlFor={elementId}
      isLoading={state.loading}
      onCancel={() => variable.onCancel?.()}
      label={labelOrName}
      error={state.error}
      layout={layout ?? 'horizontal'}
      description={state.description ?? undefined}
      className={className}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    // No border for second element (inputs) as label and input border is shared
    '> :nth-child(2)': css({
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
  verticalContainer: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  switchMenuContainer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  switchControl: css({
    '& > div': {
      border: 'none',
      background: 'transparent',
      paddingRight: theme.spacing(0.5),
      height: theme.spacing(2),
    },
  }),
  switchLabel: css({
    marginTop: 0,
    marginBottom: 0,
  }),
  labelSelectable: css({
    cursor: 'pointer',
  }),
  label: css({
    display: 'flex',
    alignItems: 'center',
  }),
  addButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
  pinnedFiltersContainer: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  }),
});
