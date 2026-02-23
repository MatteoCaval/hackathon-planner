import { useEffect, useState } from 'react';
import { Button, Container, Form, InputGroup, Navbar } from 'react-bootstrap';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import PersistentBudgetStatus from './components/PersistentBudgetStatus';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetAttempt, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings } from './types';
import { FaPlane, FaPlus, FaUsers, FaWallet } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'leaflet/dist/leaflet.css';

type LegacyExtraCost = { description?: unknown; value?: unknown };
type LegacyBudgetAttempt = {
  id?: unknown;
  name?: unknown;
  createdAt?: unknown;
  flightAssignments?: unknown;
  selectedAccommodationId?: unknown;
  totalCost?: unknown;
  remaining?: unknown;
  perPersonTotal?: unknown;
};
type LegacyBudgetEstimator = {
  flightAssignments?: unknown;
  selectedAccommodationId?: unknown;
  fixedAttemptId?: unknown;
  attempts?: unknown;
};
type LegacyDestination = Omit<Destination, 'notes' | 'extraCosts' | 'budgetEstimator' | 'flightDraft' | 'accommodationDraft'> & {
  notes?: unknown;
  extraCosts?: unknown;
  budgetEstimator?: unknown;
  flightDraft?: unknown;
  accommodationDraft?: unknown;
};

const DEFAULT_SETTINGS: PlannerSettings = { totalBudget: 5000, peopleCount: 5 };

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

