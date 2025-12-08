// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css, cx } from '@emotion/css';
import { SpanStatusCode } from '@opentelemetry/api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  DataFrame,
  dateTimeFormat,
  GrafanaTheme2,
  LinkModel,
  TimeRange,
  TraceKeyValuePair,
  TraceLog,
  PluginExtensionResourceAttributesContext,
  PluginExtensionPoints,
  IconName,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { getBackendSrv, usePluginLinks } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Icon, Spinner, useStyles2, useTheme2 } from '@grafana/ui';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { autoColor } from '../../Theme';
import LabeledList from '../../common/LabeledList';
import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE } from '../../constants/span';
import { SpanLinkFunc } from '../../types/links';
import { TraceProcess, TraceSpan, TraceSpanReference } from '../../types/trace';
import { formatDuration } from '../../utils/date';

import AccordianKeyValues from './AccordianKeyValues';
import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import DetailState from './DetailState';
import { ShareSpanButton } from './ShareSpanButton';
import { getSpanDetailLinkButtons } from './SpanDetailLinkButtons';
import SpanFlameGraph from './SpanFlameGraph';

const useResourceAttributesExtensionLinks = ({
  process,
  spanTags,
  datasourceType,
  datasourceUid,
  timeRange,
}: {
  process: TraceProcess;
  spanTags: TraceKeyValuePair[];
  datasourceType: string;
  datasourceUid: string;
  timeRange: TimeRange;
}) => {
  // Stable context for useMemo inside usePluginLinks
  const context: PluginExtensionResourceAttributesContext = useMemo(() => {
    const attributes = (process.tags ?? []).reduce<Record<string, string[]>>((acc, tag) => {
      if (acc[tag.key]) {
        acc[tag.key].push(tag.value);
      } else {
        acc[tag.key] = [tag.value];
      }
      return acc;
    }, {});

    const spanAttributes = (spanTags ?? []).reduce<Record<string, string[]>>((acc, tag) => {
      if (acc[tag.key]) {
        acc[tag.key].push(tag.value);
      } else {
        acc[tag.key] = [tag.value];
      }
      return acc;
    }, {});

    return {
      attributes,
      spanAttributes,
      timeRange: { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
      datasource: {
        type: datasourceType,
        uid: datasourceUid,
      },
    };
  }, [process.tags, spanTags, datasourceType, datasourceUid, timeRange]);

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TraceViewResourceAttributes,
    limitPerPlugin: 10,
    context,
  });

  const resourceLinksGetter = useCallback(
    (pairs: TraceKeyValuePair[], index: number) => {
      const { key } = pairs[index] ?? {};
      return links.filter((link) => link.category === key);
    },
    [links]
  );

  return resourceLinksGetter;
};

// Assertion severity type
type AssertionSeverity = 'critical' | 'warning' | 'info';

// Colors matching Asserts plugin
const ASSERTS_COLORS: Record<AssertionSeverity, string> = {
  critical: '#F2495C',
  warning: '#FF9830',
  info: '#5794F2',
};

// Response type from the alert-inspection API
interface AlertInspectionEntity {
  id: number;
  type: string;
  name: string;
  scope?: {
    namespace?: string;
    env?: string;
  };
  assertion?: {
    severity?: AssertionSeverity;
    amend?: boolean;
    assertions?: Array<{
      assertionName: string;
      severity: AssertionSeverity;
      category: string;
      entityType: string;
    }>;
  };
  assertionCount?: number;
}

interface AlertInspectionResponse {
  type: string;
  timeCriteria: {
    start: number;
    end: number;
  };
  data: {
    entities: AlertInspectionEntity[];
  };
}

// Get ring color based on assertion severity
const getRingColor = (entity?: AlertInspectionEntity, theme?: GrafanaTheme2): string => {
  const severity = entity?.assertion?.severity;
  if (severity && ASSERTS_COLORS[severity]) {
    return ASSERTS_COLORS[severity];
  }
  // Use neutral/secondary color when no assertions
  return theme?.colors.text.secondary ?? '#8e8e8e';
};

