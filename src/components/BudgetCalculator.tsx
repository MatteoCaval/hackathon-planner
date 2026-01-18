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
  const [selectedFlightId, setSelectedFlightId] = useState<string>('');
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  
  const selectedFlight = flights.find(f => f.id === selectedFlightId);
  const selectedAcc = accommodations.find(a => a.id === selectedAccId);

  const peopleCount = settings.peopleCount;
  const flightCost = selectedFlight ? selectedFlight.pricePerPerson * peopleCount : 0;
  const accCost = selectedAcc ? selectedAcc.totalPrice : 0;
  const totalCost = flightCost + accCost;
  const remaining = settings.totalBudget - totalCost;

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
          <Col md={6}>
            <Form.Label className="d-flex align-items-center gap-2">
                <FaPlane /> Flight Option
            </Form.Label>
            <Form.Select 
              value={selectedFlightId} 
              onChange={e => setSelectedFlightId(e.target.value)}
            >
              <option value="">-- Select Flight --</option>
              {flights.map(f => (
                <option key={f.id} value={f.id}>
                  €{f.pricePerPerson}/p - {f.startDate}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6}>
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
                    <span className="opacity-75">Flights ({peopleCount} ppl)</span>
                    <span className="fw-bold">€{flightCost.toLocaleString()}</span>
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
