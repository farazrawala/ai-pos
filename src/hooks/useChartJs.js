import { useEffect } from 'react';

/**
 * Mount a Chart.js instance on a canvas ref (global `window.Chart`).
 * @param {import('react').RefObject<HTMLCanvasElement|null>} canvasRef
 * @param {(Chart: typeof window.Chart, canvas: HTMLCanvasElement) => import('chart.js').Chart|undefined|null} buildChart
 * @param {unknown[]} deps
 */
export function useChartJs(canvasRef, buildChart, deps = []) {
  useEffect(() => {
    let cancelled = false;
    let chartInstance = null;
    let retryTimer = null;

    const render = () => {
      if (cancelled) return;
      const Chart = window.Chart;
      const canvas = canvasRef.current;
      if (!Chart || !canvas) {
        retryTimer = window.setTimeout(render, 200);
        return;
      }

      const existing = typeof Chart.getChart === 'function' ? Chart.getChart(canvas) : null;
      if (existing) existing.destroy();

      chartInstance = buildChart(Chart, canvas) ?? null;
    };

    render();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      chartInstance?.destroy();
      const canvas = canvasRef.current;
      if (canvas && typeof window.Chart?.getChart === 'function') {
        window.Chart.getChart(canvas)?.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, deps);
}
