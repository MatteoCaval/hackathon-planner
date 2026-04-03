import React, { useState, useRef, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  minDate?: string;
  onComplete?: () => void;
  label?: string;
}

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const formatDisplay = (s: string) =>
  s ? new Date(s + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : '—';

const DateRangePicker: React.FC<Props> = ({ startDate, endDate, onChange, minDate, onComplete, label }) => {
  const today = new Date();
  const initYear = startDate ? parseInt(startDate.slice(0, 4)) : today.getFullYear();
  const initMonth = startDate ? parseInt(startDate.slice(5, 7)) - 1 : today.getMonth();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When opened, reset view to show the startDate month (or today)
  const handleOpen = () => {
    const base = startDate || toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    setViewYear(parseInt(base.slice(0, 4)));
    setViewMonth(parseInt(base.slice(5, 7)) - 1);
    setSelecting('start');
    setOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (minDate && dateStr < minDate) return;

    if (selecting === 'start') {
      onChange(dateStr, endDate && endDate >= dateStr ? endDate : '');
      setSelecting('end');
    } else {
      if (dateStr < startDate) {
        // clicked before start — treat as new start
        onChange(dateStr, '');
        setSelecting('end');
      } else {
        onChange(startDate, dateStr);
        setOpen(false);
        onComplete?.();
      }
    }
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfWeek = (y: number, m: number) => {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday = 0
  };

  const renderCalendar = () => {
    const totalDays = getDaysInMonth(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);
    const cells: React.ReactNode[] = [];

    // empty leading cells
    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`e${i}`} />);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = toDateStr(viewYear, viewMonth, d);
      const isMin = minDate && dateStr < minDate;
      const isStart = dateStr === startDate;
      const isEnd = dateStr === endDate;
      const rangeEnd = selecting === 'end' && hovered ? hovered : endDate;
      const inRange = startDate && rangeEnd && dateStr > startDate && dateStr < rangeEnd;
      const isHoverEnd = selecting === 'end' && hovered === dateStr && !isEnd;
      const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

      let bg = 'transparent';
      let color = 'inherit';
      let fontWeight: React.CSSProperties['fontWeight'] = 400;
      let borderRadius = '6px';
      let opacity = 1;

      if (isStart || isEnd) {
        bg = 'var(--bs-primary)';
        color = '#fff';
        fontWeight = 600;
      } else if (isHoverEnd) {
        bg = 'var(--bs-primary)';
        color = '#fff';
        fontWeight = 600;
        opacity = 0.6;
      } else if (inRange) {
        bg = 'var(--bs-primary-bg-subtle)';
        color = 'var(--bs-primary-text-emphasis)';
        borderRadius = '0';
      }

      if (isStart && (endDate || isHoverEnd || inRange)) borderRadius = '6px 0 0 6px';
      if ((isEnd || isHoverEnd) && (startDate || inRange)) borderRadius = '0 6px 6px 0';

      cells.push(
        <div
          key={dateStr}
          onClick={() => !isMin && handleDayClick(dateStr)}
          onMouseEnter={() => selecting === 'end' && setHovered(dateStr)}
          onMouseLeave={() => setHovered(null)}
          style={{
            padding: '5px 2px',
            textAlign: 'center',
            cursor: isMin ? 'not-allowed' : 'pointer',
            opacity: isMin ? 0.35 : opacity,
            background: bg,
            color,
            fontWeight,
            borderRadius,
            fontSize: 'var(--font-size-sm)',
            outline: isToday && !isStart && !isEnd ? '1px solid var(--bs-primary)' : undefined,
            outlineOffset: '-2px',
          }}
        >
          {d}
        </div>
      );
    }

    return cells;
  };

  const hasRange = startDate && endDate;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Form.Label className="small text-muted mb-1">{label ?? 'Dates'}</Form.Label>
      <button
        type="button"
        onClick={handleOpen}
        className="form-control form-control-sm d-flex align-items-center gap-2"
        style={{ cursor: 'pointer', textAlign: 'left', background: 'var(--bs-body-bg)', color: 'var(--bs-body-color)' }}
        aria-label="Select date range"
      >
        <FaCalendarAlt size={12} className="text-muted flex-shrink-0" />
        {hasRange ? (
          <span className="small">{formatDisplay(startDate)} → {formatDisplay(endDate)}</span>
        ) : startDate ? (
          <span className="small">{formatDisplay(startDate)} → pick end</span>
        ) : (
          <span className="small text-muted">Pick dates…</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 'var(--z-popover)' as unknown as number, top: 'calc(100% + 4px)', left: 0,
          background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', padding: 16, minWidth: 280, maxWidth: 'calc(100vw - 32px)',
        }}>
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <button type="button" onClick={prevMonth} className="btn btn-sm btn-link p-0 text-muted"><FaChevronLeft size={12} /></button>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="btn btn-sm btn-link p-0 text-muted"><FaChevronRight size={12} /></button>
          </div>

          {/* Hint */}
          <div className="text-muted mb-2" style={{ fontSize: 11, textAlign: 'center' }}>
            {selecting === 'start' ? 'Click to set start date' : 'Click to set end date'}
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--bs-secondary-color)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {renderCalendar()}
          </div>

          {/* Footer */}
          {(startDate || endDate) && (
            <div className="d-flex justify-content-between align-items-center mt-3 pt-2" style={{ borderTop: '1px solid var(--bs-border-color)' }}>
              <span className="small text-muted">
                {startDate && endDate ? `${formatDisplay(startDate)} → ${formatDisplay(endDate)}` : startDate ? formatDisplay(startDate) : ''}
              </span>
              <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => { onChange('', ''); setSelecting('start'); }}>Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
