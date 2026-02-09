import React from 'react';
import { Accommodation, Destination, ExtraCost, Flight, PlannerSettings } from '../types';
import MapComponent from './MapComponent';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { Row, Col, Card, Form } from 'react-bootstrap';

interface Props {
  destination: Destination;
  settings: PlannerSettings;
  onUpdate: (d: Destination) => void;
}

const DestinationView: React.FC<Props> = ({ destination, settings, onUpdate }) => {
  
  const handleFlightsChange = (flights: Flight[]) => {
    const validFlightIds = new Set(flights.map((flight) => flight.id));
    const nextFlightAssignments = Object.entries(destination.budgetEstimator.flightAssignments).reduce<Record<string, number>>((acc, [flightId, count]) => {
      if (validFlightIds.has(flightId)) {
        acc[flightId] = count;
      }
      return acc;
    }, {});

    onUpdate({
      ...destination,
      flights,
      budgetEstimator: {
        ...destination.budgetEstimator,
        flightAssignments: nextFlightAssignments
      }
    });
  };

  const handleAccChange = (accommodations: Accommodation[]) => {
    const selectedAccommodationId = accommodations.some((accommodation) => accommodation.id === destination.budgetEstimator.selectedAccommodationId)
      ? destination.budgetEstimator.selectedAccommodationId
      : '';

    onUpdate({
      ...destination,
      accommodations,
      budgetEstimator: {
        ...destination.budgetEstimator,
        selectedAccommodationId
      }
    });
  };

  const handleNotesChange = (notes: string) => {
    onUpdate({ ...destination, notes });
  };

  const handleExtraCostsChange = (extraCosts: ExtraCost[]) => {
    onUpdate({ ...destination, extraCosts });
  };

  const handleFlightAssignmentsChange = (flightAssignments: Record<string, number>) => {
    onUpdate({
      ...destination,
      budgetEstimator: {
        ...destination.budgetEstimator,
        flightAssignments
      }
    });
  };

  const handleSelectedAccommodationChange = (selectedAccommodationId: string) => {
    onUpdate({
      ...destination,
      budgetEstimator: {
        ...destination.budgetEstimator,
        selectedAccommodationId
      }
    });
  };

  const handleFlightDraftChange = (flightDraft: Partial<Flight>) => {
    onUpdate({
      ...destination,
      flightDraft
    });
  };

  const handleAccommodationDraftChange = (accommodationDraft: Partial<Accommodation>) => {
    onUpdate({
      ...destination,
      accommodationDraft
    });
  };

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="display-6 fw-bold mb-0 text-primary">{destination.name}</h2>
      </div>

      <Row className="mb-4 g-4">
        <Col xs={12} lg={6}>
          <Card className="h-100 border-0 shadow-sm">
            <Card.Body>
              <Form.Group controlId={`notes-${destination.id}`}>
                <Form.Label className="fw-semibold mb-2">Notes</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={10}
                  value={destination.notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Add planning notes for this destination..."
                  style={{ resize: 'vertical', minHeight: '300px' }}
                />
              </Form.Group>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
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
                extraCosts={destination.extraCosts}
                onExtraCostsChange={handleExtraCostsChange}
                flightAssignments={destination.budgetEstimator.flightAssignments}
                onFlightAssignmentsChange={handleFlightAssignmentsChange}
                selectedAccommodationId={destination.budgetEstimator.selectedAccommodationId}
                onSelectedAccommodationChange={handleSelectedAccommodationChange}
            />
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <FlightManager 
            flights={destination.flights} 
            onChange={handleFlightsChange} 
            draft={destination.flightDraft}
            onDraftChange={handleFlightDraftChange}
          />
        </Col>
        <Col lg={6}>
          <AccommodationManager 
            accommodations={destination.accommodations} 
            onChange={handleAccChange} 
            draft={destination.accommodationDraft}
            onDraftChange={handleAccommodationDraftChange}
          />
        </Col>
      </Row>
    </div>
  );
};

export default DestinationView;
