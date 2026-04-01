import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { Button, Container, Form, InputGroup, Modal, Navbar, Spinner, Table } from 'react-bootstrap';
import { get, onValue, ref, set } from 'firebase/database';
import Sidebar from './components/Sidebar';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import PersistentBudgetStatus from './components/PersistentBudgetStatus';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetAttempt, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings, SearchLinkTemplate, TripVotes } from './types';
import { DEFAULT_SEARCH_LINKS } from './utils/bookingLinks';
import PersonSelector from './components/PersonSelector';
import VoteSummary from './components/VoteSummary';
import { FaCog, FaLink, FaPlane, FaPlus, FaPoll, FaSync, FaTrash, FaUsers, FaWallet } from 'react-icons/fa';
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
  tripMembers?: unknown;
  votes?: unknown;
  meta?: {
    updatedAt?: unknown;
    updatedBy?: unknown;
  };
};
const DEFAULT_SETTINGS: PlannerSettings = { totalBudget: 5000, peopleCount: 5, searchLinks: DEFAULT_SEARCH_LINKS };
const TRIP_CODE_MIN_LENGTH = 4;
const TRIP_CODE_MAX_LENGTH = 12;

const normalizeTripCode = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TRIP_CODE_MAX_LENGTH);

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
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

  return extraCosts.map((extraCost) => {
    const typedExtraCost = extraCost as LegacyExtraCost;
    const description = typeof typedExtraCost.description === 'string' ? typedExtraCost.description : '';
    const parsedValue = typedExtraCost.value;
    const value = typeof parsedValue === 'number' && Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;

    return { description, value };
  });
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
  if (typeof typedDraft.departureTime === 'string') normalizedDraft.departureTime = typedDraft.departureTime;
  if (typeof typedDraft.arrivalTime === 'string') normalizedDraft.arrivalTime = typedDraft.arrivalTime;
  if (typeof typedDraft.origin === 'string') normalizedDraft.origin = typedDraft.origin;
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
  if (typeof typedDraft.imageUrl === 'string') normalizedDraft.imageUrl = typedDraft.imageUrl;
  if (typeof typedDraft.rooms === 'number' && Number.isFinite(typedDraft.rooms) && typedDraft.rooms > 0) {
    normalizedDraft.rooms = typedDraft.rooms;
  }
  if (typeof typedDraft.beds === 'number' && Number.isFinite(typedDraft.beds) && typedDraft.beds > 0) {
    normalizedDraft.beds = typedDraft.beds;
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
    if (key === 'link' || key === 'description' || key === 'startDate' || key === 'endDate' || key === 'departureTime' || key === 'arrivalTime' || key === 'origin') {
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
    if (key === 'rooms' || key === 'beds') {
      return typeof value !== 'number' || !Number.isFinite(value) || value < 0;
    }
    if (key === 'link' || key === 'description' || key === 'startDate' || key === 'endDate' || key === 'imageUrl') {
      return typeof value !== 'string';
    }
    return true;
  });
};

