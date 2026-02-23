import React, { useEffect, useMemo, useState } from 'react';
import { Accommodation, BudgetAttempt, Destination, ExtraCost, Flight, PlannerSettings } from '../types';
import MapComponent from './MapComponent';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { Card, Button, Badge, Form, ButtonGroup } from 'react-bootstrap';
import { FaBed, FaChevronRight, FaPlaneDeparture, FaWallet } from 'react-icons/fa';
import { calculateBudgetSnapshot, formatCurrency } from '../utils/budget';

interface Props {
  destination: Destination;
  settings: PlannerSettings;
  onUpdate: (destinationId: string, updater: (currentDestination: Destination) => Destination) => void;
}

type WorkspaceSection = 'overview' | 'flights' | 'accommodations' | 'budget';

const SECTION_LABELS: Record<WorkspaceSection, string> = {
  overview: 'Overview',
  flights: 'Flights',
  accommodations: 'Stay',
  budget: 'Budget'
};

const DEFAULT_SECTION: WorkspaceSection = 'overview';

const isWorkspaceSection = (value: string): value is WorkspaceSection => {
  return value === 'overview' || value === 'flights' || value === 'accommodations' || value === 'budget';
};

const getCurrentHashSection = (): WorkspaceSection => {
  const hash = window.location.hash.replace('#', '');
  return isWorkspaceSection(hash) ? hash : DEFAULT_SECTION;
};

