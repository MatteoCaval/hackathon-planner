import React, { useMemo } from 'react';
import { Flight, Accommodation, ExtraCost, PlannerSettings, BudgetAttempt } from '../types';
import { FaPlane, FaBed, FaPlus, FaTrash, FaTag, FaBookmark, FaTh, FaArrowRight } from 'react-icons/fa';
import { calculateBudgetSnapshot, formatCurrency } from '../utils/budget';

interface Props {
  flights: Flight[];
  accommodations: Accommodation[];
  settings: PlannerSettings;
  extraCosts: ExtraCost[];
  onExtraCostsChange: (value: ExtraCost[]) => void;
  flightAssignments: Record<string, number>;
  onFlightAssignmentsChange: (value: Record<string, number>) => void;
  selectedAccommodationId: string;
  onSelectedAccommodationChange: (value: string) => void;
  attempts: BudgetAttempt[];
  fixedAttemptId: string;
  onAttemptsChange: (value: BudgetAttempt[]) => void;
  onFixedAttemptIdChange: (value: string) => void;
}

const createAttemptId = (): string => {
  if (typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const fmtDateRange = (start: string, end: string): string => {
  if (!start || !end) return '';
  const da = new Date(start + 'T00:00');
  const db = new Date(end + 'T00:00');
  const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const aStr = da.toLocaleDateString('en-GB', opts);
  const bStr = sameMonth ? String(db.getDate()) : db.toLocaleDateString('en-GB', opts);
  return `${aStr} – ${bStr}`;
};

const nightsBetween = (a: string, b: string): number =>
  a && b ? Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)) : 0;

