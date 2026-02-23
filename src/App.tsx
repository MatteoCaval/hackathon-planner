import { useState, useEffect } from 'react';
import { Container, Navbar, Button, Form, InputGroup } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings } from './types';
import { FaPlane, FaPlus, FaUsers, FaWallet } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

type LegacyExtraCost = { description?: unknown; value?: unknown };
type LegacyBudgetEstimator = { flightAssignments?: unknown; selectedAccommodationId?: unknown };
type LegacyDestination = Omit<Destination, 'notes' | 'extraCosts' | 'budgetEstimator' | 'flightDraft' | 'accommodationDraft'> & {
  notes?: unknown;
  extraCosts?: unknown;
  budgetEstimator?: unknown;
  flightDraft?: unknown;
  accommodationDraft?: unknown;
};

const normalizeExtraCosts = (extraCosts: unknown): ExtraCost[] => {
  if (typeof extraCosts === 'number') {
    return Number.isFinite(extraCosts) && extraCosts > 0
      ? [{ description: 'General extra cost', value: extraCosts }]
      : [];
  }

  if (!Array.isArray(extraCosts)) {
    return [];
  }

  return extraCosts
    .map((extraCost) => {
      const typedExtraCost = extraCost as LegacyExtraCost;
      const description = typeof typedExtraCost.description === 'string' ? typedExtraCost.description : '';
      const parsedValue = typedExtraCost.value;
      const value = typeof parsedValue === 'number' && Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;

      return { description, value };
    })
    .filter((extraCost) => extraCost.description.trim() || extraCost.value > 0);
};

const hasInvalidExtraCosts = (extraCosts: unknown): boolean => {
  if (!Array.isArray(extraCosts)) {
    return true;
  }

  return extraCosts.some((extraCost) => {
    const typedExtraCost = extraCost as LegacyExtraCost;
    return (
      typeof typedExtraCost.description !== 'string' ||
      typeof typedExtraCost.value !== 'number' ||
      !Number.isFinite(typedExtraCost.value) ||
      typedExtraCost.value < 0
    );
  });
};

const normalizeFlightAssignments = (flightAssignments: unknown): Record<string, number> => {
  if (!flightAssignments || typeof flightAssignments !== 'object' || Array.isArray(flightAssignments)) {
    return {};
  }

  return Object.entries(flightAssignments as Record<string, unknown>).reduce<Record<string, number>>((acc, [flightId, count]) => {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      acc[flightId] = Math.floor(count);
    }
    return acc;
  }, {});
};

const hasInvalidFlightAssignments = (flightAssignments: unknown): boolean => {
  if (!flightAssignments || typeof flightAssignments !== 'object' || Array.isArray(flightAssignments)) {
    return true;
  }

  return Object.values(flightAssignments as Record<string, unknown>).some((count) => {
    return typeof count !== 'number' || !Number.isFinite(count) || count < 0;
  });
};

const normalizeBudgetEstimator = (budgetEstimator: unknown): BudgetEstimatorState => {
  const typedBudgetEstimator = budgetEstimator as LegacyBudgetEstimator | undefined;
  return {
    flightAssignments: normalizeFlightAssignments(typedBudgetEstimator?.flightAssignments),
    selectedAccommodationId: typeof typedBudgetEstimator?.selectedAccommodationId === 'string' ? typedBudgetEstimator.selectedAccommodationId : ''
  };
};

const hasInvalidBudgetEstimator = (budgetEstimator: unknown): boolean => {
  if (!budgetEstimator || typeof budgetEstimator !== 'object' || Array.isArray(budgetEstimator)) {
    return true;
  }

  const typedBudgetEstimator = budgetEstimator as LegacyBudgetEstimator;
  return (
    typeof typedBudgetEstimator.selectedAccommodationId !== 'string' ||
    hasInvalidFlightAssignments(typedBudgetEstimator.flightAssignments)
  );
};