const DestinationView: React.FC<Props> = ({ destination, settings, onUpdate }) => {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(() => getCurrentHashSection());

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(getCurrentHashSection());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const updateSection = (nextSection: WorkspaceSection) => {
    setActiveSection(nextSection);
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}#${nextSection}`);
  };

  const commitUpdate = (updater: (currentDestination: Destination) => Destination) => {
    onUpdate(destination.id, updater);
  };

  const handleFlightsChange = (flights: Flight[]) => {
    commitUpdate((currentDestination) => {
      const validFlightIds = new Set(flights.map((flight) => flight.id));
      const nextFlightAssignments = Object.entries(currentDestination.budgetEstimator.flightAssignments).reduce<Record<string, number>>((acc, [flightId, count]) => {
        if (validFlightIds.has(flightId)) {
          acc[flightId] = count;
        }
        return acc;
      }, {});
      const nextAttempts = currentDestination.budgetEstimator.attempts.slice(0, 1).map((attempt) => {
        const nextAttemptAssignments = Object.entries(attempt.flightAssignments).reduce<Record<string, number>>((acc, [flightId, count]) => {
          if (validFlightIds.has(flightId)) {
            acc[flightId] = count;
          }
          return acc;
        }, {});
        const nextSnapshot = calculateBudgetSnapshot({
          flights,
          accommodations: currentDestination.accommodations,
          flightAssignments: nextAttemptAssignments,
          selectedAccommodationId: attempt.selectedAccommodationId,
          extraCosts: currentDestination.extraCosts,
          settings
        });

        return {
          ...attempt,
          flightAssignments: nextAttemptAssignments,
          totalCost: nextSnapshot.totalCost,
          remaining: nextSnapshot.remaining,
          perPersonTotal: nextSnapshot.perPersonTotal
        };
      });
      const fixedAttemptId = nextAttempts[0]?.id || '';

      return {
        ...currentDestination,
        flights,
        budgetEstimator: {
          ...currentDestination.budgetEstimator,
          flightAssignments: nextFlightAssignments,
          attempts: nextAttempts,
          fixedAttemptId
        }
      };
    });
  };

  const handleAccChange = (accommodations: Accommodation[]) => {
    commitUpdate((currentDestination) => {
      const selectedAccommodationId = accommodations.some((accommodation) => accommodation.id === currentDestination.budgetEstimator.selectedAccommodationId)
        ? currentDestination.budgetEstimator.selectedAccommodationId
        : '';
      const validAccommodationIds = new Set(accommodations.map((accommodation) => accommodation.id));
      const nextAttempts = currentDestination.budgetEstimator.attempts.slice(0, 1).map((attempt) => {
        const nextAttemptAccommodationId = validAccommodationIds.has(attempt.selectedAccommodationId)
          ? attempt.selectedAccommodationId
          : '';
        const nextSnapshot = calculateBudgetSnapshot({
          flights: currentDestination.flights,
          accommodations,
          flightAssignments: attempt.flightAssignments,
          selectedAccommodationId: nextAttemptAccommodationId,
          extraCosts: currentDestination.extraCosts,
          settings
        });

        return {
          ...attempt,
          selectedAccommodationId: nextAttemptAccommodationId,
          totalCost: nextSnapshot.totalCost,
          remaining: nextSnapshot.remaining,
          perPersonTotal: nextSnapshot.perPersonTotal
        };
      });
      const fixedAttemptId = nextAttempts[0]?.id || '';

      return {
        ...currentDestination,
        accommodations,
        budgetEstimator: {
          ...currentDestination.budgetEstimator,
          selectedAccommodationId,
          attempts: nextAttempts,
          fixedAttemptId
        }
      };
    });
  };

  const handleNotesChange = (notes: string) => {
    commitUpdate((currentDestination) => ({ ...currentDestination, notes }));
  };

  const handleExtraCostsChange = (extraCosts: ExtraCost[]) => {
    commitUpdate((currentDestination) => ({ ...currentDestination, extraCosts }));
  };

  const handleFlightAssignmentsChange = (flightAssignments: Record<string, number>) => {
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      budgetEstimator: {
        ...currentDestination.budgetEstimator,
        flightAssignments
      }
    }));
  };

  const handleSelectedAccommodationChange = (selectedAccommodationId: string) => {
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      budgetEstimator: {
        ...currentDestination.budgetEstimator,
        selectedAccommodationId
      }
    }));
  };

  const handleFlightDraftChange = (flightDraft: Partial<Flight>) => {
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      flightDraft
    }));
  };

  const handleAccommodationDraftChange = (accommodationDraft: Partial<Accommodation>) => {
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      accommodationDraft
    }));
  };

  const handleAttemptsChange = (attempts: BudgetAttempt[]) => {
    const nextAttempts = attempts.slice(0, 1);
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      budgetEstimator: {
        ...currentDestination.budgetEstimator,
        attempts: nextAttempts,
        fixedAttemptId: nextAttempts[0]?.id || ''
      }
    }));
  };

  const handleFixedAttemptIdChange = (fixedAttemptId: string) => {
    commitUpdate((currentDestination) => ({
      ...currentDestination,
      budgetEstimator: {
        ...currentDestination.budgetEstimator,
        fixedAttemptId: fixedAttemptId && currentDestination.budgetEstimator.attempts.some((attempt) => attempt.id === fixedAttemptId)
          ? fixedAttemptId
          : ''
      }
    }));
  };

  const budgetSnapshot = useMemo(() => {
    return calculateBudgetSnapshot({
      flights: destination.flights,
      accommodations: destination.accommodations,
      flightAssignments: destination.budgetEstimator.flightAssignments,
      selectedAccommodationId: destination.budgetEstimator.selectedAccommodationId,
      extraCosts: destination.extraCosts,
      settings
    });
  }, [
    destination.flights,
    destination.accommodations,
    destination.budgetEstimator.flightAssignments,
    destination.budgetEstimator.selectedAccommodationId,
    destination.extraCosts,
    settings
  ]);

  const cheapestFlight = useMemo(() => {
    return [...destination.flights].sort((a, b) => a.pricePerPerson - b.pricePerPerson)[0];
  }, [destination.flights]);

  const cheapestAccommodation = useMemo(() => {
    return [...destination.accommodations].sort((a, b) => a.totalPrice - b.totalPrice)[0];
  }, [destination.accommodations]);

  const selectedAccommodation = destination.accommodations.find((accommodation) => accommodation.id === destination.budgetEstimator.selectedAccommodationId);
  const assignedFlightsSummary = useMemo(() => {
    const assignedFlights = Object.entries(destination.budgetEstimator.flightAssignments)
      .map(([flightId, count]) => ({
        flight: destination.flights.find((flight) => flight.id === flightId),
        count
      }))
      .filter((entry): entry is { flight: Flight; count: number } => Boolean(entry.flight) && entry.count > 0);

    const assignedTravelers = assignedFlights.reduce((total, entry) => total + entry.count, 0);
    const weightedTotal = assignedFlights.reduce((total, entry) => total + (entry.flight.pricePerPerson * entry.count), 0);

    return {
      assignedTravelers,
      optionCount: assignedFlights.length,
      averagePerPerson: assignedTravelers > 0 ? weightedTotal / assignedTravelers : 0
    };
  }, [destination.budgetEstimator.flightAssignments, destination.flights]);

  return (
    <div className="destination-workspace">
      <header className="destination-header">
        <div>
          <h1 className="page-title mb-1">{destination.name}</h1>
          <p className="subtle-text mb-0">
            {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
          </p>
        </div>

        <div className="destination-header-stats">
          <div className="stat-chip" aria-live="polite">
            <span className="stat-chip-label">Total</span>
            <strong>{formatCurrency(budgetSnapshot.totalCost)}</strong>
          </div>
          <div className={`stat-chip ${budgetSnapshot.remaining < 0 ? 'negative' : ''}`} aria-live="polite">
            <span className="stat-chip-label">Remaining</span>
            <strong>{formatCurrency(budgetSnapshot.remaining)}</strong>
          </div>
        </div>
      </header>

      <section className="workspace-nav" aria-label="Destination sections">
        <ButtonGroup aria-label="Destination page sections">
          {(Object.keys(SECTION_LABELS) as WorkspaceSection[]).map((sectionId) => (
            <Button
              key={sectionId}
              variant={activeSection === sectionId ? 'primary' : 'outline-secondary'}
              onClick={() => updateSection(sectionId)}
              aria-current={activeSection === sectionId ? 'page' : undefined}
            >
              {SECTION_LABELS[sectionId]}
            </Button>
          ))}
        </ButtonGroup>
      </section>

      {activeSection === 'overview' && (
        <div className="workspace-grid">
          <Card className="workspace-card">
            <Card.Header className="workspace-card-header">
              <div>
                <h2 className="workspace-card-title">Plan Notes</h2>
                <p className="subtle-text mb-0">Capture constraints, preferences, and approvals.</p>
              </div>
            </Card.Header>
            <Card.Body>
              <Form.Group controlId={`notes-${destination.id}`} className="mb-4">
                <Form.Control
                  as="textarea"
                  rows={10}
                  value={destination.notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="Add planning notes for this destination..."
                  style={{ resize: 'vertical', minHeight: '240px' }}
                />
              </Form.Group>

              <div className="overview-actions">
                <Button variant="outline-secondary" onClick={() => updateSection('flights')} className="d-inline-flex align-items-center gap-2">
                  Add Flights <FaChevronRight size={12} />
                </Button>
                <Button variant="outline-secondary" onClick={() => updateSection('accommodations')} className="d-inline-flex align-items-center gap-2">
                  Add Stay <FaChevronRight size={12} />
                </Button>
                <Button variant="primary" onClick={() => updateSection('budget')} className="d-inline-flex align-items-center gap-2">
                  Review Budget <FaWallet size={12} />
                </Button>
              </div>
            </Card.Body>
          </Card>

          <Card className="workspace-card">
            <Card.Header className="workspace-card-header">
              <div>
                <h2 className="workspace-card-title">Route Map</h2>
                <p className="subtle-text mb-0">Dublin HQ to selected destination.</p>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              <MapComponent
                destLat={destination.latitude}
                destLng={destination.longitude}
                destName={destination.name}
              />
            </Card.Body>
          </Card>

          <Card className="workspace-card">
            <Card.Header className="workspace-card-header d-flex justify-content-between align-items-start gap-3">
              <div>
                <h2 className="workspace-card-title d-flex align-items-center gap-2">
                  <FaPlaneDeparture className="text-primary" /> Flight Comparison
                </h2>
                <p className="subtle-text mb-0">Lowest fare and your active team flight split.</p>
              </div>
              <Button variant="link" className="p-0" onClick={() => updateSection('flights')}>Manage</Button>
            </Card.Header>
            <Card.Body>
              {destination.flights.length === 0 ? (
                <div className="empty-inline-state">No flights added yet.</div>
              ) : (
                <div className="comparison-list">
                  <div className="comparison-item">
                    <div className="comparison-title">Lowest Cost</div>
                    <strong>{cheapestFlight?.description || 'Unnamed flight'}</strong>
                    <span>{formatCurrency(cheapestFlight?.pricePerPerson || 0)} per person</span>
                  </div>
                  <div className="comparison-item">
                    <div className="comparison-title">Current Split</div>
                    <strong>
                      {assignedFlightsSummary.assignedTravelers > 0
                        ? `${assignedFlightsSummary.assignedTravelers} travelers across ${assignedFlightsSummary.optionCount} option${assignedFlightsSummary.optionCount === 1 ? '' : 's'}`
                        : 'No flight allocations yet'}
                    </strong>
                    <span>
                      {assignedFlightsSummary.assignedTravelers > 0
                        ? `${formatCurrency(assignedFlightsSummary.averagePerPerson)} average per person`
                        : 'Assign travelers in Budget to compare mixes'}
                    </span>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="workspace-card">
            <Card.Header className="workspace-card-header d-flex justify-content-between align-items-start gap-3">
              <div>
                <h2 className="workspace-card-title d-flex align-items-center gap-2">
                  <FaBed className="text-primary" /> Stay Comparison
                </h2>
                <p className="subtle-text mb-0">Balance total cost with comfort and location.</p>
              </div>
              <Button variant="link" className="p-0" onClick={() => updateSection('accommodations')}>Manage</Button>
            </Card.Header>
            <Card.Body>
              {destination.accommodations.length === 0 ? (
                <div className="empty-inline-state">No accommodation options added yet.</div>
              ) : (
                <div className="comparison-list">
                  <div className="comparison-item">
                    <div className="comparison-title">Lowest Cost</div>
                    <strong>{cheapestAccommodation?.description || 'Unnamed stay'}</strong>
                    <span>{formatCurrency(cheapestAccommodation?.totalPrice || 0)} total</span>
                  </div>
                  <div className="comparison-item">
                    <div className="comparison-title">Selected For Budget</div>
                    <strong>{selectedAccommodation?.description || 'Not selected yet'}</strong>
                    <span>{formatCurrency(selectedAccommodation?.totalPrice || 0)} total</span>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
      )}

      {activeSection === 'flights' && (
        <section aria-label="Flight management section">
          <FlightManager
            flights={destination.flights}
            onChange={handleFlightsChange}
            draft={destination.flightDraft}
            onDraftChange={handleFlightDraftChange}
          />
        </section>
      )}

      {activeSection === 'accommodations' && (
        <section aria-label="Accommodation management section">
          <AccommodationManager
            accommodations={destination.accommodations}
            onChange={handleAccChange}
            draft={destination.accommodationDraft}
            onDraftChange={handleAccommodationDraftChange}
          />
        </section>
      )}

      {activeSection === 'budget' && (
        <section aria-label="Budget management section">
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
            attempts={destination.budgetEstimator.attempts}
            fixedAttemptId={destination.budgetEstimator.fixedAttemptId}
            onAttemptsChange={handleAttemptsChange}
            onFixedAttemptIdChange={handleFixedAttemptIdChange}
          />
        </section>
      )}

      <section className="workspace-footer-note">
        <Badge bg="light" text="dark">
          Team size: {settings.peopleCount}
        </Badge>
      </section>
    </div>
  );
};

export default DestinationView;