const normalizeCustomGroupLinks = (raw: unknown): Record<string, Record<string, string>> | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, Record<string, string>> = {};
  for (const [groupKey, inner] of Object.entries(raw as Record<string, unknown>)) {
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) continue;
    const links: Record<string, string> = {};
    for (const [linkId, url] of Object.entries(inner as Record<string, unknown>)) {
      if (typeof url === 'string' && url.trim()) links[linkId] = url;
    }
    if (Object.keys(links).length > 0) result[groupKey] = links;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const normalizeDestination = (destination: LegacyDestination): Destination => ({
  ...destination,
  notes: typeof destination.notes === 'string' ? destination.notes : '',
  extraCosts: normalizeExtraCosts(destination.extraCosts),
  budgetEstimator: normalizeBudgetEstimator(destination.budgetEstimator),
  flightDraft: normalizeFlightDraft(destination.flightDraft),
  accommodationDraft: normalizeAccommodationDraft(destination.accommodationDraft),
  ...(normalizeCustomGroupLinks((destination as Record<string, unknown>).customGroupLinks)
    ? { customGroupLinks: normalizeCustomGroupLinks((destination as Record<string, unknown>).customGroupLinks) }
    : {})
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
        departureTime: typeof typedFlight.departureTime === 'string' ? typedFlight.departureTime : '',
        arrivalTime: typeof typedFlight.arrivalTime === 'string' ? typedFlight.arrivalTime : '',
        origin: typeof typedFlight.origin === 'string' ? typedFlight.origin : '',
        pricePerPerson: parsedPrice !== null && parsedPrice >= 0 ? parsedPrice : 0,
        ...(typeof typedFlight.createdAt === 'number' && Number.isFinite(typedFlight.createdAt) ? { createdAt: typedFlight.createdAt } : {}),
        ...(typeof typedFlight.updatedAt === 'number' && Number.isFinite(typedFlight.updatedAt) ? { updatedAt: typedFlight.updatedAt } : {})
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
        totalPrice: parsedPrice !== null && parsedPrice >= 0 ? parsedPrice : 0,
        ...(typeof typedAccommodation.imageUrl === 'string' && typedAccommodation.imageUrl ? { imageUrl: typedAccommodation.imageUrl } : {}),
        ...(typeof typedAccommodation.createdAt === 'number' && Number.isFinite(typedAccommodation.createdAt) ? { createdAt: typedAccommodation.createdAt } : {}),
        ...(typeof typedAccommodation.updatedAt === 'number' && Number.isFinite(typedAccommodation.updatedAt) ? { updatedAt: typedAccommodation.updatedAt } : {}),
        ...(typeof typedAccommodation.rooms === 'number' && Number.isFinite(typedAccommodation.rooms) && typedAccommodation.rooms > 0 ? { rooms: typedAccommodation.rooms } : {}),
        ...(typeof typedAccommodation.beds === 'number' && Number.isFinite(typedAccommodation.beds) && typedAccommodation.beds > 0 ? { beds: typedAccommodation.beds } : {})
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

  const customGroupLinks = normalizeCustomGroupLinks(parsed.customGroupLinks);

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
    accommodations: normalizeAccommodationList(parsed.accommodations),
    ...(customGroupLinks ? { customGroupLinks } : {})
  };

  return normalizeDestination(legacyDestination);
};

const normalizeSearchLinks = (candidate: unknown, fallback: SearchLinkTemplate[]): SearchLinkTemplate[] => {
  if (!Array.isArray(candidate)) {
    return fallback;
  }

  const defaultById = new Map(fallback.map((link) => [link.id, link]));

  const normalized = candidate
    .filter((item): item is Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => typeof item.id === 'string' && typeof item.label === 'string' && typeof item.urlTemplate === 'string' && (item.type === 'flight' || item.type === 'accommodation'))
    .map((item) => {
      const id = item.id as string;
      const builtIn = defaultById.get(id);
      // For built-in links, always use the latest URL template
      if (builtIn) {
        return {
          ...builtIn,
          enabled: typeof item.enabled === 'boolean' ? item.enabled : true
        };
      }
      return {
        id,
        label: item.label as string,
        urlTemplate: item.urlTemplate as string,
        type: item.type as 'flight' | 'accommodation',
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true
      };
    });

  return normalized.length > 0 ? normalized : fallback;
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

  const searchLinks = normalizeSearchLinks(parsed.searchLinks, fallback.searchLinks);

  return { totalBudget, peopleCount, searchLinks };
};

const DEFAULT_VOTES: TripVotes = { destinations: {}, flights: {}, accommodations: {} };

const normalizeVoteRecord = (candidate: unknown): Record<string, string[]> => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      result[key] = value.filter((v): v is string => typeof v === 'string');
    }
  }
  return result;
};

const normalizeVotes = (candidate: unknown): TripVotes => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return DEFAULT_VOTES;
  }
  const typed = candidate as Record<string, unknown>;
  return {
    destinations: normalizeVoteRecord(typed.destinations),
    flights: normalizeVoteRecord(typed.flights),
    accommodations: normalizeVoteRecord(typed.accommodations),
  };
};

