import { useEffect, useState } from 'react';
import { Button, Container, Dropdown, Form, InputGroup, Navbar, Spinner } from 'react-bootstrap';
import { get, ref, set } from 'firebase/database';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import PersistentBudgetStatus from './components/PersistentBudgetStatus';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetAttempt, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings } from './types';
import { FaPlane, FaPlus, FaUsers, FaWallet } from 'react-icons/fa';
import { firebaseDatabase, isFirebaseConfigured } from './firebase';
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
type TripSyncPayload = {
  destinations?: unknown;
  settings?: unknown;
  meta?: {
    updatedAt?: unknown;
    updatedBy?: unknown;
  };
};
type SyncStatusKind = 'neutral' | 'success' | 'warning' | 'error';
type SyncStatus = { kind: SyncStatusKind; message: string };

const DEFAULT_SETTINGS: PlannerSettings = { totalBudget: 5000, peopleCount: 5 };
const TRIP_CODE_MIN_LENGTH = 4;
const TRIP_CODE_MAX_LENGTH = 12;
const REMOTE_CHECK_INTERVAL_MS = 15000;

const normalizeTripCode = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TRIP_CODE_MAX_LENGTH);

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
};

const formatTimestamp = (value: number | null): string => {
  return value ? new Date(value).toLocaleString() : 'Not available';
};

const getOrCreateSyncClientId = (): string => {
  const key = 'hackathon-sync-client-id';
  const existingValue = window.localStorage.getItem(key);
  if (existingValue) {
    return existingValue;
  }

  const generatedValue = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `sync-${Math.random().toString(36).slice(2, 12)}`;

  window.localStorage.setItem(key, generatedValue);
  return generatedValue;
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

const parseNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const normalizeFlightList = (flights: unknown): Flight[] => {
  if (!Array.isArray(flights)) {
    return [];
  }

  return flights
    .map((flight) => {
      if (!flight || typeof flight !== 'object' || Array.isArray(flight)) {
        return null;
      }

      const typedFlight = flight as Record<string, unknown>;
      if (typeof typedFlight.id !== 'string' || !typedFlight.id.trim()) {
        return null;
      }

      const parsedPrice = parseNumberValue(typedFlight.pricePerPerson);
      return {
        id: typedFlight.id,
        link: typeof typedFlight.link === 'string' ? typedFlight.link : '',
        description: typeof typedFlight.description === 'string' ? typedFlight.description : '',
        startDate: typeof typedFlight.startDate === 'string' ? typedFlight.startDate : '',
        endDate: typeof typedFlight.endDate === 'string' ? typedFlight.endDate : '',
        pricePerPerson: parsedPrice !== null && parsedPrice >= 0 ? parsedPrice : 0
      };
    })
    .filter((flight): flight is Flight => flight !== null);
};

const normalizeAccommodationList = (accommodations: unknown): Accommodation[] => {
  if (!Array.isArray(accommodations)) {
    return [];
  }

  return accommodations
    .map((accommodation) => {
      if (!accommodation || typeof accommodation !== 'object' || Array.isArray(accommodation)) {
        return null;
      }

      const typedAccommodation = accommodation as Record<string, unknown>;
      if (typeof typedAccommodation.id !== 'string' || !typedAccommodation.id.trim()) {
        return null;
      }

      const parsedPrice = parseNumberValue(typedAccommodation.totalPrice);
      return {
        id: typedAccommodation.id,
        link: typeof typedAccommodation.link === 'string' ? typedAccommodation.link : '',
        description: typeof typedAccommodation.description === 'string' ? typedAccommodation.description : '',
        startDate: typeof typedAccommodation.startDate === 'string' ? typedAccommodation.startDate : '',
        endDate: typeof typedAccommodation.endDate === 'string' ? typedAccommodation.endDate : '',
        totalPrice: parsedPrice !== null && parsedPrice >= 0 ? parsedPrice : 0
      };
    })
    .filter((accommodation): accommodation is Accommodation => accommodation !== null);
};

const normalizeDestinationCandidate = (candidate: unknown): Destination | null => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const parsed = candidate as Record<string, unknown>;
  if (typeof parsed.id !== 'string' || !parsed.id.trim() || typeof parsed.name !== 'string' || !parsed.name.trim()) {
    return null;
  }

  const latitude = parseNumberValue(parsed.latitude);
  const longitude = parseNumberValue(parsed.longitude);
  if (latitude === null || longitude === null) {
    return null;
  }

  const legacyDestination: LegacyDestination = {
    id: parsed.id,
    name: parsed.name,
    latitude,
    longitude,
    notes: parsed.notes,
    extraCosts: parsed.extraCosts,
    budgetEstimator: parsed.budgetEstimator,
    flightDraft: parsed.flightDraft,
    accommodationDraft: parsed.accommodationDraft,
    flights: normalizeFlightList(parsed.flights),
    accommodations: normalizeAccommodationList(parsed.accommodations)
  };

  return normalizeDestination(legacyDestination);
};

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

