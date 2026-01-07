import { OpenFeature } from '@openfeature/web-sdk';

const datagridEditingFlag = 'enableDatagridEditing';
export const isDatagridEnabled = () => {
  return OpenFeature.getClient().getBooleanValue(datagridEditingFlag, false);
};
