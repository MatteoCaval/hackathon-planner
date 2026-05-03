import { useEffect, useState, useRef } from 'react';
import { Form, Modal, Spinner, Table } from 'react-bootstrap';
import { get, onValue, ref, set, update } from 'firebase/database';
import DestinationView from './components/DestinationView';
import AddDestinationModal from './components/AddDestinationModal';
import DataPersistence from './components/DataPersistence';
import MapComponent from './components/MapComponent';
import { useLocalStorage } from './useLocalStorage';
import { Accommodation, BudgetAttempt, BudgetEstimatorState, Destination, ExtraCost, Flight, PlannerSettings, SearchLinkTemplate, TripVotes } from './types';
import { DEFAULT_SEARCH_LINKS } from './utils/bookingLinks';
import VoteSummary from './components/VoteSummary';
import { FaCog, FaClipboard, FaCheck, FaLink, FaPlane, FaPlus, FaPoll, FaSync, FaTrash, FaChevronDown } from 'react-icons/fa';
import { firebaseDatabase, isFirebaseConfigured } from './firebase';
import { formatCurrency } from './utils/budget';
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

  if (attempts.length > 5) {
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
  const normalizedAttempts = attempts.slice(0, 5);
  const normalizedFixedAttemptId = normalizedAttempts.some((a) => a.id === fixedAttemptId) ? fixedAttemptId : (normalizedAttempts[0]?.id || '');

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

const normalizeStayLinks = (raw: unknown): { label: string; url: string }[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const result = raw
    .filter((item): item is Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => typeof item.label === 'string' && item.label.trim() && typeof item.url === 'string' && item.url.trim())
    .map((item) => ({ label: item.label as string, url: item.url as string }));
  return result.length > 0 ? result : undefined;
};

const normalizeDestination = (destination: LegacyDestination): Destination => {
  const raw = destination as Record<string, unknown>;
  const customGroupLinks = normalizeCustomGroupLinks(raw.customGroupLinks);
  const stayLinks = normalizeStayLinks(raw.stayLinks);
  return {
    ...destination,
    notes: typeof destination.notes === 'string' ? destination.notes : '',
    extraCosts: normalizeExtraCosts(destination.extraCosts),
    budgetEstimator: normalizeBudgetEstimator(destination.budgetEstimator),
    flightDraft: normalizeFlightDraft(destination.flightDraft),
    accommodationDraft: normalizeAccommodationDraft(destination.accommodationDraft),
    ...(customGroupLinks ? { customGroupLinks } : {}),
    ...(stayLinks ? { stayLinks } : {})
  };
};

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
  const stayLinks = normalizeStayLinks(parsed.stayLinks);

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
    ...(customGroupLinks ? { customGroupLinks } : {}),
    ...(stayLinks ? { stayLinks } : {})
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
      // For built-in links, preserve user's template if customized, otherwise use latest default
      if (builtIn) {
        const userTemplate = item.urlTemplate as string;
        const isCustomized = userTemplate && userTemplate !== builtIn.urlTemplate;
        return {
          ...builtIn,
          ...(isCustomized ? { urlTemplate: userTemplate } : {}),
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
  const [, setActiveSection] = useLocalStorage<string>('hackathon-active-section', 'overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVoteSummary, setShowVoteSummary] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
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
  void syncStatus;

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
    // Atomic multi-path update: data + meta in a single write
    const updates: Record<string, unknown> = {
      [`trips/${normalizedSyncedCode}/${subPath}`]: data,
      [`trips/${normalizedSyncedCode}/meta`]: { updatedAt: Date.now(), updatedBy: syncClientId }
    };
    update(ref(firebaseDatabase), updates)
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('error'));
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
    queueMicrotask(() => {
      if (!isRemoteUpdate.current) syncToFirebase('destinations', newDests);
    });
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
      set(ref(firebaseDatabase, `trips/${normalizedSyncedCode}/votes/${category}/${entityId}`), next)
        .catch((err) => console.error('Vote sync failed:', err));
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
    url.hash = '';
    void navigator.clipboard.writeText(url.toString()).then(() => {
      setShareTooltip('Link copied!');
      setTimeout(() => setShareTooltip(''), 2000);
    }).catch(() => {
      setShareTooltip('Copy failed');
      setTimeout(() => setShareTooltip(''), 2000);
    });
  };

  // Header UI state
  const [personMenuOpen, setPersonMenuOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncDraft, setSyncDraft] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const personRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (personMenuOpen && personRef.current && !personRef.current.contains(e.target as Node)) setPersonMenuOpen(false);
      if (syncOpen && syncRef.current && !syncRef.current.contains(e.target as Node)) setSyncOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [personMenuOpen, syncOpen]);

  const copyTripCode = () => {
    navigator.clipboard?.writeText(normalizedSyncedCode || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1400);
  };

  const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleNotesChange = (notes: string) => {
    if (!activeDestination) return;
    handleUpdateDestination(activeDestination.id, (d) => ({ ...d, notes }));
  };

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-row">
          <div className="brand">
            <div className="brand-mark">T</div>
            <span>tripfolio</span>
          </div>

          <div className="dest-switcher" role="tablist">
            {destinations.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={d.id === activeId}
                className={`dest-tab${d.id === activeId ? ' is-active' : ''}`}
                onClick={() => setActiveId(d.id)}
                onDoubleClick={() => { if (window.confirm(`Remove ${d.name}?`)) handleRemoveDestination(d.id); }}
                title={`${d.name} (double-click to remove)`}
              >
                {d.name}
              </button>
            ))}
            <button className="dest-tab add-tab" onClick={() => setShowAddModal(true)} title="Add destination">
              <FaPlus size={12} />
            </button>
          </div>

          <div className="header-spacer" />

          <div className="header-actions">
            {/* Sync pill */}
            <div ref={syncRef} style={{ position: 'relative' }}>
              <button
                className={`sync-pill${isSyncing ? '' : ' is-off'}`}
                onClick={() => { setSyncDraft(isSyncing ? normalizedSyncedCode : tripCodeInput); setSyncOpen(o => !o); }}
                title={isSyncing ? 'Connected — click to manage' : 'Not connected'}
              >
                <span className="dot" />
                <FaSync size={10} />
                {isSyncing ? normalizedSyncedCode : 'Connect trip'}
              </button>
              {syncOpen && (
                <div className="sync-popover">
                  <div className="sync-pop-head">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{isSyncing ? 'Trip is live' : 'Connect a trip'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {isSyncing ? 'Anyone with the code can collaborate in real time.' : 'Enter or create a code to share with the group.'}
                      </div>
                    </div>
                    {isSyncing && <span className="live-dot"><span className="dot" /> live</span>}
                  </div>

                  {isSyncing && (
                    <div className="sync-code-display">
                      <div className="sync-code">{normalizedSyncedCode}</div>
                      <button className="btn btn-outline btn-sm" onClick={copyTripCode}>
                        {copiedCode ? <><FaCheck size={10} /> Copied</> : <><FaClipboard size={10} /> Copy</>}
                      </button>
                    </div>
                  )}

                  <div className="sync-pop-section">
                    <div className="sync-pop-label">{isSyncing ? 'Switch trip' : 'Trip code'}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="input input-inline"
                        placeholder="e.g. TRIP2026"
                        value={syncDraft}
                        onChange={(e) => setSyncDraft(normalizeTripCode(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setTripCodeInput(syncDraft);
                            setSyncOpen(false);
                            void handleJoinTrip();
                          }
                        }}
                        style={{ flex: 1, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                      />
                      <button
                        className="btn btn-accent btn-sm"
                        disabled={syncDraft.length < TRIP_CODE_MIN_LENGTH || syncDraft === normalizedSyncedCode}
                        onClick={() => {
                          setTripCodeInput(syncDraft);
                          setSyncOpen(false);
                          setTimeout(() => void handleJoinTrip(), 0);
                        }}
                      >
                        {isJoining ? <Spinner animation="border" size="sm" /> : (isSyncing ? 'Switch' : 'Connect')}
                      </button>
                    </div>
                    <button className="link-btn" onClick={() => {
                      const code = 'TRIP' + Math.random().toString(36).slice(2, 6).toUpperCase();
                      setSyncDraft(code);
                    }}>Generate new code</button>

                    {isSyncing && (
                      <button className="link-btn" onClick={() => { handleShareTrip(); setSyncOpen(false); }}>
                        <FaLink size={10} /> {shareTooltip || 'Copy share link'}
                      </button>
                    )}
                    {isSyncing && (
                      <button className="link-btn" onClick={() => { handleForceRefresh(); setSyncOpen(false); }}>
                        <FaSync size={10} /> Pull latest
                      </button>
                    )}
                  </div>

                  {isSyncing && (
                    <div className="sync-pop-foot">
                      <button className="link-btn danger" onClick={() => { handleLeaveTrip(); setSyncOpen(false); }}>Disconnect</button>
                    </div>
                  )}

                  {!isTripSyncAvailable && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8 }}>Firebase not configured — sync unavailable.</div>
                  )}
                </div>
              )}
            </div>

            {/* Votes */}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowVoteSummary(true)}>
              <FaPoll size={12} /> Votes
            </button>

            {/* Settings */}
            <button className="btn btn-icon" onClick={() => setShowSettingsDrawer(true)} title="Settings">
              <FaCog size={14} />
            </button>

            {/* Person chip */}
            <div ref={personRef} style={{ position: 'relative' }}>
              <button className="person-chip" onClick={() => setPersonMenuOpen(o => !o)} aria-expanded={personMenuOpen}>
                <span className="avatar" style={{ background: '#3a6b8c' }}>{currentPerson ? initials(currentPerson) : '?'}</span>
                <span>{currentPerson || 'Select person'}</span>
                <FaChevronDown size={10} style={{ opacity: 0.5, marginLeft: 2 }} />
              </button>
              {personMenuOpen && (
                <div className="person-menu">
                  <div style={{ padding: '4px 8px 8px', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    Voting as
                  </div>
                  {tripMembers.map((name) => (
                    <div
                      key={name}
                      className={`menu-item${name === currentPerson ? ' is-current' : ''}`}
                      onClick={() => { setCurrentPerson(name); setPersonMenuOpen(false); }}
                    >
                      <span className="avatar" style={{ width: 22, height: 22, background: '#3a6b8c', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'white', fontSize: 10, fontWeight: 600 }}>
                        {initials(name)}
                      </span>
                      <span>{name}</span>
                    </div>
                  ))}
                  <div className="menu-item add">
                    <input
                      className="input input-inline"
                      placeholder="Add yourself…"
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPersonName.trim()) {
                          handleAddTripMember(newPersonName.trim());
                          setCurrentPerson(newPersonName.trim());
                          setNewPersonName('');
                          setPersonMenuOpen(false);
                        }
                      }}
                      style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      {activeDestination ? (
        <main className="page">
          <div className="main-col">
            <DestinationView
              destination={activeDestination}
              onUpdate={handleUpdateDestination}
              settings={settings}
              votes={votes}
              currentPerson={currentPerson}
              onToggleVote={handleToggleVote}
              onSectionChange={setActiveSection}
            />
          </div>

          <aside className="aside-col">
            {/* Map card */}
            <div className="aside-card map-card">
              <div className="map-container">
                <MapComponent
                  destLat={activeDestination.latitude}
                  destLng={activeDestination.longitude}
                  destName={activeDestination.name}
                />
              </div>
              <div className="map-meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaPlane size={12} style={{ color: 'var(--ink-3)' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Dublin → {activeDestination.name}</span>
                </div>
              </div>
            </div>

            {/* Budget card */}
            <div className="aside-card budget-card">
              <h3>Budget overview</h3>
              {(() => {
                const totalFlightCost = activeDestination.flights.length > 0
                  ? Math.min(...activeDestination.flights.map(f => f.pricePerPerson)) * settings.peopleCount
                  : 0;
                const totalAccCost = activeDestination.accommodations.length > 0
                  ? Math.min(...activeDestination.accommodations.map(a => a.totalPrice))
                  : 0;
                const total = totalFlightCost + totalAccCost;
                const remaining = settings.totalBudget - total;
                const pct = settings.totalBudget > 0 ? Math.min(100, Math.round((total / settings.totalBudget) * 100)) : 0;
                return (
                  <>
                    <div className="totals">
                      <div className="num">{formatCurrency(total)}</div>
                      <div className="of">of {formatCurrency(settings.totalBudget)}</div>
                    </div>
                    <div className="budget-bar"><div className="fill" style={{ width: pct + '%' }} /></div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{pct}% used</span>
                      <span style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--positive)' }}>
                        {remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`}
                      </span>
                    </div>
                    <div className="budget-rows">
                      <div className="budget-row">
                        <span>Cheapest flights × {settings.peopleCount}</span>
                        <span className="v">{formatCurrency(totalFlightCost)}</span>
                      </div>
                      <div className="budget-row">
                        <span>Cheapest stay</span>
                        <span className="v">{formatCurrency(totalAccCost)}</span>
                      </div>
                      <div className="budget-row" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 6 }}>
                        <span>Per person</span>
                        <span className="v">{formatCurrency(settings.peopleCount > 0 ? Math.round(total / settings.peopleCount) : 0)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Notes card */}
            <div className="aside-card notes-card">
              <h3>Notes</h3>
              <textarea
                className="notes-area"
                value={activeDestination.notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Anything the team should know about this destination…"
              />
            </div>

            {/* Data export */}
            <div className="aside-card" style={{ padding: 16 }}>
              <DataPersistence destinations={destinations} onImport={handleImport} />
            </div>
          </aside>
        </main>
      ) : (
        <main className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '70vh' }}>
          <section className="empty-state" aria-label="No destination selected">
            <div>
              <div className="empty-state-icon">
                <FaPlane size={36} />
              </div>
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Start a trip workspace</h3>
              <p className="subtle-text" style={{ marginBottom: 24 }}>Create a destination, add flights and stay options, then vote on favorites.</p>
              <button className="btn btn-accent" style={{ padding: '12px 24px', fontSize: 16 }} onClick={() => setShowAddModal(true)}>
                <FaPlus style={{ marginRight: 8 }} /> Add Destination
              </button>
            </div>
          </section>
        </main>
      )}

      {/* ── Modals ── */}
      <AddDestinationModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onAdd={handleAddDestination}
      />

      {/* Settings modal */}
      <Modal show={showSettingsDrawer} onHide={() => setShowSettingsDrawer(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
            <div className="field">
              <label>Total budget</label>
              <input className="input" type="number" value={settings.totalBudget} onChange={(e) => handleTotalBudgetChange(e.target.value)} />
            </div>
            <div className="field">
              <label>People on the trip</label>
              <input className="input" type="number" value={settings.peopleCount} onChange={(e) => handlePeopleCountChange(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h5 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>Search providers</h5>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Templates use {'{destination} {origin} {startDate} {endDate} {people}'}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleSearchLinkAdd}>
              <FaPlus size={10} /> Add provider
            </button>
          </div>

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
                    <Form.Check type="switch" checked={link.enabled} onChange={(e) => handleSearchLinkUpdate(link.id, { enabled: e.target.checked })} />
                  </td>
                  <td><Form.Control size="sm" value={link.label} onChange={(e) => handleSearchLinkUpdate(link.id, { label: e.target.value })} /></td>
                  <td>
                    <Form.Select size="sm" value={link.type} onChange={(e) => handleSearchLinkUpdate(link.id, { type: e.target.value as 'flight' | 'accommodation' })}>
                      <option value="flight">Flight</option>
                      <option value="accommodation">Stay</option>
                    </Form.Select>
                  </td>
                  <td><Form.Control size="sm" value={link.urlTemplate} onChange={(e) => handleSearchLinkUpdate(link.id, { urlTemplate: e.target.value })} /></td>
                  <td className="text-center align-middle">
                    <button className="btn btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleSearchLinkRemove(link.id)}><FaTrash size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={handleSearchLinksReset}>Reset to Defaults</button>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-ghost" onClick={() => setShowSettingsDrawer(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => setShowSettingsDrawer(false)}>Done</button>
        </Modal.Footer>
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
          <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 0 }}>
            You can use the Export button to save your current data before joining.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-ghost" onClick={handleCancelJoin}>Cancel</button>
          <button className="btn btn-accent" onClick={handleConfirmJoin}>Join Trip</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