const normalizeTripMembers = (candidate: unknown): string[] => {
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
};

const parseTripSyncPayload = (payload: unknown, fallbackSettings: PlannerSettings): { destinations: Destination[]; settings: PlannerSettings; tripMembers: string[]; votes: TripVotes; remoteUpdatedAt: number | null } | null => {
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
    tripMembers: normalizeTripMembers(typedPayload.tripMembers),
    votes: normalizeVotes(typedPayload.votes),
    remoteUpdatedAt: parseTimestamp(typedPayload.meta?.updatedAt)
  };
};

function App() {
  const [destinations, setDestinations] = useLocalStorage<Destination[]>('hackathon-destinations', []);
  const [settings, setSettings] = useLocalStorage<PlannerSettings>('hackathon-settings', DEFAULT_SETTINGS);
  const settingsRef = useRef<PlannerSettings>(DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useLocalStorage<string | null>('hackathon-active-id', null);
  const [activeSection, setActiveSection] = useLocalStorage<string>('hackathon-active-section', 'overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchLinksModal, setShowSearchLinksModal] = useState(false);
  const [showVoteSummary, setShowVoteSummary] = useState(false);
  const [currentPerson, setCurrentPerson] = useLocalStorage<string>('hackathon-current-person', '');
  const [tripMembers, setTripMembers] = useLocalStorage<string[]>('hackathon-trip-members', []);
  const [votes, setVotes] = useLocalStorage<TripVotes>('hackathon-votes', DEFAULT_VOTES);

  // Keep settingsRef in sync so the onValue Firebase listener always has the latest settings
  settingsRef.current = settings;

  // Sync state
  const [syncedTripCode, setSyncedTripCode] = useLocalStorage<string>('hackathon-trip-code', '');
  const [tripCodeInput, setTripCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [syncClientId] = useState(getOrCreateSyncClientId);
  const isRemoteUpdate = useRef(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const isTripSyncAvailable = isFirebaseConfigured && firebaseDatabase !== null;
  const normalizedSyncedCode = normalizeTripCode(syncedTripCode);
  const isSyncing = normalizedSyncedCode.length >= TRIP_CODE_MIN_LENGTH && isTripSyncAvailable;

  // Auto-join from ?trip=CODE in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripParam = params.get('trip');
    if (!tripParam) return;

    const code = normalizeTripCode(tripParam);
    if (code.length < TRIP_CODE_MIN_LENGTH) return;

    // Clean the URL param so it doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete('trip');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);

    // If already synced to this code, nothing to do
    if (normalizeTripCode(syncedTripCode) === code) return;

    // Auto-join: set the input and trigger join
    setTripCodeInput(code);
    const database = firebaseDatabase;
    if (!isTripSyncAvailable || !database) return;

    setIsJoining(true);
    get(ref(database, `trips/${code}`)).then((snapshot) => {
      if (snapshot.exists() && destinations.length > 0) {
        setPendingJoinCode(code);
        setShowJoinModal(true);
      } else if (snapshot.exists()) {
        setSyncedTripCode(code);
      } else {
        const payload: TripSyncPayload = {
          destinations, settings, tripMembers, votes,
          meta: { updatedAt: Date.now(), updatedBy: syncClientId }
        };
        return set(ref(database, `trips/${code}`), payload).then(() => {
          setSyncedTripCode(code);
        });
      }
    }).catch((error) => {
      console.error('Failed to auto-join trip from URL', error);
    }).finally(() => {
      setIsJoining(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const validDestIds = new Set(destinations.map((d) => d.id));
    const validFlightIds = new Set(destinations.flatMap((d) => d.flights.map((f) => f.id)));
    const validAccIds = new Set(destinations.flatMap((d) => d.accommodations.map((a) => a.id)));

    const prune = (record: Record<string, string[]>, validIds: Set<string>): Record<string, string[]> | null => {
      const pruned: Record<string, string[]> = {};
      let changed = false;
      for (const [key, value] of Object.entries(record)) {
        if (validIds.has(key)) {
          pruned[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? pruned : null;
    };

    const prunedDest = prune(votes.destinations, validDestIds);
    const prunedFlights = prune(votes.flights, validFlightIds);
    const prunedAcc = prune(votes.accommodations, validAccIds);

    if (prunedDest || prunedFlights || prunedAcc) {
      const prunedVotes = {
        destinations: prunedDest ?? votes.destinations,
        flights: prunedFlights ?? votes.flights,
        accommodations: prunedAcc ?? votes.accommodations,
      };
      setVotes(prunedVotes);

      if (isSyncing && firebaseDatabase && !isRemoteUpdate.current) {
        void set(ref(firebaseDatabase, `trips/${normalizedSyncedCode}/votes`), prunedVotes);
      }
    }
  }, [destinations, votes, setVotes, isSyncing, normalizedSyncedCode, firebaseDatabase]);

  // Real-time sync: single listener on the full trip path
  useEffect(() => {
    const database = firebaseDatabase;
    if (!isSyncing || !database) {
      return;
    }

    const tripRef = ref(database, `trips/${normalizedSyncedCode}`);
    const unsub = onValue(tripRef, (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }
      const parsed = parseTripSyncPayload(snapshot.val(), settingsRef.current);
      if (!parsed) {
        return;
      }

      isRemoteUpdate.current = true;
      setDestinations(parsed.destinations);
      setSettings(parsed.settings);
      setTripMembers(parsed.tripMembers);
      setVotes(parsed.votes);
      setSyncStatus('synced');
      // Reset the flag after React processes the batch
      requestAnimationFrame(() => { isRemoteUpdate.current = false; });
    });

    return () => {
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, normalizedSyncedCode, firebaseDatabase]);

  const activeDestination = destinations.find((destination) => destination.id === activeId);

  // Firebase write helpers — only write when syncing
  const syncToFirebase = (subPath: string, data: unknown) => {
    if (!isSyncing || !firebaseDatabase) return;
    setSyncStatus('syncing');
    set(ref(firebaseDatabase, `trips/${normalizedSyncedCode}/${subPath}`), data)
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('error'));
    void set(ref(firebaseDatabase, `trips/${normalizedSyncedCode}/meta`), { updatedAt: Date.now(), updatedBy: syncClientId });
  };

  const handleForceRefresh = () => {
    if (!isSyncing || !firebaseDatabase) return;
    setSyncStatus('syncing');
    get(ref(firebaseDatabase, `trips/${normalizedSyncedCode}`)).then((snapshot) => {
      if (!snapshot.exists()) { setSyncStatus('synced'); return; }
      const parsed = parseTripSyncPayload(snapshot.val(), settingsRef.current);
      if (!parsed) { setSyncStatus('error'); return; }
      isRemoteUpdate.current = true;
      setDestinations(parsed.destinations);
      setSettings(parsed.settings);
      setTripMembers(parsed.tripMembers);
      setVotes(parsed.votes);
      requestAnimationFrame(() => { isRemoteUpdate.current = false; });
      setSyncStatus('synced');
    }).catch(() => setSyncStatus('error'));
  };

  const handleUpdateDestination = (destinationId: string, updater: (currentDestination: Destination) => Destination) => {
    // Functional updater ensures sequential calls in the same event (e.g. onChange + onDraftChange)
    // each build on the previous result rather than on a shared stale snapshot.
    let newDests: Destination[] = [];
    setDestinations((prevDests) => {
      newDests = prevDests.map((d) => d.id === destinationId ? updater(d) : d);
      return newDests;
    });
    // queueMicrotask fires before any async Firebase onValue callback, so isRemoteUpdate is
    // still false at this point and syncToFirebase will proceed.
    queueMicrotask(() => syncToFirebase('destinations', newDests));
  };

  const handleAddDestination = (newDest: Destination) => {
    const destination = normalizeDestination(newDest);
    let newDests: Destination[] = [];
    setDestinations((prevDests) => {
      newDests = [...prevDests, destination];
      return newDests;
    });
    setActiveId(newDest.id);
    queueMicrotask(() => syncToFirebase('destinations', newDests));
  };

  const handleRemoveDestination = (id: string) => {
    let newDests: Destination[] = [];
    setDestinations((prevDests) => {
      newDests = prevDests.filter((d) => d.id !== id);
      return newDests;
    });
    queueMicrotask(() => {
      syncToFirebase('destinations', newDests);
      if (activeId === id) {
        setActiveId(newDests.length > 0 ? newDests[0].id : null);
      }
    });
  };

  const handleImport = (data: Destination[]) => {
    const normalizedData = data.map((d) => normalizeDestination(d as LegacyDestination));
    setDestinations(normalizedData);
    if (normalizedData.length > 0) {
      setActiveId(normalizedData[0].id);
    }
    syncToFirebase('destinations', normalizedData);
  };

  const updateSettings = (next: PlannerSettings) => {
    setSettings(next);
    syncToFirebase('settings', next);
  };

  const handleTotalBudgetChange = (value: string) => {
    const parsed = Number(value);
    updateSettings({
      ...settings,
      totalBudget: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    });
  };

  const handlePeopleCountChange = (value: string) => {
    const parsed = Number(value);
    updateSettings({
      ...settings,
      peopleCount: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
    });
  };

  const handleSearchLinkUpdate = (id: string, updates: Partial<SearchLinkTemplate>) => {
    updateSettings({
      ...settings,
      searchLinks: settings.searchLinks.map((link) => link.id === id ? { ...link, ...updates } : link)
    });
  };

  const handleSearchLinkAdd = () => {
    const newLink: SearchLinkTemplate = {
      id: `custom-${Date.now()}`,
      label: 'New Link',
      urlTemplate: 'https://example.com?q={destination}&from={startDate}&to={endDate}',
      type: 'flight',
      enabled: true
    };
    updateSettings({
      ...settings,
      searchLinks: [...settings.searchLinks, newLink]
    });
  };

  const handleSearchLinkRemove = (id: string) => {
    updateSettings({
      ...settings,
      searchLinks: settings.searchLinks.filter((link) => link.id !== id)
    });
  };

  const handleSearchLinksReset = () => {
    updateSettings({
      ...settings,
      searchLinks: DEFAULT_SEARCH_LINKS
    });
  };

  const handleAddTripMember = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = tripMembers.includes(trimmed) ? tripMembers : [...tripMembers, trimmed];
    setTripMembers(updated);
    syncToFirebase('tripMembers', updated);
  };

  const handleToggleVote = (category: keyof TripVotes, entityId: string) => {
    if (!currentPerson) return;
    const current = votes[category][entityId] || [];
    const hasVoted = current.includes(currentPerson);
    const next = hasVoted
      ? current.filter((name) => name !== currentPerson)
      : [...current, currentPerson];

    setVotes((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [entityId]: next
      }
    }));

    if (isSyncing && firebaseDatabase) {
      void set(ref(firebaseDatabase, `trips/${normalizedSyncedCode}/votes/${category}/${entityId}`), next);
    }
  };

  // Join / leave trip
  const handleJoinTrip = async () => {
    const code = normalizeTripCode(tripCodeInput);
    if (code.length < TRIP_CODE_MIN_LENGTH || !isTripSyncAvailable || !firebaseDatabase) return;

    setIsJoining(true);
    try {
      const snapshot = await get(ref(firebaseDatabase, `trips/${code}`));
      if (snapshot.exists() && destinations.length > 0) {
        // Remote exists and user has local data — warn before overriding
        setPendingJoinCode(code);
        setShowJoinModal(true);
      } else if (snapshot.exists()) {
        // Remote exists, no local data — join directly
        setSyncedTripCode(code);
      } else {
        // No remote — create trip from local data
        const payload: TripSyncPayload = {
          destinations, settings, tripMembers, votes,
          meta: { updatedAt: Date.now(), updatedBy: syncClientId }
        };
        await set(ref(firebaseDatabase, `trips/${code}`), payload);
        setSyncedTripCode(code);
      }
    } catch (error) {
      console.error('Failed to join trip', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleConfirmJoin = () => {
    setSyncedTripCode(pendingJoinCode);
    setShowJoinModal(false);
    setPendingJoinCode('');
  };

  const handleCancelJoin = () => {
    setShowJoinModal(false);
    setPendingJoinCode('');
  };

  const handleLeaveTrip = () => {
    setSyncedTripCode('');
    setTripCodeInput('');
    setSyncStatus('idle');
  };

  const [shareTooltip, setShareTooltip] = useState('');
  const handleShareTrip = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('trip', normalizedSyncedCode);
    // Remove hash so the link lands on the default view
    url.hash = '';
    void navigator.clipboard.writeText(url.toString()).then(() => {
      setShareTooltip('Link copied!');
      setTimeout(() => setShareTooltip(''), 2000);
    }).catch(() => {
      setShareTooltip('Copy failed');
      setTimeout(() => setShareTooltip(''), 2000);
    });
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

                <PersonSelector
                  currentPerson={currentPerson}
                  onPersonChange={setCurrentPerson}
                  tripMembers={tripMembers}
                  onAddMember={handleAddTripMember}
                />

                <Button size="sm" variant="outline-secondary" onClick={() => setShowVoteSummary(true)} title="Vote results" aria-label="Vote results">
                  <FaPoll />
                </Button>

                <Button size="sm" variant="outline-secondary" onClick={() => setShowSearchLinksModal(true)} title="Search link settings" aria-label="Search link settings">
                  <FaCog />
                </Button>
              </div>
            </div>

            <div className="topbar-actions d-flex align-items-center justify-content-end gap-3 flex-wrap">
              <section className="live-share-panel d-flex flex-column" aria-label="Trip sync controls">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong className="small">Trip Sync</strong>
                  <span
                    className={`badge border ${isSyncing ? 'bg-success-subtle text-success-emphasis border-success-subtle' : isTripSyncAvailable ? 'bg-secondary-subtle text-secondary-emphasis border-secondary-subtle' : 'bg-warning-subtle text-warning-emphasis border-warning-subtle'}`}
                  >
                    {isSyncing ? `Live: ${normalizedSyncedCode}` : isTripSyncAvailable ? 'Not connected' : 'Unavailable'}
                  </span>
                  {isSyncing && (
                    <span
                      title={syncStatus === 'synced' ? 'All changes synced' : syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'error' ? 'Sync error' : ''}
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        flexShrink: 0,
                        backgroundColor: syncStatus === 'synced' ? 'var(--bs-success)' : syncStatus === 'syncing' ? 'var(--bs-warning)' : syncStatus === 'error' ? 'var(--bs-danger)' : 'var(--bs-secondary)',
                        boxShadow: syncStatus === 'syncing' ? '0 0 0 2px var(--bs-warning-bg-subtle)' : syncStatus === 'synced' ? '0 0 0 2px var(--bs-success-bg-subtle)' : 'none',
                      }}
                      aria-label={`Sync status: ${syncStatus}`}
                    />
                  )}
                </div>
                <div className="trip-sync-controls">
                  {isSyncing ? (
                    <div className="d-flex gap-2 align-items-center">
                      <Button size="sm" variant="outline-primary" onClick={handleShareTrip} title="Copy share link">
                        <FaLink className="me-1" /> {shareTooltip || 'Share'}
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={handleForceRefresh} title="Pull latest from Firebase" disabled={syncStatus === 'syncing'}>
                        <FaSync className={syncStatus === 'syncing' ? 'spin' : ''} />
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={handleLeaveTrip}>
                        Leave
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Form.Control
                        size="sm"
                        value={tripCodeInput}
                        onChange={(e) => setTripCodeInput(normalizeTripCode(e.target.value))}
                        placeholder="Trip code"
                        aria-label="Trip code to join"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleJoinTrip(); }}
                      />
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={handleJoinTrip}
                        disabled={!isTripSyncAvailable || normalizeTripCode(tripCodeInput).length < TRIP_CODE_MIN_LENGTH || isJoining}
                      >
                        {isJoining ? <Spinner animation="border" size="sm" /> : 'Join'}
                      </Button>
                    </>
                  )}
                </div>
                {!isTripSyncAvailable && (
                  <div className="inline-status warning mt-1" role="status" aria-live="polite">
                    Firebase config missing — sync disabled.
                  </div>
                )}
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
          onSelect={(id) => { setActiveId(id); setActiveSection('overview'); }}
          onAddClick={() => setShowAddModal(true)}
          onRemove={handleRemoveDestination}
          votes={votes.destinations}
          currentPerson={currentPerson}
          onToggleVote={(destId) => handleToggleVote('destinations', destId)}
        />

        <div className="workspace-pane flex-grow-1 d-flex flex-column overflow-hidden">
          <PersistentBudgetStatus destination={activeDestination} settings={settings} activeSection={activeSection} />

          <main className="app-content flex-grow-1 overflow-auto position-relative" aria-live="polite">
            {activeDestination ? (
              <DestinationView
                destination={activeDestination}
                onUpdate={handleUpdateDestination}
                settings={settings}
                votes={votes}
                currentPerson={currentPerson}
                onToggleVote={handleToggleVote}
                onSectionChange={setActiveSection}
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

      <Modal show={showSearchLinksModal} onHide={() => setShowSearchLinksModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Search Link Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Customize the booking search links shown in grouped views. Use placeholders: <code>{'{destination}'}</code>, <code>{'{origin}'}</code>, <code>{'{startDate}'}</code>, <code>{'{endDate}'}</code>, <code>{'{people}'}</code>.
          </p>
          <Table size="sm" bordered>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>On</th>
                <th style={{ width: '120px' }}>Label</th>
                <th style={{ width: '100px' }}>Type</th>
                <th>URL Template</th>
                <th style={{ width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {(settings.searchLinks || DEFAULT_SEARCH_LINKS).map((link) => (
                <tr key={link.id}>
                  <td className="text-center align-middle">
                    <Form.Check
                      type="switch"
                      checked={link.enabled}
                      onChange={(e) => handleSearchLinkUpdate(link.id, { enabled: e.target.checked })}
                      aria-label={`Toggle ${link.label}`}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      value={link.label}
                      onChange={(e) => handleSearchLinkUpdate(link.id, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Select
                      size="sm"
                      value={link.type}
                      onChange={(e) => handleSearchLinkUpdate(link.id, { type: e.target.value as 'flight' | 'accommodation' })}
                    >
                      <option value="flight">Flight</option>
                      <option value="accommodation">Stay</option>
                    </Form.Select>
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      value={link.urlTemplate}
                      onChange={(e) => handleSearchLinkUpdate(link.id, { urlTemplate: e.target.value })}
                    />
                  </td>
                  <td className="text-center align-middle">
                    <Button variant="link" className="text-danger p-0" onClick={() => handleSearchLinkRemove(link.id)} aria-label={`Remove ${link.label}`}>
                      <FaTrash />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-primary" onClick={handleSearchLinkAdd}>
              <FaPlus className="me-1" /> Add Link
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={handleSearchLinksReset}>
              Reset to Defaults
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      <VoteSummary
        show={showVoteSummary}
        onHide={() => setShowVoteSummary(false)}
        destinations={destinations}
        votes={votes}
        tripMembers={tripMembers}
      />

      <Modal show={showJoinModal} onHide={handleCancelJoin} centered>
        <Modal.Header closeButton>
          <Modal.Title>Join Trip {pendingJoinCode}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            A trip with code <strong>{pendingJoinCode}</strong> already exists on the server.
            {isSyncing
              ? <> You are currently on trip <strong>{normalizedSyncedCode}</strong>. Joining will <strong>switch you to {pendingJoinCode}</strong>.</>
              : <> Joining will <strong>replace your current local data</strong> with the remote trip.</>
            }
          </p>
          <p className="text-muted small mb-0">
            You can use the Export button to save your current data before joining.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleCancelJoin}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirmJoin}>Join Trip</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
