import React from 'react';
import { Destination } from '../types';
import MapComponent from './MapComponent';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { Form, Row, Col } from 'react-bootstrap';

interface Props {
  destination: Destination;
  onUpdate: (d: Destination) => void;
}

const DestinationView: React.FC<Props> = ({ destination, onUpdate }) => {
  
  const handleBudgetChange = (amount: number) => {
    onUpdate({ ...destination, totalBudget: amount });
  };

  const handleFlightsChange = (flights: any[]) => {
    onUpdate({ ...destination, flights });
  };

  const handleAccChange = (accommodations: any[]) => {
    onUpdate({ ...destination, accommodations });
  };

  return (
    <div>
      <h2 className="mb-3">{destination.name}</h2>
      
      <Row className="mb-4 align-items-center">
        <Col md={6}>
            <Form.Group>
                <Form.Label><strong>Total Project Budget (€)</strong></Form.Label>
                <Form.Control 
                    type="number" 
                    value={destination.totalBudget} 
                    onChange={(e) => handleBudgetChange(Number(e.target.value))}
                />
            </Form.Group>
        </Col>
      </Row>

      <MapComponent 
        destLat={destination.latitude} 
        destLng={destination.longitude} 
        destName={destination.name} 
      />

      <BudgetCalculator 
        flights={destination.flights} 
        accommodations={destination.accommodations} 
        totalBudget={destination.totalBudget}
      />

      <Row>
        <Col lg={6}>
          <FlightManager 
            flights={destination.flights} 
            onChange={handleFlightsChange} 
          />
        </Col>
        <Col lg={6}>
          <AccommodationManager 
            accommodations={destination.accommodations} 
            onChange={handleAccChange} 
          />
        </Col>
      </Row>
    </div>
  );
};

export default DestinationView;
