import React from 'react';

/** One failing card must not blank the whole app. Shows a calm retry instead of a white screen or a raw exception. */
export class SectionBoundary extends React.Component<{ label: string; children: React.ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(`Cupcake section "${this.props.label}" failed`, error); }
  render() {
    if (!this.state.failed) return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return <div className="cc-card cc-section-failed" role="alert"><p><strong>{this.props.label} couldn’t load.</strong><br /><span className="cc-muted">Your data is safe. Try again, or check back in a minute.</span></p><button type="button" className="cc-secondary" onClick={() => this.setState(s => ({ failed: false, attempt: s.attempt + 1 }))}>Try again</button></div>;
  }
}