// Entity Circle Component styled like Asserts
const EntityCircleLink = ({
  entity,
  entityUrl,
  theme,
}: {
  entity: AlertInspectionEntity;
  entityUrl: string;
  theme: GrafanaTheme2;
}) => {
  const size = 24;
  const ringWidth = 2;
  const ringColor = getRingColor(entity, theme);

  const styles = {
    container: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px 4px 4px',
      borderRadius: theme.shape.radius.pill,
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
      textDecoration: 'none',
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      '&:hover': {
        backgroundColor: theme.colors.action.hover,
        borderColor: theme.colors.border.medium,
        textDecoration: 'none',
        color: theme.colors.text.primary,
      },
    }),
    circle: css({
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: theme.shape.radius.circle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(circle at center, ${theme.colors.background.primary} ${size / 2 - ringWidth - 1}px, transparent ${size / 2 - ringWidth}px), ${ringColor}`,
      flexShrink: 0,
    }),
    icon: css({
      color: theme.colors.text.secondary,
      fontSize: '12px',
    }),
    entityName: css({
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
    }),
  };

  return (
    <a href={entityUrl} target="_blank" rel="noopener noreferrer" className={styles.container}>
      <div className={styles.circle}>
        <Icon name="cog" className={styles.icon} />
      </div>
      <span className={styles.entityName} title={entity.name}>
        {entity.name}
      </span>
    </a>
  );
};

// Build the KG entity URL from the entity data
const buildEntityUrl = (entity: AlertInspectionEntity, timeRange: TimeRange): string => {
  const baseUrl = '/a/grafana-asserts-app/entities';
  const params = new URLSearchParams();

  // Add entity details as nested params (ed[type], ed[name], etc.)
  params.set('ed[type]', entity.type);
  params.set('ed[name]', entity.name);

  if (entity.scope?.namespace) {
    params.set('ed[scope][namespace]', entity.scope.namespace);
  }
  if (entity.scope?.env) {
    params.set('ed[scope][env]', entity.scope.env);
  }

  // Add time range
  params.set('start', timeRange.from.valueOf().toString());
  params.set('end', timeRange.to.valueOf().toString());

  return `${baseUrl}?${params.toString()}`;
};

// Hook to fetch entity URL from the asserts plugin API
const useEntityUrl = ({
  spanTags,
  processTags,
  timeRange,
}: {
  spanTags: TraceKeyValuePair[];
  processTags: TraceKeyValuePair[];
  timeRange: TimeRange;
}) => {
  const [entityUrl, setEntityUrl] = useState<string | null>(null);
  const [entity, setEntity] = useState<AlertInspectionEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only include these specific attributes for the alert-inspection API
    // Map from trace attribute names to the names expected by the API
    const ATTRIBUTE_MAPPING: Record<string, string> = {
      'k8s.cluster.name': 'cluster',
      'k8s.namespace.name': 'namespace',
      'service.name': 'service',
      'service.namespace': 'namespace',
      // Also check for service_name format (used in some traces)
      'service_name': 'service',
      'cluster': 'cluster',
      'namespace': 'namespace',
    };

    const fetchEntityUrl = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build labels from span tags and process tags, mapping to expected API names
        const labels: Record<string, string> = {};
        const allTags = [...(processTags ?? []), ...(spanTags ?? [])];

        // Debug: log all available tags
        console.log(
          'Available tags:',
          allTags.map((t) => `${t.key}=${t.value}`)
        );

        allTags.forEach((tag) => {
          const mappedKey = ATTRIBUTE_MAPPING[tag.key];
          if (mappedKey && !labels[mappedKey]) {
            labels[mappedKey] = String(tag.value);
          }
        });

        console.log('Labels being sent to API:', labels);

        // Skip API call if no allowed attributes found
        if (Object.keys(labels).length === 0) {
          console.log('No matching attributes found, skipping API call');
          setLoading(false);
          return;
        }

        const requestBody = {
          alertLabels: [labels],
          timeCriteria: {
            start: timeRange.from.valueOf(),
            end: timeRange.to.valueOf(),
          },
        };

        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const response: AlertInspectionResponse = await getBackendSrv().post(
          '/api/plugins/grafana-asserts-app/resources/asserts/api-server/v1/alert-inspection',
          requestBody
        );

        console.log('API Response:', response);

        // Extract the first entity from the response
        const foundEntity = response?.data?.entities?.[0];
        if (foundEntity) {
          const url = buildEntityUrl(foundEntity, timeRange);
          setEntityUrl(url);
          setEntity(foundEntity);
          console.log('Entity found:', foundEntity.type, foundEntity.name, 'URL:', url);
        } else {
          console.log('No entities found in response');
        }
      } catch (err) {
        console.error('Failed to fetch entity URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch entity URL');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if at least one of the mapped attributes is present
    const allTags = [...(processTags ?? []), ...(spanTags ?? [])];
    const hasAllowedAttributes = allTags.some((tag) => tag.key in ATTRIBUTE_MAPPING);

    if (hasAllowedAttributes) {
      fetchEntityUrl();
    }
  }, [spanTags, processTags, timeRange]);

  return { entityUrl, entity, loading, error };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      ':not(:empty)': {
        border: '1px solid ' + theme.colors.border.weak,
        '&:hover': {
          border: '1px solid ' + theme.colors.border.strong,
        },
      },
      borderRadius: theme.shape.radius.md,
      margin: '6px',
      padding: '5px',
    }),
    header: css({
      label: 'SpanDetailHeader',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '0 1rem',
      marginBottom: '0.25rem',
      flexDirection: 'column',
    }),
    content: css({
      label: 'SpanDetailContent',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    listWrapper: css({
      label: 'SpanDetailListWrapper',
      overflow: 'hidden',
      flexGrow: 1,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    list: css({
      textAlign: 'left',
    }),
    spanDetailComponent: css({
      label: 'SpanDetailComponent',
      display: 'flex',
      flexDirection: 'column', // On bigger screens display attributes below service name
    }),
    serviceNameAndLinks: css({
      label: 'ServiceNameAndLinks',
      display: 'flex',
      width: '100%',
      marginBottom: theme.spacing(1),
    }),
    rightLinks: css({
      label: 'RightLinks',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginLeft: 'auto',
    }),
    operationName: css({
      label: 'SpanDetailOperationName',
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '50%',
      flexGrow: 1,
      flexShrink: 0,
    }),
    AccordianWarnings: css({
      label: 'AccordianWarnings',
      background: autoColor(theme, '#fafafa'),
      border: `1px solid ${autoColor(theme, '#e4e4e4')}`,
      marginBottom: '0.25rem',
    }),
    AccordianWarningsHeader: css({
      label: 'AccordianWarningsHeader',
      background: autoColor(theme, '#fff7e6'),
      padding: '0.25rem 0.5rem',
    }),
    AccordianWarningsHeaderOpen: css({
      label: 'AccordianWarningsHeaderOpen',
      borderBottom: `1px solid ${autoColor(theme, '#e8e8e8')}`,
    }),
    AccordianWarningsLabel: css({
      label: 'AccordianWarningsLabel',
      color: autoColor(theme, '#d36c08'),
    }),
    Textarea: css({
      wordBreak: 'break-all',
      whiteSpace: 'pre',
    }),
    linkList: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      marginBottom: theme.spacing(2),
    }),
    debugInfo: css({
      label: 'debugInfo',
      display: 'block',
      letterSpacing: '0.25px',
      margin: '0.5em 0 -0.75em',
      textAlign: 'right',
      clear: 'both',
    }),
    debugLabel: css({
      label: 'debugLabel',
      '&::before': {
        color: autoColor(theme, '#bbb'),
        content: 'attr(data-label)',
      },
    }),
    LinkIcon: css({
      fontSize: '1.5em',
    }),
  };
};

export const alignIcon = css({
  margin: '-0.2rem 0.25rem 0 0',
});

export type TraceFlameGraphs = {
  [spanID: string]: DataFrame;
};

export type SpanDetailProps = {
  color: string;
  detailState: DetailState;
  logItemToggle: (spanID: string, log: TraceLog) => void;
  logsToggle: (spanID: string) => void;
  processToggle: (spanID: string) => void;
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;
  timeZone: TimeZone;
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  traceDuration: number;
  traceName: string;
  warningsToggle: (spanID: string) => void;
  stackTracesToggle: (spanID: string) => void;
  referenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  referencesToggle: (spanID: string) => void;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  datasourceType: string;
  datasourceUid: string;
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
  timeRange: TimeRange;
  app: CoreApp;
};

export default function SpanDetail(props: SpanDetailProps) {
  const {
    color,
    detailState,
    logItemToggle,
    logsToggle,
    processToggle,
    span,
    tagsToggle,
    traceStartTime,
    traceDuration,
    traceName,
    warningsToggle,
    stackTracesToggle,
    referencesToggle,
    referenceItemToggle,
    createSpanLink,
    createFocusSpanLink,
    datasourceType,
    datasourceUid,
    traceFlameGraphs,
    setTraceFlameGraphs,
    traceToProfilesOptions,
    setRedrawListView,
    timeRange,
    app,
  } = props;
  const {
    isTagsOpen,
    isProcessOpen,
    logs: logsState,
    isWarningsOpen,
    references: referencesState,
    isStackTracesOpen,
  } = detailState;
  const {
    operationName,
    process,
    duration,
    relativeStartTime,
    startTime,
    traceID,
    spanID,
    logs,
    tags,
    warnings,
    references,
    stackTraces,
  } = span;

  const { timeZone } = props;

  // Fetch entity URL from the asserts plugin API
  const { entityUrl, entity, loading: entityUrlLoading } = useEntityUrl({
    spanTags: tags,
    processTags: process.tags,
    timeRange,
  });

  const theme = useTheme2();

  const durationIcon: IconName = 'hourglass';
  const startIcon: IconName = 'clock-nine';

  let overviewItems = [
    {
      key: 'svc',
      label: t('explore.span-detail.overview-items.label.service', 'Service:'),
      value: process.serviceName,
    },
    {
      key: 'duration',
      label: t('explore.span-detail.overview-items.label.duration', 'Duration:'),
      value: formatDuration(duration),
      icon: durationIcon,
    },
    {
      key: 'start',
      label: t('explore.span-detail.overview-items.label.start-time', 'Start Time:'),
      value: formatDuration(relativeStartTime) + getAbsoluteTime(startTime, timeZone),
      icon: startIcon,
    },
    ...(span.childSpanCount > 0
      ? [
          {
            key: 'child_count',
            label: t('explore.span-detail.overview-items.label.child-count', 'Child Count:'),
            value: span.childSpanCount,
          },
        ]
      : []),
  ];

  const mainContainerRef = useRef<HTMLDivElement>(null);

  const styles = useStyles2(getStyles);
  if (span.kind) {
    overviewItems.push({
      key: KIND,
      label: t('explore.span-detail.label.kind', 'Kind:'),
      value: span.kind,
    });
  }
  if (span.statusCode !== undefined) {
    overviewItems.push({
      key: STATUS,
      label: t('explore.span-detail.label.status', 'Status:'),
      value: SpanStatusCode[span.statusCode].toLowerCase(),
    });
  }
  if (span.statusMessage) {
    overviewItems.push({
      key: STATUS_MESSAGE,
      label: t('explore.span-detail.label.status-message', 'Status Message:'),
      value: span.statusMessage,
    });
  }
  if (span.instrumentationLibraryName) {
    overviewItems.push({
      key: LIBRARY_NAME,
      label: t('explore.span-detail.label.library-name', 'Library Name:'),
      value: span.instrumentationLibraryName,
    });
  }
  if (span.instrumentationLibraryVersion) {
    overviewItems.push({
      key: LIBRARY_VERSION,
      label: t('explore.span-detail.label.library-version', 'Library Version:'),
      value: span.instrumentationLibraryVersion,
    });
  }
  if (span.traceState) {
    overviewItems.push({
      key: TRACE_STATE,
      label: t('explore.span-detail.label.trace-state', 'Trace State:'),
      value: span.traceState,
    });
  }

  // Entity link will be rendered separately as a clickable link

  const { interpolatedParams, ...focusSpanLink } = createFocusSpanLink(traceID, spanID);
  const resourceLinksGetter = useResourceAttributesExtensionLinks({
    process,
    spanTags: tags,
    datasourceType,
    datasourceUid,
    timeRange,
  });

  const linksComponent = getSpanDetailLinkButtons({
    span,
    createSpanLink,
    datasourceType,
    traceToProfilesOptions,
    timeRange,
    app,
    shareButton: <ShareSpanButton focusSpanLink={focusSpanLink} />,
  });

  const listOfContentCards = [];

  listOfContentCards.push(
    <AccordianKeyValues
      data={tags}
      label={t('explore.span-detail.label-span-attributes', 'Span attributes')}
      isOpen={isTagsOpen}
      linksGetter={resourceLinksGetter}
      onToggle={() => tagsToggle(spanID)}
    />
  );

  if (process.tags) {
    listOfContentCards.push(
      <AccordianKeyValues
        data={process.tags}
        label={t('explore.span-detail.label-resource-attributes', 'Resource attributes')}
        linksGetter={resourceLinksGetter}
        isOpen={isProcessOpen}
        onToggle={() => processToggle(spanID)}
      />
    );
  }

  if (logs && logs.length > 0) {
    listOfContentCards.push(
      <AccordianLogs
        logs={logs}
        isOpen={logsState.isOpen}
        openedItems={logsState.openedItems}
        onToggle={() => logsToggle(spanID)}
        onItemToggle={(logItem) => logItemToggle(spanID, logItem)}
        timestamp={traceStartTime}
      />
    );
  }

  if (warnings && warnings.length > 0) {
    listOfContentCards.push(
      <AccordianKeyValues
        data={warnings.map((warning) => ({
          key: '',
          value: warning,
          type: 'warning',
        }))}
        onlyValues={true}
        showSummary={false}
        showCountBadge={true}
        isOpen={isWarningsOpen}
        onToggle={() => warningsToggle(spanID)}
        label={t('explore.span-detail.label-warnings', 'Warnings')}
      />
    );
  }

  if (stackTraces?.length) {
    listOfContentCards.push(
      <AccordianKeyValues
        data={stackTraces.map((stackTrace) => ({
          key: '',
          value: stackTrace,
          type: 'code',
        }))}
        onlyValues={true}
        showSummary={false}
        showCountBadge={true}
        isOpen={isStackTracesOpen}
        onToggle={() => stackTracesToggle(spanID)}
        label={t('explore.span-detail.label-stack-trace', 'Stack trace')}
      />
    );
  }

  if (references && references.length > 0 && (references.length > 1 || references[0].refType !== 'CHILD_OF')) {
    listOfContentCards.push(
      <AccordianReferences
        data={references}
        isOpen={referencesState.isOpen}
        openedItems={referencesState.openedItems}
        onToggle={() => referencesToggle(spanID)}
        onItemToggle={(reference) => referenceItemToggle(spanID, reference)}
        createFocusSpanLink={createFocusSpanLink}
      />
    );
  }

  if (span.tags.some((tag) => tag.key === pyroscopeProfileIdTagKey)) {
    listOfContentCards.push(
      <SpanFlameGraph
        span={span}
        timeZone={timeZone}
        traceFlameGraphs={traceFlameGraphs}
        setTraceFlameGraphs={setTraceFlameGraphs}
        traceToProfilesOptions={traceToProfilesOptions}
        setRedrawListView={setRedrawListView}
        traceDuration={traceDuration}
        traceName={traceName}
      />
    );
  }

  return (
    <div data-testid="span-detail-component" ref={mainContainerRef} className={styles.spanDetailComponent}>
      <div className={styles.header}>
        <div className={styles.serviceNameAndLinks}>
          <h6 className={styles.operationName} title={operationName}>
            {operationName}
          </h6>
          <div className={styles.rightLinks}>
            {entityUrlLoading && <Spinner size="sm" />}
            {entityUrl && entity && <EntityCircleLink entity={entity} entityUrl={entityUrl} theme={theme} />}
            {linksComponent}
          </div>
        </div>
        <div className={styles.listWrapper}>
          <LabeledList className={styles.list} divider={false} items={overviewItems} color={color} />
        </div>
      </div>
      <div className={styles.content}>
        <CardsContainer listOfContentCards={listOfContentCards} mainContainerRef={mainContainerRef} />

        <small className={styles.debugInfo}>
          {/* TODO: fix keyboard a11y */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <a
            {...focusSpanLink}
            onClick={(e) => {
              // click handling logic copied from react router:
              // https://github.com/remix-run/react-router/blob/997b4d67e506d39ac6571cb369d6d2d6b3dda557/packages/react-router-dom/index.tsx#L392-L394s
              if (
                focusSpanLink.onClick &&
                e.button === 0 && // Ignore everything but left clicks
                (!e.currentTarget.target || e.currentTarget.target === '_self') && // Let browser handle "target=_blank" etc.
                !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) // Ignore clicks with modifier keys
              ) {
                e.preventDefault();
                focusSpanLink.onClick(e);
              }
            }}
          >
            <Icon name={'link'} className={cx(alignIcon, styles.LinkIcon)}></Icon>
          </a>
          <span className={styles.debugLabel} data-label="SpanID:" /> {spanID}
        </small>
      </div>
    </div>
  );
}

export const getAbsoluteTime = (startTime: number, timeZone: TimeZone) => {
  const dateStr = dateTimeFormat(startTime / 1000, { timeZone, defaultWithMS: true });
  const match = dateStr.split(' ');
  const absoluteTime = match[1] ? match[1] : dateStr;
  return ` (${absoluteTime})`;
};

const CardsContainer = ({
  listOfContentCards,
  mainContainerRef,
}: {
  listOfContentCards: React.ReactNode[];
  mainContainerRef?: React.RefObject<HTMLDivElement>;
}) => {
  const styles = useStyles2(getStyles);

  const useTwoColumns =
    mainContainerRef && mainContainerRef.current && mainContainerRef.current.getBoundingClientRect().width > 1000;

  if (useTwoColumns) {
    return (
      <>
        <div className={css({ float: 'left', width: '50%' })}>
          {listOfContentCards.map((card, index) =>
            index % 2 === 0 ? (
              <div className={styles.card} key={index}>
                {card}
              </div>
            ) : null
          )}
        </div>

        <div className={css({ float: 'right', width: '50%' })}>
          {listOfContentCards.map((card, index) =>
            index % 2 === 1 ? (
              <div className={styles.card} key={index}>
                {card}
              </div>
            ) : null
          )}
        </div>
      </>
    );
  }

  return (
    <div className={css({ clear: 'both', width: '100%' })}>
      {listOfContentCards.map((card, index) => (
        <div className={styles.card} key={index}>
          {card}
        </div>
      ))}
    </div>
  );
};
