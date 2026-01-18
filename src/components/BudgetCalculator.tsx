import React, { useState } from 'react';
import { Card, Form } from 'react-bootstrap';
import { Flight, Accommodation } from '../types';

interface Props {
  flights: Flight[];
  accommodations: Accommodation[];
  totalBudget: number;
}

const BudgetCalculator: React.FC<Props> = ({ flights, accommodations, totalBudget }) => {
  const [selectedFlightId, setSelectedFlightId] = useState<string>('');
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [peopleCount, setPeopleCount] = useState<number>(1);

  const selectedFlight = flights.find(f => f.id === selectedFlightId);
  const selectedAcc = accommodations.find(a => a.id === selectedAccId);

  const flightCost = selectedFlight ? selectedFlight.pricePerPerson * peopleCount : 0;
  const accCost = selectedAcc ? selectedAcc.totalPrice : 0;
  const totalCost = flightCost + accCost;
  const remaining = totalBudget - totalCost;

  return (
    <Card className="mb-4 shadow-sm border-info">
      <Card.Header className="bg-info text-white">Budget Calculator</Card.Header>
      <Card.Body>
        <div className="row g-3">
          <div className="col-md-4">
            <Form.Label>Select Flight Option</Form.Label>
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
          </div>
          <div className="col-md-4">
            <Form.Label>Select Accommodation</Form.Label>
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
          </div>
          <div className="col-md-4">
            <Form.Label>Number of People</Form.Label>
            <Form.Control 
              type="number" 
              min="1"
              value={peopleCount} 
              onChange={e => setPeopleCount(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="col-md-6">
            <h5>Estimated Cost</h5>
            <p className="mb-1">Flights: €{flightCost}</p>
            <p className="mb-1">Accommodation: €{accCost}</p>
            <h4 className="mt-2">Total: €{totalCost}</h4>
          </div>
          <div className="col-md-6 text-end">
            <h5>Budget Status</h5>
            <h3 className={remaining >= 0 ? "text-success" : "text-danger"}>
              {remaining >= 0 ? `Under Budget: €${remaining}` : `Over Budget: €${Math.abs(remaining)}`}
            </h3>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default BudgetCalculator;
