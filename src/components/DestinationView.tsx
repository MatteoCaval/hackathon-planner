import React from 'react';
import { Destination } from '../types';
import MapComponent from './MapComponent';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { Form, Row, Col, InputGroup } from 'react-bootstrap';
import { FaWallet } from 'react-icons/fa';

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
    <div className="container-fluid px-4 py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="display-6 fw-bold mb-0 text-primary">{destination.name}</h2>
        
        <div style={{ width: '300px' }}>
            <InputGroup>
                <InputGroup.Text className="bg-white border-end-0 text-primary">
                    <FaWallet />
                </InputGroup.Text>
                <Form.Control 
                    type="number" 
                    className="border-start-0 fw-bold text-end"
                    value={destination.totalBudget} 
                    onChange={(e) => handleBudgetChange(Number(e.target.value))}
                />
                <InputGroup.Text className="bg-light">TOTAL BUDGET</InputGroup.Text>
            </InputGroup>
        </div>
      </div>

      <Row className="mb-4">
        <Col xs={12}>
             <MapComponent 
                destLat={destination.latitude} 
                destLng={destination.longitude} 
                destName={destination.name} 
            />
        </Col>
      </Row>

      <Row className="mb-4">
        <Col xs={12}>
            <BudgetCalculator 
                flights={destination.flights} 
                accommodations={destination.accommodations} 
                totalBudget={destination.totalBudget}
            />
        </Col>
      </Row>

      <Row className="g-4">
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
