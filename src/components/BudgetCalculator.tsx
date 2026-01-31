import React, { useState } from 'react';
import { Card, Form, Row, Col } from 'react-bootstrap';
import { Flight, Accommodation, PlannerSettings } from '../types';
import { FaPlane, FaBed, FaCalculator } from 'react-icons/fa';

interface Props {
  flights: Flight[];
  accommodations: Accommodation[];
  settings: PlannerSettings;
}

const BudgetCalculator: React.FC<Props> = ({ flights, accommodations, settings }) => {
  const [flightAssignments, setFlightAssignments] = useState<Record<string, number>>({});
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  
  const selectedAcc = accommodations.find(a => a.id === selectedAccId);

  const peopleCount = settings.peopleCount;
  
  // Calculate total flight cost based on assignments
  const totalFlightCost = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    const flight = flights.find(f => f.id === flightId);
    return total + (flight ? flight.pricePerPerson * count : 0);
  }, 0);

  const assignedPeopleCount = Object.entries(flightAssignments).reduce((total, [flightId, count]) => {
    // Only count assignments for flights that still exist
    return flights.some(f => f.id === flightId) ? total + count : total;
  }, 0);

  const accCost = selectedAcc ? selectedAcc.totalPrice : 0;
  const totalCost = totalFlightCost + accCost;
  const remaining = settings.totalBudget - totalCost;

  const handleAssignmentChange = (flightId: string, count: number) => {
    if (count < 0) return;
    setFlightAssignments(prev => {
        const newAssignments = { ...prev };
        if (count === 0) {
            delete newAssignments[flightId];
        } else {
            newAssignments[flightId] = count;
        }
        return newAssignments;
    });
  };

  return (
    <Card className="mb-4 shadow budget-card">
      <Card.Body className="p-4">
        <div className="d-flex align-items-center mb-4">
            <div className="bg-white bg-opacity-25 p-2 rounded-circle me-3">
                <FaCalculator size={24} className="text-white" />
            </div>
            <h4 className="m-0 text-white">Budget Estimator</h4>
        </div>

        <Row className="g-4 mb-4">
          <Col md={12}>
            <Form.Label className="d-flex align-items-center gap-2 mb-3">
                <FaPlane /> Flight Allocations 
                <span className={assignedPeopleCount > peopleCount ? "text-danger ms-2" : "text-white-50 ms-2"}>
                    (Assigned: {assignedPeopleCount} / {peopleCount} people)
                </span>
            </Form.Label>
            <div className="bg-white bg-opacity-10 rounded p-3">
                {flights.length === 0 ? (
                    <div className="text-white-50 fst-italic">No flights available. Add some in the Flight Manager.</div>
                ) : (
                    flights.map(f => (
                        <div key={f.id} className="d-flex align-items-center justify-content-between mb-2 last-mb-0">
                            <div className="text-truncate me-2" title={f.description}>
                                <span className="fw-bold">€{f.pricePerPerson}</span>
                                <span className="mx-2">-</span>
                                <span>{f.description || 'Unnamed Flight'}</span>
                                <div className="small opacity-75">{f.startDate}</div>
                            </div>
                            <div style={{ width: '100px' }}>
                                <Form.Control
                                    type="number"
                                    size="sm"
                                    min="0"
                                    max={peopleCount}
                                    placeholder="0"
                                    value={flightAssignments[f.id] || ''}
                                    onChange={e => handleAssignmentChange(f.id, parseInt(e.target.value) || 0)}
                                    isInvalid={assignedPeopleCount > peopleCount}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
          </Col>
          <Col md={12}>
            <Form.Label className="d-flex align-items-center gap-2">
                <FaBed /> Accommodation
            </Form.Label>
            <Form.Select 
              value={selectedAccId} 
              onChange={e => setSelectedAccId(e.target.value)}
            >
              <option value="">-- Select Accommodation --</option>
              {accommodations.map(a => (
                <option key={a.id} value={a.id}>
                  €{a.totalPrice} - {a.description}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        <div className="bg-white bg-opacity-10 rounded-3 p-3">
            <Row className="align-items-center">
            <Col md={6} className="border-end border-white border-opacity-25">
                <div className="d-flex justify-content-between mb-2">
                    <span className="opacity-75">Flights Total</span>
                    <span className="fw-bold">€{totalFlightCost.toLocaleString()}</span>
                </div>
                <div className="d-flex justify-content-between">
                    <span className="opacity-75">Accommodation</span>
                    <span className="fw-bold">€{accCost.toLocaleString()}</span>
                </div>
            </Col>
            <Col md={6} className="text-end ps-4">
                <div className="mb-1 opacity-75 small text-uppercase fw-bold">Remaining Budget</div>
                <h2 className="mb-0 fw-bold">
                    €{remaining.toLocaleString()}
                </h2>
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