const parseTripSyncPayload = (payload: unknown, fallbackSettings: PlannerSettings): { destinations: Destination[]; settings: PlannerSettings; remoteUpdatedAt: number | null } | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const typedPayload = payload as TripSyncPayload;
  if (!Array.isArray(typedPayload.destinations)) {
    return null;
  }

  const destinations = typedPayload.destinations
    .map((destination) => normalizeDestinationCandidate(destination))
    .filter((destination): destination is Destination => destination !== null);

  if (typedPayload.destinations.length > 0 && destinations.length === 0) {
    return null;
  }

  return {
    destinations,
    settings: normalizeSettings(typedPayload.settings, fallbackSettings),
    remoteUpdatedAt: parseTimestamp(typedPayload.meta?.updatedAt)
  };
};

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tripCode, setTripCode] = useLocalStorage<string>('hackathon-trip-code', '');
  const [lastKnownRemoteByCode, setLastKnownRemoteByCode] = useLocalStorage<Record<string, number>>('hackathon-trip-sync-known-remote', {});
  const [lastLocalPushByCode, setLastLocalPushByCode] = useLocalStorage<Record<string, number>>('hackathon-trip-sync-last-push', {});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'neutral', message: 'Enter a trip code, then pull or push manually.' });
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [latestRemoteUpdatedAt, setLatestRemoteUpdatedAt] = useState<number | null>(null);
  const [lastRemoteCheckAt, setLastRemoteCheckAt] = useState<number | null>(null);
  const [syncClientId] = useState(getOrCreateSyncClientId);

  const normalizedTripCode = normalizeTripCode(tripCode);
  const hasValidTripCode = normalizedTripCode.length >= TRIP_CODE_MIN_LENGTH;
  const isTripSyncAvailable = isFirebaseConfigured && firebaseDatabase !== null;
  const lastKnownRemoteAtForCode = hasValidTripCode ? (lastKnownRemoteByCode[normalizedTripCode] ?? 0) : 0;
  const lastLocalPushAtForCode = hasValidTripCode ? (lastLocalPushByCode[normalizedTripCode] ?? 0) : 0;
  const hasRemoteChangesSinceLastSync = latestRemoteUpdatedAt !== null && latestRemoteUpdatedAt > lastKnownRemoteAtForCode;

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

  useEffect(() => {
    const database = firebaseDatabase;

    if (!isTripSyncAvailable || !hasValidTripCode || !database) {
      setLatestRemoteUpdatedAt(null);
      setLastRemoteCheckAt(null);
      return;
    }

    let cancelled = false;

    const checkRemoteUpdatedAt = async () => {
      try {
        const snapshot = await get(ref(database, `trips/${normalizedTripCode}/meta/updatedAt`));
        if (cancelled) {
          return;
        }
        setLatestRemoteUpdatedAt(parseTimestamp(snapshot.val()));
      } catch {
        if (cancelled) {
          return;
        }
        setLatestRemoteUpdatedAt(null);
      } finally {
        if (!cancelled) {
          setLastRemoteCheckAt(Date.now());
        }
      }
    };

    void checkRemoteUpdatedAt();
    const intervalId = window.setInterval(() => {
      void checkRemoteUpdatedAt();
    }, REMOTE_CHECK_INTERVAL_MS);

    const handleWindowFocus = () => {
      void checkRemoteUpdatedAt();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkRemoteUpdatedAt();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTripSyncAvailable, hasValidTripCode, normalizedTripCode, firebaseDatabase]);

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

  const handleTripCodeChange = (value: string) => {
    setTripCode(normalizeTripCode(value));
    setSyncStatus({ kind: 'neutral', message: 'Use Pull to load, or Push to save local changes for this code.' });
  };

  const handlePullFromTrip = async () => {
    if (!isTripSyncAvailable || !firebaseDatabase) {
      setSyncStatus({ kind: 'error', message: 'Trip sync is not configured in this environment.' });
      return;
    }

    if (!hasValidTripCode) {
      setSyncStatus({ kind: 'warning', message: `Trip code must be at least ${TRIP_CODE_MIN_LENGTH} characters.` });
      return;
    }

    setIsPulling(true);
    try {
      const snapshot = await get(ref(firebaseDatabase, `trips/${normalizedTripCode}`));
      if (!snapshot.exists()) {
        setLatestRemoteUpdatedAt(null);
        setSyncStatus({ kind: 'warning', message: `No saved trip found for code ${normalizedTripCode}.` });
        return;
      }

      const parsedPayload = parseTripSyncPayload(snapshot.val(), settings);
      if (!parsedPayload) {
        setSyncStatus({ kind: 'error', message: 'Trip data is invalid and could not be loaded.' });
        return;
      }

      setDestinations(parsedPayload.destinations);
      setSettings(parsedPayload.settings);
      setActiveId(parsedPayload.destinations[0]?.id ?? null);

      setLatestRemoteUpdatedAt(parsedPayload.remoteUpdatedAt);
      setLastKnownRemoteByCode((previous) => ({
        ...previous,
        [normalizedTripCode]: parsedPayload.remoteUpdatedAt ?? 0
      }));

      setSyncStatus({
        kind: 'success',
        message: `Pulled ${parsedPayload.destinations.length} destination${parsedPayload.destinations.length === 1 ? '' : 's'} from ${normalizedTripCode}.`
      });
    } catch (error) {
      console.error('Failed to pull trip data', error);
      setSyncStatus({ kind: 'error', message: 'Failed to pull trip data. Please try again.' });
    } finally {
      setIsPulling(false);
    }
  };

  const handlePushToTrip = async () => {
    if (!isTripSyncAvailable || !firebaseDatabase) {
      setSyncStatus({ kind: 'error', message: 'Trip sync is not configured in this environment.' });
      return;
    }

    if (!hasValidTripCode) {
      setSyncStatus({ kind: 'warning', message: `Trip code must be at least ${TRIP_CODE_MIN_LENGTH} characters.` });
      return;
    }

    setIsPushing(true);
    try {
      const tripRef = ref(firebaseDatabase, `trips/${normalizedTripCode}`);
      const currentRemoteSnapshot = await get(tripRef);
      const remotePayload = currentRemoteSnapshot.exists() ? currentRemoteSnapshot.val() as TripSyncPayload : null;
      const remoteUpdatedAt = parseTimestamp(remotePayload?.meta?.updatedAt);
      const knownRemoteUpdatedAt = lastKnownRemoteByCode[normalizedTripCode] ?? 0;
      setLatestRemoteUpdatedAt(remoteUpdatedAt);

      if (remoteUpdatedAt !== null && remoteUpdatedAt > knownRemoteUpdatedAt) {
        const shouldOverride = window.confirm(
          'Remote changes were pushed after your last sync. Press OK to overwrite with local data, or Cancel to pull first.'
        );
        if (!shouldOverride) {
          setSyncStatus({ kind: 'warning', message: 'Push canceled. Pull latest remote changes before pushing.' });
          return;
        }
      }

      const updatedAt = Date.now();
      const payload: TripSyncPayload = {
        destinations,
        settings,
        meta: {
          updatedAt,
          updatedBy: syncClientId
        }
      };

      await set(tripRef, payload);

      setLastKnownRemoteByCode((previous) => ({ ...previous, [normalizedTripCode]: updatedAt }));
      setLastLocalPushByCode((previous) => ({ ...previous, [normalizedTripCode]: updatedAt }));
      setLatestRemoteUpdatedAt(updatedAt);
      setSyncStatus({ kind: 'success', message: `Pushed local plan to ${normalizedTripCode}.` });
    } catch (error) {
      console.error('Failed to push trip data', error);
      setSyncStatus({ kind: 'error', message: 'Failed to push trip data. Please try again.' });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="app-shell d-flex flex-column">
      <Navbar className="app-topbar flex-shrink-0 py-2">
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
              <section className="live-share-panel d-flex flex-column" aria-label="Trip sync controls">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong className="small">Trip Sync</strong>
                  <span
                    className={`badge border ${isTripSyncAvailable ? (hasRemoteChangesSinceLastSync ? 'bg-warning-subtle text-warning-emphasis border-warning-subtle' : 'bg-success-subtle text-success-emphasis border-success-subtle') : 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle'}`}
                  >
                    {isTripSyncAvailable ? (hasRemoteChangesSinceLastSync ? 'Updates' : 'Manual') : 'Unavailable'}
                  </span>
                </div>
                <div className="trip-sync-controls">
                  <Form.Control
                    size="sm"
                    value={tripCode}
                    onChange={(e) => handleTripCodeChange(e.target.value)}
                    placeholder="Trip code"
                    aria-label="Trip code for manual sync"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={handlePullFromTrip}
                    disabled={!isTripSyncAvailable || !hasValidTripCode || isPulling || isPushing}
                  >
                    {isPulling ? <Spinner animation="border" size="sm" /> : 'Pull'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={handlePushToTrip}
                    disabled={!isTripSyncAvailable || !hasValidTripCode || isPulling || isPushing}
                  >
                    {isPushing ? <Spinner animation="border" size="sm" /> : 'Push'}
                  </Button>
                  <Dropdown align="end">
                    <Dropdown.Toggle
                      size="sm"
                      variant="outline-secondary"
                      id="trip-sync-details"
                    >
                      Details
                    </Dropdown.Toggle>
                    <Dropdown.Menu className="trip-sync-menu">
                      <div className="trip-sync-menu-line">
                        Last remote update: {formatTimestamp(latestRemoteUpdatedAt)}
                      </div>
                      <div className="trip-sync-menu-line">
                        Last local push: {formatTimestamp(lastLocalPushAtForCode || null)}
                      </div>
                      <div className="trip-sync-menu-line">
                        Last check: {formatTimestamp(lastRemoteCheckAt)}
                      </div>
                      {hasRemoteChangesSinceLastSync && (
                        <div className="inline-status warning mt-2" role="status" aria-live="polite">
                          Remote changes exist after your last sync. Pull first, or push to override.
                        </div>
                      )}
                      {!isTripSyncAvailable && (
                        <div className="inline-status warning mt-2" role="status" aria-live="polite">
                          Firebase config missing, so trip sync is disabled.
                        </div>
                      )}
                      <div className={`inline-status ${syncStatus.kind === 'neutral' ? '' : syncStatus.kind} mt-2`} role="status" aria-live="polite">
                        {syncStatus.message}
                      </div>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
                {syncStatus.kind === 'warning' || syncStatus.kind === 'error' ? (
                  <div className={`inline-status ${syncStatus.kind} mt-1`} role="status" aria-live="polite">
                    {syncStatus.message}
                  </div>
                ) : null}
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
