import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Navbar, Button, Form, InputGroup } from 'react-bootstrap';
import { get, onValue, ref, set } from 'firebase/database';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings } from './types';
import { FaCopy, FaLink, FaPlane, FaPlus, FaPowerOff, FaUsers, FaWallet } from 'react-icons/fa';
import { firebaseDatabase, isFirebaseConfigured } from './firebase';
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

type TripSyncStatus = 'disabled' | 'idle' | 'connecting' | 'connected' | 'error';

type TripPayload = {
  destinations: unknown;
  settings: unknown;
  meta?: {
    updatedAt?: unknown;
    updatedBy?: unknown;
  };
};

type ParsedTripPayload = {
  destinations: Destination[];
  settings: PlannerSettings;
  meta: {
    updatedAt: number | null;
    updatedBy: string | null;
  };
};

const TRIP_CODE_LENGTH = 8;
const TRIP_CODE_MIN_LENGTH = 6;
const TRIP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TRIP_CONNECT_TIMEOUT_MS = 8000;
const TRIP_CONNECT_TIMEOUT_ERROR = 'trip-connect-timeout';
const DEFAULT_SETTINGS: PlannerSettings = { totalBudget: 5000, peopleCount: 5 };

const normalizeTripCode = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TRIP_CODE_LENGTH);

const generateTripCode = (): string => {
  let code = '';
  for (let i = 0; i < TRIP_CODE_LENGTH; i += 1) {
    const randomIndex = Math.floor(Math.random() * TRIP_CODE_ALPHABET.length);
    code += TRIP_CODE_ALPHABET[randomIndex];
  }
  return code;
};

const getOrCreateClientId = (): string => {
  const key = 'hackathon-live-client-id';
  const existingValue = window.localStorage.getItem(key);

  if (existingValue) {
    return existingValue;
  }

  const newId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `client-${Math.random().toString(36).slice(2, 12)}`;

  window.localStorage.setItem(key, newId);
  return newId;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(TRIP_CONNECT_TIMEOUT_ERROR));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

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

const normalizeSettings = (candidate: unknown, fallback: PlannerSettings): PlannerSettings => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return fallback;
  }

  const parsed = candidate as Record<string, unknown>;
  const totalBudget = typeof parsed.totalBudget === 'number' && Number.isFinite(parsed.totalBudget) && parsed.totalBudget >= 0
    ? parsed.totalBudget
    : fallback.totalBudget;
  const peopleCount = typeof parsed.peopleCount === 'number' && Number.isFinite(parsed.peopleCount) && parsed.peopleCount > 0
    ? Math.floor(parsed.peopleCount)
    : fallback.peopleCount;

  return { totalBudget, peopleCount };
};

