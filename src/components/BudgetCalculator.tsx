import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card, Form, Row, Col, Button, Alert } from 'react-bootstrap';
import { Flight, Accommodation, ExtraCost, PlannerSettings, BudgetAttempt } from '../types';
import { FaPlane, FaBed, FaCalculator, FaPlus, FaTrash, FaFlask, FaSync } from 'react-icons/fa';
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

const areAssignmentsEqual = (left: Record<string, number>, right: Record<string, number>): boolean => {
  const leftEntries = Object.entries(left).filter(([, count]) => count > 0);
  const rightEntries = Object.entries(right).filter(([, count]) => count > 0);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([flightId, count]) => right[flightId] === count);
};

const AccommodationDropdown: React.FC<{
  accommodations: Accommodation[];
  selectedId: string;
  onChange: (id: string) => void;
}> = ({ accommodations, selectedId, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = accommodations.find((a) => a.id === selectedId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (id: string) => { onChange(id); setOpen(false); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
          borderRadius: 6, cursor: 'pointer', textAlign: 'left', color: 'var(--bs-body-color)'
        }}
      >
        {selected ? (
          <>
            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            )}
            <span className="small flex-grow-1">{formatCurrency(selected.totalPrice)} — {selected.description || 'Accommodation option'}</span>
          </>
        ) : (
          <span className="small text-muted flex-grow-1">— Select accommodation —</span>
        )}
        <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 'var(--z-dropdown)' as unknown as number, width: '100%', top: 'calc(100% + 4px)',
          background: 'var(--bs-body-bg)', border: '1px solid var(--bs-border-color)',
          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', maxHeight: 260, overflowY: 'auto'
        }}>
          <div
            onClick={() => select('')}
            style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', gap: 8 }}
            className="dropdown-item small text-muted"
          >
            — Select accommodation —
          </div>
          {accommodations.map((acc) => (
            <div
              key={acc.id}
              onClick={() => select(acc.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
                background: acc.id === selectedId ? 'var(--bs-primary-bg-subtle)' : undefined
              }}
              className="dropdown-item"
            >
              {acc.imageUrl ? (
                <img src={acc.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0, background: 'var(--bs-secondary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏨</div>
              )}
              <div className="small">
                <div>{acc.description || 'Accommodation option'}</div>
                <div className="text-muted">{formatCurrency(acc.totalPrice)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const snapshot = useMemo(() => {
    return calculateBudgetSnapshot({
      flights,
      accommodations,
      flightAssignments,
      selectedAccommodationId,
      extraCosts,
      settings
    });
  }, [flights, accommodations, flightAssignments, selectedAccommodationId, extraCosts, settings]);

  const savedAttempt = attempts.find((attempt) => attempt.id === fixedAttemptId) ?? attempts[0] ?? null;
  const isOverAssigned = snapshot.isOverAssigned;
  const hasUnsavedChanges = savedAttempt
    ? (
      savedAttempt.selectedAccommodationId !== selectedAccommodationId ||
      !areAssignmentsEqual(savedAttempt.flightAssignments, flightAssignments) ||
      savedAttempt.totalCost !== snapshot.totalCost
    )
    : false;

  const handleAssignmentChange = (flightId: string, count: number) => {
    if (count < 0) {
      return;
    }

    const nextAssignments = { ...flightAssignments };
    if (count === 0) {
      delete nextAssignments[flightId];
    } else {
      nextAssignments[flightId] = count;
    }

    onFlightAssignmentsChange(nextAssignments);
  };

  const handleAddExtraCost = () => {
    onExtraCostsChange([...extraCosts, { description: '', value: 0 }]);
  };

  const handleExtraCostChange = (index: number, updates: Partial<ExtraCost>) => {
    const updatedExtraCosts = extraCosts.map((extraCost, currentIndex) => {
      if (currentIndex !== index) {
        return extraCost;
      }
      return { ...extraCost, ...updates };
    });
    onExtraCostsChange(updatedExtraCosts);
  };

  const handleRemoveExtraCost = (index: number) => {
    onExtraCostsChange(extraCosts.filter((_, currentIndex) => currentIndex !== index));
  };

  const saveBaseline = () => {
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

  const applySavedBaseline = (attempt?: BudgetAttempt | null) => {
    const target = attempt ?? savedAttempt;
    if (!target) return;

    onFlightAssignmentsChange({ ...target.flightAssignments });
    onSelectedAccommodationChange(target.selectedAccommodationId);
    onFixedAttemptIdChange(target.id);
  };

  const replaceSavedWithCurrent = () => {
    if (!savedAttempt) return;

    const updatedAttempt: BudgetAttempt = {
      ...savedAttempt,
      createdAt: Date.now(),
      flightAssignments: { ...flightAssignments },
      selectedAccommodationId,
      totalCost: snapshot.totalCost,
      remaining: snapshot.remaining,
      perPersonTotal: snapshot.perPersonTotal
    };

    onAttemptsChange(attempts.map((a) => a.id === savedAttempt.id ? updatedAttempt : a));
  };

  const deleteBaseline = (attemptId: string) => {
    const next = attempts.filter((a) => a.id !== attemptId);
    onAttemptsChange(next);
    if (fixedAttemptId === attemptId) {
      onFixedAttemptIdChange(next[0]?.id || '');
    }
  };

  const distributeEvenly = () => {
    if (flights.length === 0) return;
    const perFlight = Math.floor(settings.peopleCount / flights.length);
    let remainder = settings.peopleCount - perFlight * flights.length;
    const next: Record<string, number> = {};
    for (const flight of flights) {
      next[flight.id] = perFlight + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
    onFlightAssignmentsChange(next);
  };

  return (
    <div className="budget-layout">
      {isOverAssigned && (
        <Alert variant="danger" className="mb-0">
          Assigned travelers exceed team size. Reduce allocations to {settings.peopleCount}.
        </Alert>
      )}

      <Card className="workspace-card budget-hero-card">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
            <div className="d-flex align-items-center gap-3">
              <div className="budget-icon" aria-hidden="true">
                <FaCalculator size={20} />
              </div>
              <div>
                <h2 className="workspace-card-title m-0">Budget Strategy</h2>
                <p className="subtle-text mb-0">Save one baseline, then continue exploring changes until you choose to override it.</p>
              </div>
            </div>
          </div>

          <div className="budget-metric-grid" aria-live="polite">
            <div className="budget-metric">
              <span>Flights</span>
              <strong>{formatCurrency(snapshot.flightCost)}</strong>
            </div>
            <div className="budget-metric">
              <span>Stay</span>
              <strong>{formatCurrency(snapshot.accommodationCost)}</strong>
            </div>
            <div className="budget-metric">
              <span>Extras</span>
              <strong>{formatCurrency(snapshot.extraCostsCost)}</strong>
            </div>
            <div className="budget-metric">
              <span>Total</span>
              <strong>{formatCurrency(snapshot.totalCost)}</strong>
            </div>
            <div className={`budget-metric ${snapshot.remaining < 0 ? 'negative' : ''}`}>
              <span>Remaining</span>
              <strong>{formatCurrency(snapshot.remaining)}</strong>
            </div>
            <div className="budget-metric">
              <span>Per Person</span>
              <strong>{formatCurrency(snapshot.perPersonTotal)}</strong>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="workspace-card">
        <Card.Header className="workspace-card-header">
          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
            <div>
              <h3 className="workspace-card-title m-0">Saved Scenarios</h3>
              <p className="subtle-text mb-0">Save up to 5 budget scenarios to compare options.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={saveBaseline}
              className="d-inline-flex align-items-center gap-2"
              disabled={attempts.length >= 5}
            >
              <FaFlask />
              Save Current
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {attempts.length === 0 ? (
            <div className="empty-inline-state">No saved scenarios yet. Save your current setup when it looks good.</div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {attempts.map((attempt) => {
                const isActive = attempt.id === fixedAttemptId;
                const delta = snapshot.totalCost - attempt.totalCost;
                return (
                  <section key={attempt.id} className={`fixed-attempt-panel ${isActive ? '' : 'opacity-75'}`}>
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <div className="fw-semibold">{attempt.name}</div>
                        {isActive && <span className="badge bg-primary-subtle text-primary-emphasis">Active</span>}
                      </div>
                      <div className="small subtle-text">
                        {formatCurrency(attempt.totalCost)} total &bull; {formatCurrency(attempt.remaining)} remaining &bull; {formatCurrency(attempt.perPersonTotal)} pp
                      </div>
                      <div className="small subtle-text">Saved {new Date(attempt.createdAt).toLocaleString()}</div>
                      {delta !== 0 && (
                        <div className="small text-warning-emphasis fw-semibold">
                          Current is {formatCurrency(Math.abs(delta))} {delta > 0 ? 'above' : 'below'}
                        </div>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <Button size="sm" variant={isActive ? 'outline-primary' : 'outline-secondary'} onClick={() => applySavedBaseline(attempt)}>
                        Apply
                      </Button>
                      {isActive && (
                        <Button size="sm" variant="outline-secondary" onClick={replaceSavedWithCurrent} disabled={!hasUnsavedChanges} className="d-inline-flex align-items-center gap-1">
                          <FaSync size={10} /> Override
                        </Button>
                      )}
                      <Button size="sm" variant="link" className="text-danger text-decoration-none p-0" onClick={() => deleteBaseline(attempt.id)}>
                        <FaTrash size={12} />
                      </Button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col xl={12}>
          <Card className="workspace-card h-100">
            <Card.Header className="workspace-card-header">
              <h3 className="workspace-card-title m-0">Cost Inputs</h3>
            </Card.Header>
            <Card.Body>
              <Form.Group className="mb-4">
                <Form.Label className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span className="d-flex align-items-center gap-2"><FaPlane /> Flight allocations</span>
                  {flights.length > 0 && (
                    <Button size="sm" variant="outline-secondary" onClick={distributeEvenly}>
                      Distribute evenly
                    </Button>
                  )}
                </Form.Label>
                <div className="input-surface">
                  <div className={`small mb-3 ${isOverAssigned ? 'text-danger fw-semibold' : 'subtle-text'}`}>
                    Assigned: {snapshot.assignedPeopleCount} / {settings.peopleCount} travelers
                  </div>
                  {flights.length === 0 ? (
                    <div className="empty-inline-state">No flights available yet.</div>
                  ) : (
                    flights.map((flight) => (
                      <div key={flight.id} className="assignment-row">
                        <div>
                          <div className="fw-semibold">{flight.description || 'Unnamed flight'}</div>
                          <div className="small subtle-text">
                            {formatCurrency(flight.pricePerPerson)} per person
                            {(flight.arrivalTime || flight.departureTime) && (
                              <span className="ms-2">
                                {flight.arrivalTime && <span>✈ arrives {flight.arrivalTime}</span>}
                                {flight.arrivalTime && flight.departureTime && <span className="mx-1">·</span>}
                                {flight.departureTime && <span>departs {flight.departureTime}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                        <Form.Control
                          type="number"
                          size="sm"
                          min="0"
                          max={settings.peopleCount}
                          value={flightAssignments[flight.id] || ''}
                          onChange={(e) => handleAssignmentChange(flight.id, parseInt(e.target.value, 10) || 0)}
                          isInvalid={isOverAssigned}
                          aria-label={`People assigned to ${flight.description || 'flight option'}`}
                          style={{ width: '92px' }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="d-flex align-items-center gap-2 mb-2">
                  <FaBed /> Accommodation
                </Form.Label>
                <AccommodationDropdown
                  accommodations={accommodations}
                  selectedId={selectedAccommodationId}
                  onChange={onSelectedAccommodationChange}
                />
              </Form.Group>

              <Form.Group>
                <Form.Label className="d-flex align-items-center justify-content-between gap-2 mb-2">
                  <span>Extra costs</span>
                  <Button variant="outline-secondary" size="sm" onClick={handleAddExtraCost}>
                    <FaPlus className="me-1" /> Add cost
                  </Button>
                </Form.Label>
                <div className="input-surface">
                  {extraCosts.length === 0 ? (
                    <div className="empty-inline-state">No extra costs yet.</div>
                  ) : (
                    extraCosts.map((extraCost, index) => (
                      <div key={`extra-cost-${index}`} className="extra-row">
                        <Form.Control
                          size="sm"
                          placeholder="Description"
                          value={extraCost.description}
                          onChange={(e) => handleExtraCostChange(index, { description: e.target.value })}
                          aria-label={`Extra cost description ${index + 1}`}
                        />
                        <Form.Control
                          size="sm"
                          type="number"
                          min="0"
                          step="10"
                          placeholder="0"
                          value={extraCost.value || ''}
                          onChange={(e) => {
                            const parsedValue = Number(e.target.value);
                            handleExtraCostChange(index, { value: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0 });
                          }}
                          aria-label={`Extra cost amount ${index + 1}`}
                        />
                        <Button
                          variant="link"
                          className="text-danger p-0 d-flex align-items-center justify-content-center"
                          onClick={() => handleRemoveExtraCost(index)}
                          aria-label={`Remove extra cost row ${index + 1}`}
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Form.Group>
            </Card.Body>
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default BudgetCalculator;
