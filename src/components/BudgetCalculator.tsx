import React, { useMemo } from 'react';
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
  const selectedAccommodation = accommodations.find((accommodation) => accommodation.id === selectedAccommodationId);
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
    if (savedAttempt) {
      return;
    }

    const newAttempt: BudgetAttempt = {
      id: createAttemptId(),
      name: 'Saved baseline',
      createdAt: Date.now(),
      flightAssignments: { ...flightAssignments },
      selectedAccommodationId,
      totalCost: snapshot.totalCost,
      remaining: snapshot.remaining,
      perPersonTotal: snapshot.perPersonTotal
    };

    onAttemptsChange([newAttempt]);
    onFixedAttemptIdChange(newAttempt.id);
  };

  const applySavedBaseline = () => {
    if (!savedAttempt) {
      return;
    }

    onFlightAssignmentsChange({ ...savedAttempt.flightAssignments });
    onSelectedAccommodationChange(savedAttempt.selectedAccommodationId);
  };

  const replaceSavedWithCurrent = () => {
    if (!savedAttempt) {
      return;
    }

    const updatedAttempt: BudgetAttempt = {
      ...savedAttempt,
      name: 'Saved baseline',
      createdAt: Date.now(),
      flightAssignments: { ...flightAssignments },
      selectedAccommodationId,
      totalCost: snapshot.totalCost,
      remaining: snapshot.remaining,
      perPersonTotal: snapshot.perPersonTotal
    };

    onAttemptsChange([updatedAttempt]);
    onFixedAttemptIdChange(updatedAttempt.id);
  };

  const clearSavedBaseline = () => {
    onAttemptsChange([]);
    onFixedAttemptIdChange('');
  };

  const baselineTotalDelta = savedAttempt ? snapshot.totalCost - savedAttempt.totalCost : 0;
  const baselineDeltaLabel = (() => {
    if (!savedAttempt) {
      return null;
    }

    if (baselineTotalDelta === 0) {
      return hasUnsavedChanges
        ? 'Current draft has a different option mix at the same total.'
        : 'Current draft matches your saved baseline.';
    }

    return `${formatCurrency(Math.abs(baselineTotalDelta))} ${baselineTotalDelta > 0 ? 'above' : 'below'} saved baseline`;
  })();

  const savedAtLabel = savedAttempt ? new Date(savedAttempt.createdAt).toLocaleString() : null;

  return (
    <div className="budget-layout">
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
              <h3 className="workspace-card-title m-0">Saved Baseline</h3>
              <p className="subtle-text mb-0">One saved plan only. Test changes in your current draft and override only when ready.</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={saveBaseline}
              className="d-inline-flex align-items-center gap-2"
              disabled={Boolean(savedAttempt)}
            >
              <FaFlask />
              {savedAttempt ? 'Baseline Saved' : 'Save Baseline'}
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {!savedAttempt ? (
            <div className="empty-inline-state">No saved baseline yet. Save your current setup when it looks good.</div>
          ) : (
            <section className="fixed-attempt-panel">
              <div>
                <div className="small text-uppercase subtle-text fw-semibold">Saved Baseline</div>
                <div className="fw-semibold">{savedAttempt.name}</div>
                <div className="small subtle-text">
                  {formatCurrency(savedAttempt.totalCost)} total • {formatCurrency(savedAttempt.remaining)} remaining • {formatCurrency(savedAttempt.perPersonTotal)} per person
                </div>
                <div className="small subtle-text">Saved {savedAtLabel}</div>
                {baselineDeltaLabel && (
                  <div className={`small ${hasUnsavedChanges ? 'text-warning-emphasis fw-semibold' : 'subtle-text'}`}>
                    {baselineDeltaLabel}
                  </div>
                )}
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline-secondary" onClick={applySavedBaseline}>
                  Apply Saved
                </Button>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={replaceSavedWithCurrent}
                  className="d-inline-flex align-items-center gap-2"
                  disabled={!hasUnsavedChanges}
                >
                  <FaSync />
                  Override With Current
                </Button>
                <Button size="sm" variant="link" className="text-danger text-decoration-none p-0" onClick={clearSavedBaseline}>
                  Clear Saved
                </Button>
              </div>
            </section>
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
                <Form.Label className="d-flex align-items-center gap-2 mb-2">
                  <FaPlane /> Flight allocations
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
                          <div className="small subtle-text">{formatCurrency(flight.pricePerPerson)} per person</div>
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
                <Form.Select
                  value={selectedAccommodationId}
                  onChange={(e) => onSelectedAccommodationChange(e.target.value)}
                  aria-label="Select accommodation for budget"
                >
                  <option value="">-- Select accommodation --</option>
                  {accommodations.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {formatCurrency(accommodation.totalPrice)} - {accommodation.description || 'Accommodation option'}
                    </option>
                  ))}
                </Form.Select>

                {selectedAccommodation && (
                  <div className="small subtle-text mt-2">
                    Selected: <strong>{selectedAccommodation.description || 'Accommodation option'}</strong>
                  </div>
                )}
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
                          value={extraCost.value}
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

      {isOverAssigned && (
        <Alert variant="danger" className="mb-0">
          Assigned travelers exceed team size. Reduce allocations to {settings.peopleCount}.
        </Alert>
      )}
    </div>
  );
};

export default BudgetCalculator;