const normalizeFlightDraft = (flightDraft: unknown): Partial<Flight> => {
  if (!flightDraft || typeof flightDraft !== 'object' || Array.isArray(flightDraft)) {
    return {};
  }

  const typedDraft = flightDraft as Record<string, unknown>;
  const normalizedDraft: Partial<Flight> = {};

  if (typeof typedDraft.link === 'string') normalizedDraft.link = typedDraft.link;
  if (typeof typedDraft.description === 'string') normalizedDraft.description = typedDraft.description;
  if (typeof typedDraft.startDate === 'string') normalizedDraft.startDate = typedDraft.startDate;
  if (typeof typedDraft.endDate === 'string') normalizedDraft.endDate = typedDraft.endDate;
  if (typeof typedDraft.pricePerPerson === 'number' && Number.isFinite(typedDraft.pricePerPerson) && typedDraft.pricePerPerson >= 0) {
    normalizedDraft.pricePerPerson = typedDraft.pricePerPerson;
  }

  return normalizedDraft;
};

const normalizeAccommodationDraft = (accommodationDraft: unknown): Partial<Accommodation> => {
  if (!accommodationDraft || typeof accommodationDraft !== 'object' || Array.isArray(accommodationDraft)) {
    return {};
  }

  const typedDraft = accommodationDraft as Record<string, unknown>;
  const normalizedDraft: Partial<Accommodation> = {};

  if (typeof typedDraft.link === 'string') normalizedDraft.link = typedDraft.link;
  if (typeof typedDraft.description === 'string') normalizedDraft.description = typedDraft.description;
  if (typeof typedDraft.startDate === 'string') normalizedDraft.startDate = typedDraft.startDate;
  if (typeof typedDraft.endDate === 'string') normalizedDraft.endDate = typedDraft.endDate;
  if (typeof typedDraft.totalPrice === 'number' && Number.isFinite(typedDraft.totalPrice) && typedDraft.totalPrice >= 0) {
    normalizedDraft.totalPrice = typedDraft.totalPrice;
  }

  return normalizedDraft;
};

const hasInvalidFlightDraft = (flightDraft: unknown): boolean => {
  if (!flightDraft || typeof flightDraft !== 'object' || Array.isArray(flightDraft)) {
    return true;
  }

  const typedDraft = flightDraft as Record<string, unknown>;
  return Object.entries(typedDraft).some(([key, value]) => {
    if (key === 'pricePerPerson') {
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    }
    if (key === 'link' || key === 'description' || key === 'startDate' || key === 'endDate') {
      return typeof value !== 'string';
    }
    return true;
  });
};

const hasInvalidAccommodationDraft = (accommodationDraft: unknown): boolean => {
  if (!accommodationDraft || typeof accommodationDraft !== 'object' || Array.isArray(accommodationDraft)) {
    return true;
  }

  const typedDraft = accommodationDraft as Record<string, unknown>;
  return Object.entries(typedDraft).some(([key, value]) => {
    if (key === 'totalPrice') {
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    }
    if (key === 'link' || key === 'description' || key === 'startDate' || key === 'endDate') {
      return typeof value !== 'string';
    }
    return true;
  });
};

