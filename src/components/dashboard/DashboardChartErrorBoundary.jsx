import { Component } from 'react';

/** Catches render errors so one broken chart card cannot blank the rest of the dashboard. */
export default class DashboardChartErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    const title = this.props.title || 'Chart';
    if (error) {
      return (
        <div className="card h-100 border-danger">
          <div className="card-header pb-0 pt-3 bg-transparent">
            <h6 className="text-capitalize">{title}</h6>
            <p className="text-sm text-danger mb-0">{error.message || 'Failed to render chart'}</p>
          </div>
          <div className="card-body p-3">
            <p className="text-sm text-secondary mb-0">Refresh the page. If it persists, check the browser console.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
