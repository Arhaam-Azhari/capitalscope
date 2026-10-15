import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export default function EvidenceTable({ label, className = '', pinFirstColumn = false, children }: { label: string; className?: string; pinFirstColumn?: boolean; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [position, setPosition] = useState({ overflow: false, start: true, end: true });
  function measure() {
    const element = viewport.current;
    if (!element) return;
    const remaining = element.scrollWidth - element.clientWidth;
    setPosition({ overflow: remaining > 1, start: element.scrollLeft <= 1, end: element.scrollLeft >= remaining - 1 });
  }
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    // I watch both widths so column changes and viewport resizing update the controls.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.querySelector('table');
    if (table) observer.observe(table);
    measure();
    return () => observer.disconnect();
  }, [children]);
  function move(direction: number) {
    const element = viewport.current;
    if (!element) return;
    const pinnedWidth = pinFirstColumn ? element.querySelector('tr > :first-child')?.getBoundingClientRect().width || 0 : 0;
    const availableWidth = Math.max(element.clientWidth - pinnedWidth, element.clientWidth / 3);
    element.scrollBy({ left: direction * availableWidth * .75, behavior: 'auto' });
  }
  return <div className={`evidence-table ${pinFirstColumn ? 'pin-first-column' : ''} ${pinFirstColumn && position.overflow ? 'pinned-measures' : ''} ${className}`}>
    {position.overflow && <div className="table-navigation">
      <div className="table-position"><span id={hintId}>{position.start ? 'More columns to the right' : position.end ? 'Last columns in view' : 'More columns on both sides'}</span>{pinFirstColumn && <small className="pinned-column-hint">Measure column stays visible</small>}</div>
      <div><button type="button" className="secondary" disabled={position.start} aria-label={`Scroll ${label} left`} onClick={() => move(-1)}>←</button><button type="button" className="secondary" disabled={position.end} aria-label={`Scroll ${label} right`} onClick={() => move(1)}>→</button></div>
    </div>}
    <div ref={viewport} className="table-scroll" onScroll={measure} tabIndex={position.overflow ? 0 : undefined} role={position.overflow ? 'region' : undefined} aria-label={position.overflow ? label : undefined} aria-describedby={position.overflow ? hintId : undefined}>{children}</div>
  </div>;
}