const parseTripPayload = (payload: unknown, fallbackSettings: PlannerSettings): ParsedTripPayload | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const typedPayload = payload as TripPayload;
  if (!Array.isArray(typedPayload.destinations)) {
    return null;
  }

  const destinations = typedPayload.destinations
    .filter((destination): destination is LegacyDestination => {
      if (!destination || typeof destination !== 'object' || Array.isArray(destination)) {
        return false;
      }

      const typedDestination = destination as Record<string, unknown>;
      return (
        typeof typedDestination.id === 'string' &&
        typeof typedDestination.name === 'string' &&
        typeof typedDestination.latitude === 'number' &&
        Number.isFinite(typedDestination.latitude) &&
        typeof typedDestination.longitude === 'number' &&
        Number.isFinite(typedDestination.longitude) &&
        Array.isArray(typedDestination.flights) &&
        Array.isArray(typedDestination.accommodations)
      );
    })
    .map((destination) => normalizeDestination(destination));

  const meta = typedPayload.meta;
  return {
    destinations,
    settings: normalizeSettings(typedPayload.settings, fallbackSettings),
    meta: {
      updatedAt: typeof meta?.updatedAt === 'number' && Number.isFinite(meta.updatedAt) ? meta.updatedAt : null,
      updatedBy: typeof meta?.updatedBy === 'string' ? meta.updatedBy : null
    }
  };
};

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTripCode, setActiveTripCode] = useLocalStorage<string | null>('hackathon-live-trip-code', null);
  const [tripCodeInput, setTripCodeInput] = useState(() => normalizeTripCode(activeTripCode ?? ''));
  const [syncStatus, setSyncStatus] = useState<TripSyncStatus>(isFirebaseConfigured ? 'idle' : 'disabled');
  const [syncMessage, setSyncMessage] = useState(
    isFirebaseConfigured
      ? 'Live share is off. Join a trip code to collaborate.'
      : 'Live share disabled. Set Firebase env vars to enable it.'
  );

  const clientIdRef = useRef<string>(getOrCreateClientId());
  const skipNextPushRef = useRef(false);
  const hasReceivedInitialSnapshotRef = useRef(false);
  const lastLocalWriteAtRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Auto-select first if none selected and list not empty.
  useEffect(() => {
    if (!activeId && destinations.length > 0) {
      setActiveId(destinations[0].id);
    }
  }, [destinations, activeId]);

  // Keep active selection valid when data changes from imports or live sync.
  useEffect(() => {
    if (!activeId) {
      return;
    }

    const stillExists = destinations.some((destination) => destination.id === activeId);
    if (!stillExists) {
      setActiveId(destinations.length > 0 ? destinations[0].id : null);
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
  }, [destinations, setDestinations]);

  const writeTripSnapshot = useCallback(async (tripCode: string, nextDestinations: Destination[], nextSettings: PlannerSettings) => {
    if (!firebaseDatabase) {
      return;
    }

    const updatedAt = Date.now();
    lastLocalWriteAtRef.current = updatedAt;

    await set(ref(firebaseDatabase, `trips/${tripCode}`), {
      destinations: nextDestinations,
      settings: nextSettings,
      meta: {
        updatedAt,
        updatedBy: clientIdRef.current
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseDatabase || !activeTripCode) {
      return;
    }

    hasReceivedInitialSnapshotRef.current = false;
    const tripRef = ref(firebaseDatabase, `trips/${activeTripCode}`);

    const unsubscribe = onValue(
      tripRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          hasReceivedInitialSnapshotRef.current = true;
          return;
        }

        const parsedPayload = parseTripPayload(snapshot.val(), settingsRef.current);
        if (!parsedPayload) {
          setSyncStatus('error');
          setSyncMessage(`Trip ${activeTripCode} contains invalid data.`);
          hasReceivedInitialSnapshotRef.current = true;
          return;
        }

        hasReceivedInitialSnapshotRef.current = true;

        if (
          parsedPayload.meta.updatedBy === clientIdRef.current &&
          parsedPayload.meta.updatedAt !== null &&
          parsedPayload.meta.updatedAt === lastLocalWriteAtRef.current
        ) {
          return;
        }

        skipNextPushRef.current = true;
        setDestinations(parsedPayload.destinations);
        setSettings(parsedPayload.settings);
        setSyncStatus('connected');
        setSyncMessage(`Live sync active on trip ${activeTripCode}.`);
      },
      () => {
        setSyncStatus('error');
        setSyncMessage('Lost connection to Firebase. Check your project config/rules.');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeTripCode, setDestinations, setSettings]);

  useEffect(() => {
    if (!firebaseDatabase || !activeTripCode) {
      return;
    }

    if (!hasReceivedInitialSnapshotRef.current) {
      return;
    }

    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void writeTripSnapshot(activeTripCode, destinations, settings).catch(() => {
        setSyncStatus('error');
        setSyncMessage('Failed to sync your latest changes.');
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTripCode, destinations, settings, writeTripSnapshot]);

  const activeDestination = destinations.find((destination) => destination.id === activeId);

  const handleUpdateDestination = (updatedDest: Destination) => {
    setDestinations(destinations.map((destination) => destination.id === updatedDest.id ? updatedDest : destination));
  };

  const handleAddDestination = (newDest: Destination) => {
    const { ...destination } = normalizeDestination(newDest);
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

  const handleJoinOrCreateTrip = async () => {
    if (!firebaseDatabase || !isFirebaseConfigured) {
      setSyncStatus('disabled');
      setSyncMessage('Firebase is not configured. Add VITE_FIREBASE_* env vars.');
      return;
    }

    const candidateCode = normalizeTripCode(tripCodeInput);
    const nextTripCode = candidateCode || generateTripCode();

    if (nextTripCode.length < TRIP_CODE_MIN_LENGTH) {
      setSyncStatus('error');
      setSyncMessage(`Trip code must be at least ${TRIP_CODE_MIN_LENGTH} characters.`);
      return;
    }

    setSyncStatus('connecting');
    setSyncMessage(`Connecting to trip ${nextTripCode}...`);

    try {
      const tripRef = ref(firebaseDatabase, `trips/${nextTripCode}`);
      const snapshot = await withTimeout(get(tripRef), TRIP_CONNECT_TIMEOUT_MS);

      if (snapshot.exists()) {
        const parsedPayload = parseTripPayload(snapshot.val(), settings);
        if (!parsedPayload) {
          setSyncStatus('error');
          setSyncMessage('Unable to join. Trip payload is invalid.');
          return;
        }

        skipNextPushRef.current = true;
        setDestinations(parsedPayload.destinations);
        setSettings(parsedPayload.settings);
        setActiveId((previousActiveId) => {
          if (previousActiveId && parsedPayload.destinations.some((destination) => destination.id === previousActiveId)) {
            return previousActiveId;
          }

          return parsedPayload.destinations.length > 0 ? parsedPayload.destinations[0].id : null;
        });

        setSyncMessage(`Joined trip ${nextTripCode}.`);
      } else {
        await withTimeout(writeTripSnapshot(nextTripCode, destinations, settings), TRIP_CONNECT_TIMEOUT_MS);
        skipNextPushRef.current = true;
        setSyncMessage(`Created trip ${nextTripCode}. Share this code.`);
      }

      hasReceivedInitialSnapshotRef.current = true;
      setActiveTripCode(nextTripCode);
      setTripCodeInput(nextTripCode);
      setSyncStatus('connected');
    } catch (error) {
      if (error instanceof Error && error.message === TRIP_CONNECT_TIMEOUT_ERROR) {
        setSyncStatus('error');
        setSyncMessage(`Connection timed out after ${Math.round(TRIP_CONNECT_TIMEOUT_MS / 1000)}s. Check database URL/rules and try again.`);
        return;
      }

      setSyncStatus('error');
      setSyncMessage('Failed to connect. Check Firebase setup and rules.');
    }
  };

  const handleLeaveTrip = () => {
    setActiveTripCode(null);
    setSyncStatus(isFirebaseConfigured ? 'idle' : 'disabled');
    setSyncMessage(isFirebaseConfigured ? 'Live share is off.' : 'Live share disabled. Set Firebase env vars to enable it.');
    hasReceivedInitialSnapshotRef.current = false;
  };

  const handleCopyTripCode = async () => {
    if (!activeTripCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeTripCode);
      setSyncMessage(`Trip code ${activeTripCode} copied.`);
    } catch {
      setSyncStatus('error');
      setSyncMessage('Clipboard unavailable. Copy the trip code manually.');
    }
  };

  const syncStatusClassName =
    syncStatus === 'connected'
      ? 'success'
      : syncStatus === 'error'
        ? 'error'
        : syncStatus === 'connecting'
          ? 'warning'
          : '';

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
                onChange={(e) => setSettings({ ...settings, totalBudget: Number(e.target.value) })}
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
                onChange={(e) => setSettings({ ...settings, peopleCount: Number(e.target.value) })}
              />
            </InputGroup>
          </div>

          <div className="topbar-actions d-flex align-items-end gap-3 flex-wrap">
            <section className="live-share-panel d-flex flex-column" aria-label="Live collaboration controls">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <InputGroup size="sm" style={{ width: '220px' }}>
                  <InputGroup.Text className="bg-light text-muted border-end-0"><FaLink /></InputGroup.Text>
                  <Form.Control
                    type="text"
                    className="border-start-0 text-uppercase"
                    placeholder="Trip code"
                    aria-label="Trip code"
                    value={tripCodeInput}
                    onChange={(e) => setTripCodeInput(normalizeTripCode(e.target.value))}
                  />
                </InputGroup>

                {activeTripCode ? (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="d-flex align-items-center gap-2"
                    onClick={handleLeaveTrip}
                  >
                    <FaPowerOff /> Leave
                  </Button>
                ) : (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    className="d-flex align-items-center gap-2"
                    onClick={handleJoinOrCreateTrip}
                    disabled={!isFirebaseConfigured || syncStatus === 'connecting'}
                  >
                    <FaLink /> Start / Join
                  </Button>
                )}

                <Button
                  variant="outline-primary"
                  size="sm"
                  className="d-flex align-items-center gap-2"
                  onClick={handleCopyTripCode}
                  disabled={!activeTripCode}
                >
                  <FaCopy /> Copy
                </Button>
              </div>

              <div className={`inline-status ${syncStatusClassName}`} role="status" aria-live="polite">
                {syncMessage}
              </div>
            </section>

            <DataPersistence destinations={destinations} onImport={handleImport} />
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
