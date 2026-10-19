import { Component, type ReactNode } from 'react';

type Props = { section: string; children: ReactNode };
export default class SectionBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="panel unavailable" aria-label="Workspace section unavailable">
      <h2>This section could not be opened</h2>
      <p role="alert">{this.props.section} is unavailable. Reload the app to try again, or choose another research section.</p>
      <button type="button" className="secondary" onClick={() => window.location.reload()}>Reload CapitalScope</button>
    </section>;
    return this.props.children;
  }
}