const BudgetCalculator: React.FC<Props> = ({
  flights,
  accommodations,
  settings,
  extraCosts,
  onExtraCostsChange,
  flightAssignments,
  onFlightAssignmentsChange,
  selectedAccommodationId,
  onSelectedAccommodationChange,
  attempts,
  fixedAttemptId,
  onAttemptsChange,
  onFixedAttemptIdChange
}) => {
  const snapshot = useMemo(() => calculateBudgetSnapshot({
    flights, accommodations, flightAssignments, selectedAccommodationId, extraCosts, settings
  }), [flights, accommodations, flightAssignments, selectedAccommodationId, extraCosts, settings]);

  const assignedTotal = useMemo(() =>
    Object.values(flightAssignments).reduce((a, b) => a + (b || 0), 0),
  [flightAssignments]);

  const isOverAssigned = assignedTotal > settings.peopleCount;
  const isUnderAssigned = assignedTotal > 0 && assignedTotal < settings.peopleCount;

  const setAssignment = (flightId: string, count: number) => {
    const c = Math.max(0, count);
    const next = { ...flightAssignments };
    if (c === 0) delete next[flightId]; else next[flightId] = c;
    onFlightAssignmentsChange(next);
  };

  const distributeEvenly = () => {
    if (flights.length === 0) return;
    const per = Math.floor(settings.peopleCount / flights.length);
    let rem = settings.peopleCount - per * flights.length;
    const next: Record<string, number> = {};
    for (const f of flights) {
      const c = per + (rem > 0 ? 1 : 0);
      if (c > 0) next[f.id] = c;
      if (rem > 0) rem--;
    }
    onFlightAssignmentsChange(next);
  };

  const clearAssignments = () => onFlightAssignmentsChange({});

  const handleAddExtraCost = () => {
    onExtraCostsChange([...extraCosts, { description: '', value: 0 }]);
  };

  const handleExtraCostChange = (index: number, updates: Partial<ExtraCost>) => {
    onExtraCostsChange(extraCosts.map((e, i) => i === index ? { ...e, ...updates } : e));
  };

  const handleRemoveExtraCost = (index: number) => {
    onExtraCostsChange(extraCosts.filter((_, i) => i !== index));
  };

  const saveScenario = () => {
    if (attempts.length >= 5) return;
    const newAttempt: BudgetAttempt = {
      id: createAttemptId(),
      name: `Scenario ${attempts.length + 1}`,
      createdAt: Date.now(),
      flightAssignments: { ...flightAssignments },
      selectedAccommodationId,
      totalCost: snapshot.totalCost,
      remaining: snapshot.remaining,
      perPersonTotal: snapshot.perPersonTotal
    };
    onAttemptsChange([...attempts, newAttempt]);
    onFixedAttemptIdChange(newAttempt.id);
  };

  const loadScenario = (attempt: BudgetAttempt) => {
    onFlightAssignmentsChange({ ...attempt.flightAssignments });
    onSelectedAccommodationChange(attempt.selectedAccommodationId);
    onFixedAttemptIdChange(attempt.id);
  };

  const deleteScenario = (id: string) => {
    const next = attempts.filter((a) => a.id !== id);
    onAttemptsChange(next);
    if (fixedAttemptId === id) onFixedAttemptIdChange(next[0]?.id || '');
  };

  const renameScenario = (id: string, name: string) => {
    onAttemptsChange(attempts.map((a) => a.id === id ? { ...a, name } : a));
  };

  return (
    <section className="section" id="planner">
      <div className="section-head">
        <div>
          <h2 className="section-title">Final plan</h2>
          <div className="section-sub">Assign people to flights, pick a stay, add extras — see the total update live.</div>
        </div>
        <div className="section-actions">
          <span className="section-meta">{settings.peopleCount} traveller{settings.peopleCount === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* Budget metric strip */}
      <div className="budget-strip">
        <div className="bs-cell">
          <span className="bs-label">Flights</span>
          <span className="bs-val">{formatCurrency(snapshot.flightCost)}</span>
        </div>
        <div className="bs-cell">
          <span className="bs-label">Stay</span>
          <span className="bs-val">{formatCurrency(snapshot.accommodationCost)}</span>
        </div>
        <div className="bs-cell">
          <span className="bs-label">Extras</span>
          <span className="bs-val">{formatCurrency(snapshot.extraCostsCost)}</span>
        </div>
        <div className="bs-cell bs-total">
          <span className="bs-label">Total</span>
          <span className="bs-val">{formatCurrency(snapshot.totalCost)}</span>
        </div>
        <div className={`bs-cell ${snapshot.remaining < 0 ? 'bs-over' : 'bs-under'}`}>
          <span className="bs-label">{snapshot.remaining < 0 ? 'Over budget' : 'Remaining'}</span>
          <span className="bs-val">{formatCurrency(Math.abs(snapshot.remaining))}</span>
        </div>
        <div className="bs-cell">
          <span className="bs-label">Per person</span>
          <span className="bs-val">{formatCurrency(snapshot.perPersonTotal)}</span>
        </div>
      </div>

      <div className="planner-grid">
        {/* Flight assignments */}
        <div className="planner-card">
          <div className="pc-head">
            <div>
              <div className="pc-title"><FaPlane size={14} /> Flight assignments</div>
              <div className="pc-sub">
                {assignedTotal} of {settings.peopleCount} assigned
                {isOverAssigned && <span className="warn"> · over by {assignedTotal - settings.peopleCount}</span>}
                {isUnderAssigned && <span className="info"> · {settings.peopleCount - assignedTotal} unassigned</span>}
              </div>
            </div>
            <div className="pc-actions">
              <button className="btn btn-ghost btn-xs" onClick={distributeEvenly} disabled={flights.length === 0}>
                <FaTh size={10} /> Split evenly
              </button>
              <button className="btn btn-ghost btn-xs" onClick={clearAssignments} disabled={assignedTotal === 0}>Clear</button>
            </div>
          </div>

          {flights.length === 0 ? (
            <div className="pc-empty">No flights yet. Add some above.</div>
          ) : (
            <div className="assign-list">
              {flights.map((f) => {
                const count = flightAssignments[f.id] || 0;
                const subtotal = count * f.pricePerPerson;
                const dateStr = fmtDateRange(f.startDate, f.endDate);
                return (
                  <div key={f.id} className={`assign-row${count > 0 ? ' is-assigned' : ''}`}>
                    <div className="ar-route">
                      <span className="iata-pill">{f.origin || 'DUB'}</span>
                      <FaArrowRight size={10} style={{ color: 'var(--ink-4)' }} />
                      <span className="ar-desc">{f.description || 'Flight'}</span>
                    </div>
                    <div className="ar-counter">
                      <button className="cnt-btn" onClick={() => setAssignment(f.id, count - 1)} disabled={count === 0}>−</button>
                      <input
                        type="number"
                        min={0}
                        max={settings.peopleCount}
                        value={count}
                        onChange={(e) => setAssignment(f.id, parseInt(e.target.value, 10) || 0)}
                        className="cnt-input"
                      />
                      <button className="cnt-btn" onClick={() => setAssignment(f.id, count + 1)}>+</button>
                    </div>
                    <div className="ar-meta">
                      <span className="ar-time">
                        {f.departureTime || '—'} → {f.arrivalTime || '—'}
                        {dateStr && ` · ${dateStr}`}
                        {` · ${formatCurrency(f.pricePerPerson)}/pp`}
                      </span>
                    </div>
                    <div className="ar-subtotal">
                      {count > 0 ? formatCurrency(subtotal) : <span className="muted">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stay selection */}
        <div className="planner-card">
          <div className="pc-head">
            <div>
              <div className="pc-title"><FaBed size={14} /> Selected stay</div>
              <div className="pc-sub">Pick one option to lock in for the trip.</div>
            </div>
          </div>

          {accommodations.length === 0 ? (
            <div className="pc-empty">No stays yet.</div>
          ) : (
            <div className="stay-radio-list">
              <label className={`stay-radio${!selectedAccommodationId ? ' is-selected' : ''}`}>
                <input type="radio" name="stay-select" checked={!selectedAccommodationId} onChange={() => onSelectedAccommodationChange('')} />
                <div className="sr-content">
                  <div className="sr-name muted">— No stay selected —</div>
                </div>
              </label>
              {accommodations.map((acc) => {
                const nights = nightsBetween(acc.startDate, acc.endDate);
                return (
                  <label key={acc.id} className={`stay-radio${selectedAccommodationId === acc.id ? ' is-selected' : ''}`}>
                    <input type="radio" name="stay-select" checked={selectedAccommodationId === acc.id} onChange={() => onSelectedAccommodationChange(acc.id)} />
                    <div className="sr-content">
                      <div className="sr-name">{acc.description || 'Accommodation'}</div>
                      <div className="sr-meta">
                        {fmtDateRange(acc.startDate, acc.endDate)}
                        {nights > 0 && ` · ${nights} night${nights === 1 ? '' : 's'}`}
                        {acc.rooms && ` · ${acc.rooms} room${acc.rooms === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <div className="sr-price">{formatCurrency(acc.totalPrice)}</div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Extras */}
        <div className="planner-card planner-card-wide">
          <div className="pc-head">
            <div>
              <div className="pc-title"><FaTag size={14} /> Extras</div>
              <div className="pc-sub">Taxis, baggage, dinners — anything that's not a flight or stay.</div>
            </div>
            <div className="pc-actions">
              <button className="btn btn-outline btn-xs" onClick={handleAddExtraCost}>
                <FaPlus size={10} /> Add line item
              </button>
            </div>
          </div>

          {extraCosts.length === 0 ? (
            <div className="pc-empty">No extras yet. Click "Add line item" to track baggage, taxis, etc.</div>
          ) : (
            <div className="extras-list">
              {extraCosts.map((e, i) => (
                <div key={i} className="extra-row">
                  <input
                    className="input input-sm"
                    placeholder="Label (e.g. Airport taxi)"
                    value={e.description}
                    onChange={(ev) => handleExtraCostChange(i, { description: ev.target.value })}
                  />
                  <input
                    className="input input-sm input-num"
                    type="number"
                    placeholder="0"
                    min={0}
                    step={1}
                    value={e.value || ''}
                    onChange={(ev) => {
                      const parsed = Number(ev.target.value);
                      handleExtraCostChange(i, { value: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
                    }}
                  />
                  <div className="extra-subtotal">{formatCurrency(e.value)}</div>
                  <button className="btn btn-icon" style={{ width: 28, height: 28 }} title="Remove" onClick={() => handleRemoveExtraCost(i)}>
                    <FaTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scenarios */}
        <div className="planner-card planner-card-wide">
          <div className="pc-head">
            <div>
              <div className="pc-title"><FaBookmark size={14} /> Saved scenarios</div>
              <div className="pc-sub">Compare different combinations side-by-side. Up to 5.</div>
            </div>
            <div className="pc-actions">
              <button className="btn btn-accent btn-xs" onClick={saveScenario} disabled={attempts.length >= 5}>
                <FaPlus size={10} /> Save current
              </button>
            </div>
          </div>

          {attempts.length === 0 ? (
            <div className="pc-empty">No saved scenarios yet. Configure your plan above and save it to compare alternatives.</div>
          ) : (
            <div className="scenarios-grid">
              {attempts.map((sc) => {
                const isFixed = sc.id === fixedAttemptId;
                return (
                  <div key={sc.id} className={`scenario-card${isFixed ? ' is-fixed' : ''}`}>
                    <div className="sc-head">
                      <input
                        className="sc-name"
                        value={sc.name}
                        onChange={(e) => renameScenario(sc.id, e.target.value)}
                      />
                      {isFixed && <span className="sc-pinned">Pinned</span>}
                    </div>
                    <div className="sc-body">
                      <div className="sc-row"><span>Total</span><strong>{formatCurrency(sc.totalCost)}</strong></div>
                      <div className="sc-row"><span>Per person</span><strong>{formatCurrency(sc.perPersonTotal)}</strong></div>
                    </div>
                    <div className="sc-foot">
                      <button className="btn btn-outline btn-xs" onClick={() => loadScenario(sc)}>Load</button>
                      <button className="btn btn-icon" style={{ width: 28, height: 28 }} title="Delete" onClick={() => deleteScenario(sc.id)}>
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BudgetCalculator;