const normalizeBudgetAttempts = (attempts: unknown): BudgetAttempt[] => {
  if (!Array.isArray(attempts)) {
    return [];
  }

  return attempts
    .map((attempt) => {
      if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
        return null;
      }

      const typedAttempt = attempt as LegacyBudgetAttempt;
      const createdAt = typeof typedAttempt.createdAt === 'number' && Number.isFinite(typedAttempt.createdAt)
        ? typedAttempt.createdAt
        : Date.now();
      const totalCost = typeof typedAttempt.totalCost === 'number' && Number.isFinite(typedAttempt.totalCost)
        ? typedAttempt.totalCost
        : 0;
      const remaining = typeof typedAttempt.remaining === 'number' && Number.isFinite(typedAttempt.remaining)
        ? typedAttempt.remaining
        : 0;
      const perPersonTotal = typeof typedAttempt.perPersonTotal === 'number' && Number.isFinite(typedAttempt.perPersonTotal)
        ? typedAttempt.perPersonTotal
        : 0;

      return {
        id: typeof typedAttempt.id === 'string' && typedAttempt.id.trim() ? typedAttempt.id : `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        name: typeof typedAttempt.name === 'string' && typedAttempt.name.trim() ? typedAttempt.name : 'Saved attempt',
        createdAt,
        flightAssignments: normalizeFlightAssignments(typedAttempt.flightAssignments),
        selectedAccommodationId: typeof typedAttempt.selectedAccommodationId === 'string' ? typedAttempt.selectedAccommodationId : '',
        totalCost,
        remaining,
        perPersonTotal
      };
    })
    .filter((attempt): attempt is BudgetAttempt => attempt !== null)
    .slice(0, 40);
};

const hasInvalidBudgetAttempts = (attempts: unknown): boolean => {
  if (!Array.isArray(attempts)) {
    return true;
  }

  if (attempts.length > 1) {
    return true;
  }

  return attempts.some((attempt) => {
    if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
      return true;
    }

    const typedAttempt = attempt as LegacyBudgetAttempt;
    return (
      typeof typedAttempt.id !== 'string' ||
      typeof typedAttempt.name !== 'string' ||
      typeof typedAttempt.createdAt !== 'number' ||
      !Number.isFinite(typedAttempt.createdAt) ||
      typeof typedAttempt.selectedAccommodationId !== 'string' ||
      hasInvalidFlightAssignments(typedAttempt.flightAssignments) ||
      typeof typedAttempt.totalCost !== 'number' ||
      !Number.isFinite(typedAttempt.totalCost) ||
      typeof typedAttempt.remaining !== 'number' ||
      !Number.isFinite(typedAttempt.remaining) ||
      typeof typedAttempt.perPersonTotal !== 'number' ||
      !Number.isFinite(typedAttempt.perPersonTotal)
    );
  });
};

const normalizeBudgetEstimator = (budgetEstimator: unknown): BudgetEstimatorState => {
  const typedBudgetEstimator = budgetEstimator as LegacyBudgetEstimator | undefined;
  const attempts = normalizeBudgetAttempts(typedBudgetEstimator?.attempts);
  const fixedAttemptId = typeof typedBudgetEstimator?.fixedAttemptId === 'string' ? typedBudgetEstimator.fixedAttemptId : '';
  const preferredAttempt = attempts.find((attempt) => attempt.id === fixedAttemptId) ?? attempts[0];
  const normalizedAttempts = preferredAttempt ? [preferredAttempt] : [];
  const normalizedFixedAttemptId = normalizedAttempts[0]?.id || '';

  return {
    flightAssignments: normalizeFlightAssignments(typedBudgetEstimator?.flightAssignments),
    selectedAccommodationId: typeof typedBudgetEstimator?.selectedAccommodationId === 'string' ? typedBudgetEstimator.selectedAccommodationId : '',
    fixedAttemptId: normalizedFixedAttemptId,
    attempts: normalizedAttempts
  };
};

const hasInvalidBudgetEstimator = (budgetEstimator: unknown): boolean => {
  if (!budgetEstimator || typeof budgetEstimator !== 'object' || Array.isArray(budgetEstimator)) {
    return true;
  }

  const typedBudgetEstimator = budgetEstimator as LegacyBudgetEstimator & Record<string, unknown>;
  return (
    'changeHistory' in typedBudgetEstimator ||
    typeof typedBudgetEstimator.selectedAccommodationId !== 'string' ||
    hasInvalidFlightAssignments(typedBudgetEstimator.flightAssignments) ||
    typeof typedBudgetEstimator.fixedAttemptId !== 'string' ||
    hasInvalidBudgetAttempts(typedBudgetEstimator.attempts)
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
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!activeId && destinations.length > 0) {
      setActiveId(destinations[0].id);
    }
  }, [destinations, activeId]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const stillExists = destinations.some((destination) => destination.id === activeId);
    if (!stillExists) {
      setActiveId(destinations.length > 0 ? destinations[0].id : null);
    }
  }, [destinations, activeId]);

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
  }, [destinations, setDestinations]);

  const activeDestination = destinations.find((destination) => destination.id === activeId);

  const handleUpdateDestination = (destinationId: string, updater: (currentDestination: Destination) => Destination) => {
    setDestinations((previousDestinations) =>
      previousDestinations.map((destination) => (
        destination.id === destinationId ? updater(destination) : destination
      ))
    );
  };

  const handleAddDestination = (newDest: Destination) => {
    const destination = normalizeDestination(newDest);
    setDestinations([...destinations, destination]);
    setActiveId(newDest.id);
  };

  const handleRemoveDestination = (id: string) => {
    const newDestinations = destinations.filter((destination) => destination.id !== id);
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

  const handleTotalBudgetChange = (value: string) => {
    const parsed = Number(value);
    setSettings((previousSettings) => ({
      ...previousSettings,
      totalBudget: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }));
  };

  const handlePeopleCountChange = (value: string) => {
    const parsed = Number(value);
    setSettings((previousSettings) => ({
      ...previousSettings,
      peopleCount: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
    }));
  };

  return (
    <div className="app-shell d-flex flex-column">
      <Navbar className="app-topbar flex-shrink-0 z-3 py-2">
        <Container fluid className="px-4">
          <div className="topbar-grid">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Navbar.Brand className="app-brand d-flex align-items-center gap-2 m-0">
                <div className="app-brand-icon" aria-hidden="true">
                  <FaPlane size={16} />
                </div>
                <div>
                  <span>Hackathon Planner</span>
                  <div className="brand-subtitle">Team trip planning</div>
                </div>
              </Navbar.Brand>

              <div className="settings-cluster d-flex align-items-center gap-2 flex-wrap">
                <InputGroup size="sm" style={{ width: '180px' }}>
                  <InputGroup.Text><FaWallet /></InputGroup.Text>
                  <Form.Control
                    type="number"
                    step="10"
                    min="0"
                    placeholder="Total budget"
                    aria-label="Total budget"
                    value={settings.totalBudget}
                    onChange={(e) => handleTotalBudgetChange(e.target.value)}
                  />
                </InputGroup>

                <InputGroup size="sm" style={{ width: '140px' }}>
                  <InputGroup.Text><FaUsers /></InputGroup.Text>
                  <Form.Control
                    type="number"
                    min="1"
                    placeholder="People"
                    aria-label="People count"
                    value={settings.peopleCount}
                    onChange={(e) => handlePeopleCountChange(e.target.value)}
                  />
                </InputGroup>
              </div>
            </div>

            <div className="topbar-actions d-flex align-items-center justify-content-end gap-3 flex-wrap">
              <section className="live-share-panel d-flex flex-column" aria-label="Live collaboration status">
                <div className="d-flex align-items-center gap-2">
                  <strong className="small">Trip Share</strong>
                  <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">Coming Soon</span>
                </div>
                <div className="inline-status warning" role="status" aria-live="polite">
                  Live collaborative trip sharing is temporarily disabled while stability improvements are in progress.
                </div>
              </section>

              <DataPersistence destinations={destinations} onImport={handleImport} />
            </div>
          </div>
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

        <div className="workspace-pane flex-grow-1 d-flex flex-column overflow-hidden">
          <PersistentBudgetStatus destination={activeDestination} settings={settings} />

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
                  <h3 className="fw-semibold mb-2">Start a trip workspace</h3>
                  <p className="subtle-text mb-4">Create a destination, add flights and stay options, then lock your budget.</p>
                  <Button variant="primary" size="lg" onClick={() => setShowAddModal(true)}>
                    <FaPlus className="me-2" /> Add Destination
                  </Button>
                </div>
              </section>
            )}
          </main>
        </div>
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