const normalizeDestination = (destination: LegacyDestination): Destination => ({
  ...destination,
  notes: typeof destination.notes === 'string' ? destination.notes : '',
  extraCosts: normalizeExtraCosts(destination.extraCosts),
  budgetEstimator: normalizeBudgetEstimator(destination.budgetEstimator),
  flightDraft: normalizeFlightDraft(destination.flightDraft),
  accommodationDraft: normalizeAccommodationDraft(destination.accommodationDraft)
});

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', { totalBudget: 5000, peopleCount: 5 });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Auto-select first if none selected and list not empty
  useEffect(() => {
    if (!activeId && destinations.length > 0) {
      setActiveId(destinations[0].id);
    }
  }, [destinations, activeId]);

  // Backfill fields for data created before new destination fields were added.
  useEffect(() => {
    const hasMissingFields = destinations.some((destination) => {
      const legacyDestination = destination as LegacyDestination;
      return (
        typeof legacyDestination.notes !== 'string' ||
        hasInvalidExtraCosts(legacyDestination.extraCosts) ||
        hasInvalidBudgetEstimator(legacyDestination.budgetEstimator) ||
        hasInvalidFlightDraft(legacyDestination.flightDraft) ||
        hasInvalidAccommodationDraft(legacyDestination.accommodationDraft)
      );
    });
    if (hasMissingFields) {
      setDestinations(destinations.map((destination) => normalizeDestination(destination as LegacyDestination)));
    }
  }, [destinations]);

  const activeDestination = destinations.find(d => d.id === activeId);

  const handleUpdateDestination = (updatedDest: Destination) => {
    setDestinations(destinations.map(d => d.id === updatedDest.id ? updatedDest : d));
  };

  const handleAddDestination = (newDest: Destination) => {
    // Ensure no legacy budget is attached if type is strict, though local var is fine
    const { ...dest } = normalizeDestination(newDest); 
    setDestinations([...destinations, dest]);
    setActiveId(newDest.id);
  };

  const handleRemoveDestination = (id: string) => {
      const newDestinations = destinations.filter(d => d.id !== id);
      setDestinations(newDestinations);
      if (activeId === id) {
          setActiveId(newDestinations.length > 0 ? newDestinations[0].id : null);
      }
  };

  const handleImport = (data: Destination[]) => {
    const normalizedData = data.map((destination) => normalizeDestination(destination as LegacyDestination));
    setDestinations(normalizedData);
    if (normalizedData.length > 0) {
        setActiveId(normalizedData[0].id);
    }
  };

  return (
    <div className="app-shell d-flex flex-column">
      <Navbar className="app-topbar flex-shrink-0 z-3 py-2">
        <Container fluid className="px-4">
          <Navbar.Brand className="app-brand d-flex align-items-center gap-2 me-4">
             <div className="app-brand-icon" aria-hidden="true">
                <FaPlane size={18} />
             </div>
             <span>Hackathon Planner</span>
          </Navbar.Brand>

          <div className="settings-cluster d-flex align-items-center gap-3 flex-wrap me-auto">
            <InputGroup size="sm" style={{ width: '170px' }}>
                <InputGroup.Text className="bg-light text-muted border-end-0"><FaWallet /></InputGroup.Text>
                <Form.Control 
                    type="number" 
                    step="10"
                    className="border-start-0"
                    placeholder="Budget"
                    aria-label="Total budget"
                    value={settings.totalBudget}
                    onChange={(e) => setSettings({...settings, totalBudget: Number(e.target.value)})}
                />
            </InputGroup>
            
            <InputGroup size="sm" style={{ width: '130px' }}>
                <InputGroup.Text className="bg-light text-muted border-end-0"><FaUsers /></InputGroup.Text>
                <Form.Control 
                    type="number" 
                    className="border-start-0"
                    placeholder="Ppl"
                    aria-label="People count"
                    value={settings.peopleCount}
                    onChange={(e) => setSettings({...settings, peopleCount: Number(e.target.value)})}
                />
            </InputGroup>
          </div>
          
          <DataPersistence destinations={destinations} onImport={handleImport} />
        </Container>
      </Navbar>
      
      <div className="app-main d-flex flex-grow-1 overflow-hidden">
        <Sidebar 
          destinations={destinations} 
          activeId={activeId} 
          onSelect={setActiveId} 
          onAddClick={() => setShowAddModal(true)}
          onRemove={handleRemoveDestination}
        />
        
        <main className="app-content flex-grow-1 overflow-auto position-relative" aria-live="polite">
          {activeDestination ? (
            <DestinationView 
              destination={activeDestination} 
              onUpdate={handleUpdateDestination}
              settings={settings}
            />
          ) : (
            <section className="empty-state" aria-label="No destination selected">
              <div>
              <div className="empty-state-icon">
                 <FaPlane size={36} />
              </div>
              <h3 className="fw-semibold mb-2">Ready for takeoff?</h3>
              <p className="subtle-text mb-4">Select or add a destination from the sidebar to start planning.</p>
              <Button variant="primary" size="lg" onClick={() => setShowAddModal(true)}>
                <FaPlus className="me-2" /> Start Planning
              </Button>
              </div>
            </section>
          )}
        </main>
      </div>

      <AddDestinationModal 
        show={showAddModal} 
        onHide={() => setShowAddModal(false)} 
        onAdd={handleAddDestination} 
      />
    </div>
  );
}

export default App;
