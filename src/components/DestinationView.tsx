import React from 'react';
import { Destination, PlannerSettings } from '../types';
import MapComponent from './MapComponent';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { Row, Col } from 'react-bootstrap';

interface Props {
  destination: Destination;
  settings: PlannerSettings;
  onUpdate: (d: Destination) => void;
}

const DestinationView: React.FC<Props> = ({ destination, settings, onUpdate }) => {
  
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
                settings={settings}
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
