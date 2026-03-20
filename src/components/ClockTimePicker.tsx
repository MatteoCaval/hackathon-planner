import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaClock } from 'react-icons/fa';

interface Props {
  value: string;           // "HH:MM" or ""
  onChange: (time: string) => void;
  label?: string;
  size?: 'sm' | 'md';
}

type Mode = 'hour' | 'minute';

const CLOCK_SIZE = 200;
const CLOCK_RADIUS = CLOCK_SIZE / 2;
const NUMBER_RADIUS = 72;
const DOT_RADIUS = 16;

const pad = (n: number) => String(n).padStart(2, '0');

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const getAngle = (value: number, total: number): number => {
  return (value / total) * 360 - 90;
};

const getPosition = (angle: number, radius: number) => {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CLOCK_RADIUS + Math.cos(rad) * radius,
    y: CLOCK_RADIUS + Math.sin(rad) * radius,
  };
};

const getValueFromPointer = (
  e: React.MouseEvent | React.TouchEvent,
  svgRef: React.RefObject<SVGSVGElement | null>,
  mode: Mode
): number | null => {
  const svg = svgRef.current;
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  const x = clientX - rect.left - CLOCK_RADIUS;
  const y = clientY - rect.top - CLOCK_RADIUS;

  let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;

  if (mode === 'hour') {
    const dist = Math.sqrt(x * x + y * y);
    const isInner = dist < NUMBER_RADIUS - 12;
    const hour12 = Math.round(angle / 30) % 12;
    return isInner ? (hour12 === 0 ? 0 : hour12 + 12) : (hour12 === 0 ? 12 : hour12);
  } else {
    const minute = Math.round(angle / 6) % 60;
    return Math.round(minute / 5) * 5 % 60;
  }
};

