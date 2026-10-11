import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // Deliberately log only rendering diagnostics; never log credentials or session tokens.
    console.error('FoodRescue page render failed:', error, info?.componentStack || '');
  }
  render() {
    if (this.state.hasError) {
      return <section className="error-boundary" role="alert">
        <span className="section-kicker">PAGE ERROR</span>
        <h1>This page could not be displayed.</h1>
        <p>The rest of FoodRescue is still available. Return to your workspace or reload this page.</p>
        <div className="error-boundary-actions">
          <button className="btn btn-primary" onClick={() => { this.setState({ hasError: false }); this.props.onHome?.(); }}>Return to workspace</button>
          <button className="btn btn-outline" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </section>;
    }
    return this.props.children;
  }
}
