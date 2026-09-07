import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { DASHBOARD_GRAPH_KEYS } from '../constants/dashboardGraphs.js';
import { canShowDashboardGraph, getShowGraphsOnDashboard, isAdmin } from '../utils/permissions.js';

/**
 * Dashboard graph visibility for the logged-in user.
 * Admins always receive every graph key.
 */
export function useDashboardGraphs() {
  const state = useSelector((reduxState) => reduxState);
  const admin = isAdmin(state);
  const selected = getShowGraphsOnDashboard(state);
  const allowedKeys = admin ? DASHBOARD_GRAPH_KEYS : selected;

  const canShow = useMemo(
    () => (graphKey) => canShowDashboardGraph(state, graphKey),
    [state]
  );

  const hasAny = useMemo(
    () => (graphKeys = []) => graphKeys.some((graphKey) => canShowDashboardGraph(state, graphKey)),
    [state]
  );

  return { isAdmin: admin, selected, allowedKeys, canShow, hasAny };
}
