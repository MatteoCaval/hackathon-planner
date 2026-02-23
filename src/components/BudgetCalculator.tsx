import React from 'react';
import { Card, Form, Row, Col, Button } from 'react-bootstrap';
import { Flight, Accommodation, ExtraCost, PlannerSettings } from '../types';
import { FaPlane, FaBed, FaCalculator, FaPlus, FaTrash } from 'react-icons/fa';

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
}

const BudgetCalculator: React.FC<Props> = ({
  flights,
  accommodations,
  settings,
  extraCosts,
  onExtraCostsChange,
  flightAssignments,
  onFlightAssignmentsChange,
  selectedAccommodationId,
  onSelectedAccommodationChange
}) => {
  const selectedAcc = accommodations.find((a) => a.id === selectedAccommodationId);
  const peopleCount = settings.peopleCount;

  const totalFlightCost = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    const flight = flights.find((f) => f.id === flightId);
    return total + (flight ? flight.pricePerPerson * count : 0);
  }, 0);

  const assignedPeopleCount = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    return flights.some((f) => f.id === flightId) ? total + count : total;
  }, 0);

  const accCost = selectedAcc ? selectedAcc.totalPrice : 0;
  const totalExtraCosts = extraCosts.reduce((total, extraCost) => total + extraCost.value, 0);
  const totalCost = totalFlightCost + accCost + totalExtraCosts;
  const remaining = settings.totalBudget - totalCost;

  const handleAssignmentChange = (flightId: string, count: number) => {
    if (count < 0) return;
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

  const isOverAssigned = assignedPeopleCount > peopleCount;

  return (
    <Card className="mb-4 budget-card">
      <Card.Body className="p-4 p-md-4">
        <div className="d-flex align-items-center mb-4 gap-3">
          <div className="bg-white bg-opacity-25 p-2 rounded-circle" aria-hidden="true">
            <FaCalculator size={22} className="text-white" />
          </div>
          <div>
            <h2 className="h5 m-0 text-white fw-bold">Budget Estimator</h2>
            <p className="mb-0 subtle-text">Track flight splits, accommodation and extra costs.</p>
          </div>
        </div>

        <Row className="g-4 mb-4">
          <Col md={12}>
            <Form.Label className="d-flex align-items-center gap-2 mb-2">
              <FaPlane /> Flight Allocations
            </Form.Label>
            <div className="p-3 status-strip rounded-3">
              <div className={`small mb-3 ${isOverAssigned ? 'text-warning' : 'text-white-50'}`}>
                Assigned: {assignedPeopleCount} / {peopleCount} people
              </div>
              {flights.length === 0 ? (
                <div className="text-white-50 fst-italic">No flights available. Add options in Flight Manager.</div>
              ) : (
                flights.map((flight) => (
                  <div key={flight.id} className="d-flex align-items-center justify-content-between gap-3 mb-2">
                    <div className="text-truncate">
                      <div className="fw-semibold text-white">{flight.description || 'Unnamed Flight'}</div>
                      <div className="small text-white-50">€{flight.pricePerPerson} {flight.startDate ? `• ${flight.startDate}` : ''}</div>
                    </div>
                    <div style={{ width: '100px' }}>
                      <Form.Control
                        type="number"
                        size="sm"
                        min="0"
                        max={peopleCount}
                        placeholder="0"
                        value={flightAssignments[flight.id] || ''}
                        onChange={(e) => handleAssignmentChange(flight.id, parseInt(e.target.value, 10) || 0)}
                        isInvalid={isOverAssigned}
                        aria-label={`People assigned to ${flight.description || 'flight option'}`}
                      />
                    </div>
                  </div>
                ))
              )}
              {isOverAssigned && (
                <div className="inline-status warning" role="status">Assigned people exceed team size.</div>
              )}
            </div>
          </Col>

          <Col md={12}>
            <Form.Label className="d-flex align-items-center gap-2">
              <FaBed /> Accommodation
            </Form.Label>
            <Form.Select
              value={selectedAccommodationId}
              onChange={(e) => onSelectedAccommodationChange(e.target.value)}
              aria-label="Select accommodation for budget"
            >
              <option value="">-- Select Accommodation --</option>
              {accommodations.map((accommodation) => (
                <option key={accommodation.id} value={accommodation.id}>
                  €{accommodation.totalPrice} - {accommodation.description || 'Accommodation Option'}
                </option>
              ))}
            </Form.Select>
            {accommodations.length === 0 && (
              <div className="inline-status warning" role="status">No accommodations available yet.</div>
            )}
          </Col>

          <Col md={12}>
            <Form.Label className="d-flex align-items-center justify-content-between">
              <span>Extra Costs</span>
              <Button variant="outline-light" size="sm" onClick={handleAddExtraCost}>
                <FaPlus className="me-1" /> Add Cost
              </Button>
            </Form.Label>
            <div className="p-3 status-strip rounded-3">
              {extraCosts.length === 0 ? (
                <div className="text-white-50 fst-italic">No extra costs added yet.</div>
              ) : (
                extraCosts.map((extraCost, index) => (
                  <div key={`${extraCost.description}-${index}`} className="d-flex align-items-center gap-2 mb-2">
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
                      value={extraCost.value}
                      onChange={(e) => {
                        const parsedValue = Number(e.target.value);
                        handleExtraCostChange(index, { value: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0 });
                      }}
                      style={{ maxWidth: '140px' }}
                      aria-label={`Extra cost amount ${index + 1}`}
                    />
                    <Button
                      variant="link"
                      className="text-white p-0 d-flex align-items-center justify-content-center"
                      onClick={() => handleRemoveExtraCost(index)}
                      aria-label={`Remove extra cost row ${index + 1}`}
                    >
                      <FaTrash />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Col>
        </Row>

        <div className={`rounded-3 p-3 status-strip ${remaining < 0 ? 'over' : ''}`} aria-live="polite">
          <Row className="align-items-center g-4">
            <Col md={6} className="border-end border-white border-opacity-25">
              <div className="d-flex justify-content-between mb-2">
                <span className="opacity-75">Flights Total</span>
                <span className="fw-bold">€{totalFlightCost.toLocaleString()}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="opacity-75">Accommodation</span>
                <span className="fw-bold">€{accCost.toLocaleString()}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="opacity-75">Extra Costs</span>
                <span className="fw-bold">€{totalExtraCosts.toLocaleString()}</span>
              </div>
            </Col>
            <Col md={6} className="text-md-end">
              <div className="small text-uppercase opacity-75 fw-semibold">Total Cost</div>
              <div className="h5 fw-bold mb-3">€{totalCost.toLocaleString()}</div>
              <div className="small text-uppercase opacity-75 fw-semibold">Remaining Budget</div>
              <h3 className="mb-0 fw-bold">€{remaining.toLocaleString()}</h3>
              {remaining < 0 && (
                <div className="badge bg-danger mt-2">Over Budget by €{Math.abs(remaining).toLocaleString()}</div>
              )}
            </Col>
          </Row>
        </div>
      </Card.Body>
    </Card>
  );
};

export default BudgetCalculator;