const ClockTimePicker: React.FC<Props> = ({ value, onChange, label, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('hour');
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    const parts = value.split(':');
    return parts.length === 2 ? parseInt(parts[0], 10) || 0 : 12;
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    const parts = value.split(':');
    return parts.length === 2 ? parseInt(parts[1], 10) || 0 : 0;
  });
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Estimated popover dimensions for viewport clamping
  const POPOVER_W = 240;
  const POPOVER_H = 330;

  const openPicker = () => {
    const parts = value.split(':');
    if (parts.length === 2) {
      setSelectedHour(parseInt(parts[0], 10) || 0);
      setSelectedMinute(parseInt(parts[1], 10) || 0);
    }
    setMode('hour');
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      // Clamp left so popover stays within viewport
      const left = Math.min(
        Math.max(POPOVER_W / 2 + 8, centerX),
        window.innerWidth - POPOVER_W / 2 - 8
      );
      // Flip above button if not enough room below
      const top = rect.bottom + 4 + POPOVER_H > window.innerHeight
        ? rect.top - POPOVER_H - 4
        : rect.bottom + 4;
      setPopoverPos({ top, left });
    }
    setOpen(true);
  };

  const handleClockClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const val = getValueFromPointer(e, svgRef, mode);
    if (val === null) return;

    if (mode === 'hour') {
      setSelectedHour(val);
      setMode('minute');
    } else {
      setSelectedMinute(val);
      const h = selectedHour;
      onChange(`${pad(h)}:${pad(val)}`);
      setOpen(false);
    }
  }, [mode, selectedHour, onChange]);

  const handleConfirm = () => {
    onChange(`${pad(selectedHour)}:${pad(selectedMinute)}`);
    setOpen(false);
  };

  const renderClockFace = () => {
    if (mode === 'hour') {
      // Outer ring: 1-12, inner ring: 13-24 (0 shown as 00)
      const outerHours = HOURS.filter((h) => h >= 1 && h <= 12);
      const innerHours = HOURS.filter((h) => h === 0 || h > 12);

      const handAngle = getAngle(selectedHour <= 12 && selectedHour !== 0 ? selectedHour : selectedHour - 12, 12);
      const isInner = selectedHour === 0 || selectedHour > 12;
      const handRadius = isInner ? NUMBER_RADIUS - 26 : NUMBER_RADIUS;
      const handEnd = getPosition(handAngle, handRadius);

      return (
        <>
          <line
            x1={CLOCK_RADIUS} y1={CLOCK_RADIUS}
            x2={handEnd.x} y2={handEnd.y}
            stroke="var(--color-brand-500)" strokeWidth={2}
          />
          <circle cx={handEnd.x} cy={handEnd.y} r={DOT_RADIUS} fill="var(--color-brand-500)" opacity={0.15} />
          {outerHours.map((h) => {
            const angle = getAngle(h, 12);
            const pos = getPosition(angle, NUMBER_RADIUS);
            const isSelected = h === selectedHour;
            return (
              <text
                key={h} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                className={`clock-number ${isSelected ? 'selected' : ''}`}
              >
                {h}
              </text>
            );
          })}
          {innerHours.map((h) => {
            const displayH = h === 0 ? 0 : h - 12;
            const angle = getAngle(displayH === 0 ? 12 : displayH, 12);
            const pos = getPosition(angle, NUMBER_RADIUS - 26);
            const isSelected = h === selectedHour;
            return (
              <text
                key={h} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                className={`clock-number inner ${isSelected ? 'selected' : ''}`}
              >
                {pad(h)}
              </text>
            );
          })}
        </>
      );
    } else {
      const handAngle = getAngle(selectedMinute, 60);
      const handEnd = getPosition(handAngle, NUMBER_RADIUS);

      return (
        <>
          <line
            x1={CLOCK_RADIUS} y1={CLOCK_RADIUS}
            x2={handEnd.x} y2={handEnd.y}
            stroke="var(--color-brand-500)" strokeWidth={2}
          />
          <circle cx={handEnd.x} cy={handEnd.y} r={DOT_RADIUS} fill="var(--color-brand-500)" opacity={0.15} />
          {MINUTES.map((m) => {
            const angle = getAngle(m, 60);
            const pos = getPosition(angle, NUMBER_RADIUS);
            const isSelected = m === selectedMinute;
            return (
              <text
                key={m} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="central"
                className={`clock-number ${isSelected ? 'selected' : ''}`}
              >
                {pad(m)}
              </text>
            );
          })}
        </>
      );
    }
  };

  return (
    <div className="clock-time-picker">
      {label && <label className="small text-muted mb-1 d-block">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        className={`clock-trigger form-control form-control-${size} d-flex align-items-center gap-2`}
        onClick={openPicker}
      >
        <FaClock size={12} className="text-muted" />
        <span>{value || '--:--'}</span>
      </button>

      {open && createPortal(
        <>
          <div className="clock-backdrop" onClick={() => setOpen(false)} />
          <div
            className="clock-popover"
            style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, transform: 'translateX(-50%)' }}
          >
            <div className="clock-header">
              <button
                type="button"
                className={`clock-header-segment ${mode === 'hour' ? 'active' : ''}`}
                onClick={() => setMode('hour')}
              >
                {pad(selectedHour)}
              </button>
              <span className="clock-header-colon">:</span>
              <button
                type="button"
                className={`clock-header-segment ${mode === 'minute' ? 'active' : ''}`}
                onClick={() => setMode('minute')}
              >
                {pad(selectedMinute)}
              </button>
            </div>

            <svg
              ref={svgRef}
              width={CLOCK_SIZE}
              height={CLOCK_SIZE}
              className="clock-face"
              onClick={handleClockClick}
            >
              <circle cx={CLOCK_RADIUS} cy={CLOCK_RADIUS} r={CLOCK_RADIUS - 2} fill="var(--bg-muted)" stroke="var(--color-neutral-300)" strokeWidth={1} />
              <circle cx={CLOCK_RADIUS} cy={CLOCK_RADIUS} r={3} fill="var(--color-brand-500)" />
              {renderClockFace()}
            </svg>

            <div className="clock-footer">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleConfirm}>OK</button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ClockTimePicker;
