import React, { useMemo, useState } from 'react';
import { Form, Modal, Table, InputGroup, Button } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Flight, SearchLinkTemplate } from '../types';
import {
  FaTrash,
  FaExternalLinkAlt,
  FaPlus,
  FaPlaneDeparture,
  FaEdit,
  FaSave,
  FaClone,
  FaClipboard,
  FaListUl,
  FaSearch,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { getUrlAutofill } from '../utils/urlAutofill';
import DateRangePicker from './DateRangePicker';
import { formatCurrency } from '../utils/budget';
import { getFlightSearchLinks } from '../utils/bookingLinks';
import VoteButton from './VoteButton';
import ClockTimePicker from './ClockTimePicker';

/* ------------------------------------------------------------------ */
/*  Props & types                                                      */
/* ------------------------------------------------------------------ */

interface Props {
  flights: Flight[];
  onChange: (flights: Flight[]) => void;
  draft: Partial<Flight>;
  onDraftChange: (draft: Partial<Flight>) => void;
  destinationName: string;
  searchLinks: SearchLinkTemplate[];
  votes: Record<string, string[]>;
  currentPerson: string;
  onToggleVote: (flightId: string) => void;
}

interface FlightGroup {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  flights: Flight[];
}

interface ParsedBulkFlight {
  lineNumber: number;
  description: string;
  pricePerPerson: number;
  link: string;
  startDate: string;
  endDate: string;
  error: string;
}

type SortBy = 'price' | 'description' | 'startDate' | 'dateAdded';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const fmtDateRange = (start: string, end: string): string => {
  if (!start || !end) return `${start || 'No start'} to ${end || 'No end'}`;
  const da = new Date(start + 'T00:00');
  const db = new Date(end + 'T00:00');
  const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const aStr = da.toLocaleDateString('en-GB', opts);
  const bStr = sameMonth ? String(db.getDate()) : db.toLocaleDateString('en-GB', opts);
  return `${aStr} – ${bStr}`;
};

const nightsBetween = (a: string, b: string): number =>
  Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

const parseBulkFlights = (bulkInput: string): ParsedBulkFlight[] => {
  return bulkInput
    .split('\n')
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => Boolean(line))
    .map(({ line, lineNumber }) => {
      const [description = '', rawPrice = '', link = '', startDate = '', endDate = ''] = line
        .split(',')
        .map((part) => part.trim());
      const pricePerPerson = Number(rawPrice);

      if (!link || !Number.isFinite(pricePerPerson) || pricePerPerson <= 0) {
        return {
          lineNumber,
          description,
          pricePerPerson: Number.isFinite(pricePerPerson) ? pricePerPerson : 0,
          link,
          startDate,
          endDate,
          error: 'Expected: description, price, link, startDate, endDate'
        };
      }

      return { lineNumber, description, pricePerPerson, link, startDate, endDate, error: '' };
    });
};

/** Best-effort short code from an origin string like "Dublin" -> "DUB" */
const toIata = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '???';
  // Already looks like a 3-letter code
  if (/^[A-Z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
  // Common cities -> codes
  const map: Record<string, string> = {
    dublin: 'DUB', london: 'LDN', paris: 'CDG', rome: 'FCO', berlin: 'BER',
    amsterdam: 'AMS', barcelona: 'BCN', madrid: 'MAD', lisbon: 'LIS',
    milan: 'MXP', vienna: 'VIE', prague: 'PRG', budapest: 'BUD',
    athens: 'ATH', copenhagen: 'CPH', stockholm: 'ARN', oslo: 'OSL',
    brussels: 'BRU', munich: 'MUC', frankfurt: 'FRA', zurich: 'ZRH',
    warsaw: 'WAW', krakow: 'KRK', porto: 'OPO', nice: 'NCE',
    edinburgh: 'EDI', manchester: 'MAN', birmingham: 'BHX',
    malaga: 'AGP', alicante: 'ALC', faro: 'FAO', split: 'SPU',
    dubrovnik: 'DBV', naples: 'NAP', palma: 'PMI', ibiza: 'IBZ',
    tenerife: 'TFS', lanzarote: 'ACE', rhodes: 'RHO', corfu: 'CFU',
    santorini: 'JTR', thessaloniki: 'SKG', lyon: 'LYS', bordeaux: 'BOD',
    toulouse: 'TLS', marseille: 'MRS', bologna: 'BLQ', venice: 'VCE',
    pisa: 'PSA', turin: 'TRN', gdansk: 'GDN', riga: 'RIX',
    tallinn: 'TLL', vilnius: 'VNO', helsinki: 'HEL', reykjavik: 'KEF',
  };
  const lower = trimmed.toLowerCase();
  if (map[lower]) return map[lower];
  // Fallback: first 3 chars uppercased
  return trimmed.slice(0, 3).toUpperCase();
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const FlightManager: React.FC<Props> = ({
  flights,
  onChange,
  draft,
  onDraftChange,
  destinationName,
  searchLinks,
  votes,
  currentPerson,
  onToggleVote
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Flight>>({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [searchQuery] = useState('');
  const [maxPrice] = useState<string>('');
  const [sortBy] = useState<SortBy>('price');
  const [sortDirection] = useState<'asc' | 'desc'>('asc');
  const [pendingClearGroup, setPendingClearGroup] = useState<FlightGroup | null>(null);
  const [openQuickAddKeys, setOpenQuickAddKeys] = useState<Set<string>>(new Set());
  const [groupDrafts, setGroupDrafts] = useState<Record<string, Partial<Flight>>>({});
  const [groupAttemptedAdd, setGroupAttemptedAdd] = useState<Record<string, boolean>>({});

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-01-01`;
  const parsedBulkFlights = useMemo(() => parseBulkFlights(bulkInput), [bulkInput]);
  const validBulkFlights = parsedBulkFlights.filter((row) => !row.error);

  /* ---- draft helpers (top-level add form uses props-based draft) ---- */

  const setDraftValue = (updates: Partial<Flight>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const getGroupDraft = (groupKey: string): Partial<Flight> => groupDrafts[groupKey] || {};

  const setGroupDraftValue = (groupKey: string, updates: Partial<Flight>) => {
    setGroupDrafts((prev) => ({ ...prev, [groupKey]: { ...prev[groupKey], ...updates } }));
  };

  /* ---- CRUD ---- */

  const addFlight = (source: Partial<Flight>, groupKey?: string) => {
    if (!(source.link && typeof source.pricePerPerson === 'number' && source.pricePerPerson > 0)) {
      return false;
    }

    const flight: Flight = {
      id: uuidv4(),
      link: source.link,
      description: source.description || '',
      startDate: source.startDate || '',
      endDate: source.endDate || '',
      departureTime: source.departureTime || '',
      arrivalTime: source.arrivalTime || '',
      origin: source.origin || 'Dublin',
      pricePerPerson: Number(source.pricePerPerson),
      createdAt: Date.now()
    };

    onChange([...flights, flight]);

    if (groupKey) {
      setGroupDrafts((prev) => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
      setGroupAttemptedAdd((prev) => ({ ...prev, [groupKey]: false }));
    } else {
      onDraftChange({});
    }

    return true;
  };

  const handleAdd = (focusNext = false) => {
    const ok = addFlight(draft);
    if (!ok) return;
    if (focusNext) {
      // Allow DOM to update before focusing
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('.section-head .qa-grid input')?.focus();
      }, 0);
    }
  };

  const handleRemove = (id: string) => {
    onChange(flights.filter((f) => f.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleDuplicate = (flight: Flight) => {
    onChange([
      ...flights,
      {
        ...flight,
        id: uuidv4(),
        description: flight.description ? `${flight.description} (Copy)` : 'Flight Option (Copy)',
        createdAt: Date.now()
      }
    ]);
  };

  const startEdit = (flight: Flight) => {
    setEditingId(flight.id);
    setEditForm(flight);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!(editingId && editForm.link && editForm.pricePerPerson)) return;

    onChange(
      flights.map((f) =>
        f.id !== editingId
          ? f
          : ({ ...f, ...editForm, pricePerPerson: Number(editForm.pricePerPerson), updatedAt: Date.now() } as Flight)
      )
    );
    cancelEdit();
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLElement>, groupKey?: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (groupKey) {
      const gDraft = getGroupDraft(groupKey);
      if (!(gDraft.link && typeof gDraft.pricePerPerson === 'number' && gDraft.pricePerPerson > 0)) {
        setGroupAttemptedAdd((prev) => ({ ...prev, [groupKey]: true }));
        return;
      }
      addFlight(gDraft, groupKey);
    } else {
      handleAdd(Boolean(e.metaKey || e.ctrlKey));
    }
  };

  const handlePasteAutofill = async (groupKey?: string) => {
    if (!navigator.clipboard?.readText) return;
    const clipboardText = (await navigator.clipboard.readText()).trim();
    const autofill = getUrlAutofill(clipboardText);
    if (!autofill) return;

    if (groupKey) {
      const gd = getGroupDraft(groupKey);
      setGroupDraftValue(groupKey, {
        link: autofill.link,
        description: gd.description || `${autofill.providerName} Option`,
        startDate: gd.startDate || autofill.startDate,
        endDate: gd.endDate || autofill.endDate,
        pricePerPerson: typeof gd.pricePerPerson === 'number' ? gd.pricePerPerson : autofill.amount
      });
    } else {
      setDraftValue({
        link: autofill.link,
        description: draft.description || `${autofill.providerName} Option`,
        startDate: draft.startDate || autofill.startDate,
        endDate: draft.endDate || autofill.endDate,
        pricePerPerson: typeof draft.pricePerPerson === 'number' ? draft.pricePerPerson : autofill.amount
      });
    }
  };

  const handleBulkImport = () => {
    if (validBulkFlights.length === 0) return;

    const imported = validBulkFlights.map((row) => ({
      id: uuidv4(),
      description: row.description,
      pricePerPerson: row.pricePerPerson,
      link: row.link,
      startDate: row.startDate,
      endDate: row.endDate,
      departureTime: '',
      arrivalTime: '',
      origin: '',
      createdAt: Date.now()
    }));

    onChange([...flights, ...imported]);
    setBulkInput('');
    setShowBulkModal(false);
  };

  /* ---- derived data ---- */

  const displayedFlights = useMemo(() => {
    const parsedMaxPrice = Number(maxPrice);
    const hasMaxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0;
    const query = searchQuery.trim().toLowerCase();

    const filtered = flights.filter((f) => {
      const matchesQuery =
        query.length === 0 || f.description.toLowerCase().includes(query) || f.link.toLowerCase().includes(query);
      const matchesPrice = !hasMaxPrice || f.pricePerPerson <= parsedMaxPrice;
      return matchesQuery && matchesPrice;
    });

    return filtered.sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortBy === 'price') return (a.pricePerPerson - b.pricePerPerson) * dir;
      if (sortBy === 'startDate') {
        return (a.startDate || '9999-12-31').localeCompare(b.startDate || '9999-12-31') * dir;
      }
      if (sortBy === 'dateAdded') return ((a.createdAt ?? 0) - (b.createdAt ?? 0)) * dir;
      return (a.description || '').localeCompare(b.description || '') * dir;
    });
  }, [flights, maxPrice, searchQuery, sortBy, sortDirection]);

  const flightGroups = useMemo((): FlightGroup[] => {
    const groupMap = new Map<string, Flight[]>();
    for (const f of displayedFlights) {
      const key = `${f.startDate || 'no-start'}|${f.endDate || 'no-end'}`;
      const existing = groupMap.get(key);
      if (existing) existing.push(f);
      else groupMap.set(key, [f]);
    }
    return Array.from(groupMap.entries()).map(([key, groupFlights]) => {
      const first = groupFlights[0];
      return {
        key,
        label: fmtDateRange(first.startDate, first.endDate),
        startDate: first.startDate,
        endDate: first.endDate,
        flights: groupFlights
      };
    });
  }, [displayedFlights]);

  /* ---- quick-add toggle per group ---- */

  const toggleQuickAdd = (groupKey: string) => {
    setOpenQuickAddKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
        // Clear draft for this group
        setGroupDrafts((d) => {
          const nd = { ...d };
          delete nd[groupKey];
          return nd;
        });
        setGroupAttemptedAdd((d) => ({ ...d, [groupKey]: false }));
      } else {
        next.add(groupKey);
        // Prefill dates from the group
        const group = flightGroups.find((g) => g.key === groupKey);
        if (group) {
          setGroupDrafts((d) => ({
            ...d,
            [groupKey]: { startDate: group.startDate, endDate: group.endDate }
          }));
        }
      }
      return next;
    });
  };

  const destIata = toIata(destinationName);

  /* ---- render helpers ---- */

  const renderEditForm = (flight: Flight) => (
    <div className="flight-card" key={flight.id}>
      <div className="qa-grid">
        <Form.Group>
          <Form.Label className="small text-muted mb-1">Description</Form.Label>
          <Form.Control
            size="sm"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
        </Form.Group>
        <Form.Group>
          <Form.Label className="small text-muted mb-1">Origin</Form.Label>
          <Form.Control
            size="sm"
            placeholder="Dublin"
            value={editForm.origin || ''}
            onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })}
          />
        </Form.Group>
        <DateRangePicker
          startDate={editForm.startDate || ''}
          endDate={editForm.endDate || ''}
          minDate={minDate}
          onChange={(s, e) => setEditForm({ ...editForm, startDate: s, endDate: e })}
        />
        <ClockTimePicker
          label="Departs at"
          value={editForm.departureTime || ''}
          onChange={(t) => setEditForm({ ...editForm, departureTime: t })}
        />
        <ClockTimePicker
          label="Arrives at"
          value={editForm.arrivalTime || ''}
          onChange={(t) => setEditForm({ ...editForm, arrivalTime: t })}
        />
        <Form.Group>
          <Form.Label className="small text-muted mb-1">Link</Form.Label>
          <InputGroup size="sm">
            <Form.Control
              placeholder="https://..."
              value={editForm.link || ''}
              onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
            />
            {editForm.link && (
              <a
                href={editForm.link}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-secondary btn-sm"
                title="Open link"
              >
                <FaExternalLinkAlt size={11} />
              </a>
            )}
          </InputGroup>
        </Form.Group>
        <Form.Group>
          <Form.Label className="small text-muted mb-1">Price / Person</Form.Label>
          <Form.Control
            size="sm"
            type="number"
            step="10"
            min="0"
            value={editForm.pricePerPerson ?? ''}
            onChange={(e) =>
              setEditForm({ ...editForm, pricePerPerson: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </Form.Group>
      </div>
      <div className="qa-actions">
        <button type="button" className="btn btn-sm btn-accent" onClick={saveEdit}>
          <FaSave size={11} /> Save
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={cancelEdit}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderFlightCard = (flight: Flight) => {
    if (editingId === flight.id) return renderEditForm(flight);

    const fromCode = toIata(flight.origin || 'Dublin');
    const toCode = destIata;
    const voters = votes[flight.id] || [];

    return (
      <div className={`flight-card${currentPerson && voters.includes(currentPerson) ? ' is-voted' : ''}`} key={flight.id}>
        {/* Route */}
        <div className="flight-route">
          <span className="iata">{fromCode}</span>
          <span className="arrow">
            <span className="plane">✈</span>
          </span>
          <span className="iata">{toCode}</span>
        </div>

        {/* Times */}
        {(flight.departureTime || flight.arrivalTime) && (
          <div className="flight-times">
            <div className="time">
              <span className="label">Depart</span>
              {flight.departureTime || '—'}
            </div>
            <div className="time right">
              <span className="label">Arrive</span>
              {flight.arrivalTime || '—'}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="flight-desc">
          {flight.description || 'Flight Option'}
          {flight.createdAt && (
            <span className="subtle-text" style={{ marginLeft: 8, fontSize: '0.75rem' }} title={new Date(flight.createdAt).toLocaleString()}>
              {formatTimeAgo(flight.createdAt)}
            </span>
          )}
          {flight.updatedAt && (
            <span className="subtle-text" style={{ marginLeft: 8, fontSize: '0.75rem' }} title={new Date(flight.updatedAt).toLocaleString()}>
              edited {formatTimeAgo(flight.updatedAt)}
            </span>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flight-bottom">
          <div className="flight-price">
            <span className="amount">{formatCurrency(flight.pricePerPerson)}</span>
            <span className="per">per person</span>
          </div>
          <div className="flight-bottom-right">
            <div className="card-actions">
              {flight.link && (
                <a
                  href={flight.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-icon btn-xs btn-ghost"
                  title="Open booking link"
                >
                  <FaExternalLinkAlt size={11} />
                </a>
              )}
              <button
                type="button"
                className="btn btn-icon btn-xs btn-ghost"
                onClick={() => startEdit(flight)}
                title="Edit"
              >
                <FaEdit size={11} />
              </button>
              <button
                type="button"
                className="btn btn-icon btn-xs btn-ghost"
                onClick={() => handleDuplicate(flight)}
                title="Duplicate"
              >
                <FaClone size={11} />
              </button>
              <button
                type="button"
                className="btn btn-icon btn-xs btn-ghost"
                onClick={() => handleRemove(flight.id)}
                title="Delete"
                style={{ color: 'var(--danger)' }}
              >
                <FaTrash size={11} />
              </button>
            </div>
            <VoteButton voters={voters} currentPerson={currentPerson} onToggle={() => onToggleVote(flight.id)} />
          </div>
        </div>
      </div>
    );
  };

  const renderInlineQuickAdd = (groupKey: string) => {
    const isOpen = openQuickAddKeys.has(groupKey);
    const gd = getGroupDraft(groupKey);
    const attempted = groupAttemptedAdd[groupKey] || false;
    const gdLinkValid = Boolean(gd.link);
    const gdPriceValid = typeof gd.pricePerPerson === 'number' && gd.pricePerPerson > 0;

    return (
      <div
        className={`quick-add${isOpen ? ' is-open' : ''}`}
        onClick={() => !isOpen && toggleQuickAdd(groupKey)}
        role={isOpen ? undefined : 'button'}
        tabIndex={isOpen ? undefined : 0}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'Enter' || e.key === ' ')) toggleQuickAdd(groupKey);
        }}
      >
        {!isOpen ? (
          <span className="qa-hint">
            <FaPlus size={11} /> Add a flight
          </span>
        ) : (
          <>
            <div className="qa-grid">
              <Form.Group>
                <Form.Label className="small text-muted mb-1">Description</Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="Ryanair Morning"
                  value={gd.description || ''}
                  onChange={(e) => setGroupDraftValue(groupKey, { description: e.target.value })}
                  onKeyDown={(e) => handleQuickAddKeyDown(e, groupKey)}
                  autoFocus
                />
              </Form.Group>
              <Form.Group>
                <Form.Label className="small text-muted mb-1">Origin</Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="Dublin"
                  value={gd.origin || ''}
                  onChange={(e) => setGroupDraftValue(groupKey, { origin: e.target.value })}
                  onKeyDown={(e) => handleQuickAddKeyDown(e, groupKey)}
                />
              </Form.Group>
              <DateRangePicker
                startDate={gd.startDate || ''}
                endDate={gd.endDate || ''}
                minDate={minDate}
                onChange={(s, e) => setGroupDraftValue(groupKey, { startDate: s, endDate: e })}
              />
              <ClockTimePicker
                label="Departs at"
                value={gd.departureTime || ''}
                onChange={(t) => setGroupDraftValue(groupKey, { departureTime: t })}
              />
              <ClockTimePicker
                label="Arrives at"
                value={gd.arrivalTime || ''}
                onChange={(t) => setGroupDraftValue(groupKey, { arrivalTime: t })}
              />
              <Form.Group>
                <Form.Label className="small text-muted mb-1">Link</Form.Label>
                <InputGroup size="sm">
                  <Form.Control
                    placeholder="https://..."
                    value={gd.link || ''}
                    isInvalid={attempted && !gdLinkValid}
                    onChange={(e) => setGroupDraftValue(groupKey, { link: e.target.value })}
                    onKeyDown={(e) => handleQuickAddKeyDown(e, groupKey)}
                  />
                  <Button variant="outline-secondary" size="sm" onClick={() => handlePasteAutofill(groupKey)} title="Paste URL and autofill">
                    <FaClipboard />
                  </Button>
                </InputGroup>
              </Form.Group>
              <Form.Group>
                <Form.Label className="small text-muted mb-1">Price / Person</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  inputMode="numeric"
                  step="10"
                  min="0"
                  placeholder="0"
                  value={gd.pricePerPerson ?? ''}
                  isInvalid={attempted && !gdPriceValid}
                  onChange={(e) =>
                    setGroupDraftValue(groupKey, {
                      pricePerPerson: e.target.value === '' ? undefined : Number(e.target.value)
                    })
                  }
                  onKeyDown={(e) => handleQuickAddKeyDown(e, groupKey)}
                />
              </Form.Group>
            </div>
            {attempted && (!gdLinkValid || !gdPriceValid) && (
              <div className="inline-status error" role="status">
                Link and price per person are required.
              </div>
            )}
            <div className="qa-actions">
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => {
                  if (!(gd.link && typeof gd.pricePerPerson === 'number' && gd.pricePerPerson > 0)) {
                    setGroupAttemptedAdd((prev) => ({ ...prev, [groupKey]: true }));
                    return;
                  }
                  addFlight(gd, groupKey);
                  toggleQuickAdd(groupKey);
                }}
              >
                <FaPlus size={11} /> Add
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => toggleQuickAdd(groupKey)}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderGroup = (group: FlightGroup) => {
    const groupSearchLinks = getFlightSearchLinks(
      searchLinks,
      group.flights[0]?.origin || '',
      destinationName,
      group.startDate,
      group.endDate
    );

    const nights =
      group.startDate && group.endDate ? nightsBetween(group.startDate, group.endDate) : null;

    return (
      <div className="group" key={group.key}>
        <div className="group-head">
          <div className="dates">
            <span>{group.label}</span>
            {nights !== null && (
              <>
                <span className="dot-sep" />
                <span className="nights">
                  {nights} night{nights !== 1 ? 's' : ''}
                </span>
              </>
            )}
            <span className="dot-sep" />
            <span className="nights">{group.flights.length} flight{group.flights.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="group-actions">
            <div className="search-links">
              {groupSearchLinks.map((sl) => (
                <a
                  key={sl.label}
                  href={sl.url}
                  target="_blank"
                  rel="noreferrer"
                  className="link-chip"
                  title="Link may not pre-fill correctly — work in progress"
                >
                  <FaSearch size={10} /> {sl.label}
                </a>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => toggleQuickAdd(group.key)}
              title="Add another flight to this group"
            >
              <FaPlus size={10} /> Add
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setPendingClearGroup(group)}
              title="Clear this group"
              style={{ color: 'var(--danger)' }}
            >
              <FaTrash size={10} />
            </button>
          </div>
        </div>

        <div className="group-body">
          {group.flights.map(renderFlightCard)}
          {renderInlineQuickAdd(group.key)}
        </div>
      </div>
    );
  };

  /* ---- top-level add form ---- */

  const isDraftLinkValid = Boolean(draft.link);
  const isDraftPriceValid = typeof draft.pricePerPerson === 'number' && draft.pricePerPerson > 0;
  const isDraftValid = isDraftLinkValid && isDraftPriceValid;
  const [attemptedAdd, setAttemptedAdd] = useState(false);

  const handleTopAdd = (focusNext = false) => {
    setAttemptedAdd(true);
    if (!isDraftValid) return;
    handleAdd(focusNext);
    setAttemptedAdd(false);
  };

  const handleTopKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleTopAdd(Boolean(e.metaKey || e.ctrlKey));
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <>
      <div className="section">
        {/* Section header */}
        <div className="section-head">
          <div className="section-title">
            <FaPlaneDeparture aria-hidden="true" />
            <h2>Flight Options</h2>
            <span className="section-sub">{flights.length}</span>
          </div>
          <div className="section-actions">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowBulkModal(true)}>
              <FaListUl size={11} /> Bulk Add
            </button>
          </div>
        </div>

        {/* Top-level quick-add form */}
        <div className="group" style={{ marginBottom: '16px' }}>
          <div className="group-head">
            <div className="dates">New flight</div>
          </div>
          <div className="group-body">
            <div className="quick-add is-open" style={{ border: 'none' }}>
              <div className="qa-grid">
                <Form.Group>
                  <Form.Label className="small text-muted mb-1">Description</Form.Label>
                  <Form.Control
                    size="sm"
                    placeholder="Ryanair Morning"
                    value={draft.description || ''}
                    onChange={(e) => setDraftValue({ description: e.target.value })}
                    onKeyDown={handleTopKeyDown}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label className="small text-muted mb-1">Origin</Form.Label>
                  <Form.Control
                    size="sm"
                    placeholder="Dublin"
                    value={draft.origin || ''}
                    onChange={(e) => setDraftValue({ origin: e.target.value })}
                    onKeyDown={handleTopKeyDown}
                  />
                </Form.Group>
                <DateRangePicker
                  startDate={draft.startDate || ''}
                  endDate={draft.endDate || ''}
                  minDate={minDate}
                  onChange={(s, e) => setDraftValue({ startDate: s, endDate: e })}
                />
                <ClockTimePicker
                  label="Departs at"
                  value={draft.departureTime || ''}
                  onChange={(t) => setDraftValue({ departureTime: t })}
                />
                <ClockTimePicker
                  label="Arrives at"
                  value={draft.arrivalTime || ''}
                  onChange={(t) => setDraftValue({ arrivalTime: t })}
                />
                <Form.Group>
                  <Form.Label className="small text-muted mb-1">Link</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control
                      placeholder="https://..."
                      value={draft.link || ''}
                      isInvalid={attemptedAdd && !isDraftLinkValid}
                      onChange={(e) => setDraftValue({ link: e.target.value })}
                      onKeyDown={handleTopKeyDown}
                    />
                    <Button variant="outline-secondary" size="sm" onClick={() => handlePasteAutofill()} title="Paste URL and autofill fields">
                      <FaClipboard />
                    </Button>
                  </InputGroup>
                </Form.Group>
                <Form.Group>
                  <Form.Label className="small text-muted mb-1">Price / Person</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    inputMode="numeric"
                    step="10"
                    min="0"
                    placeholder="0"
                    value={draft.pricePerPerson ?? ''}
                    isInvalid={attemptedAdd && !isDraftPriceValid}
                    onChange={(e) =>
                      setDraftValue({ pricePerPerson: e.target.value === '' ? undefined : Number(e.target.value) })
                    }
                    onKeyDown={handleTopKeyDown}
                  />
                </Form.Group>
              </div>
              {attemptedAdd && (!isDraftLinkValid || !isDraftPriceValid) && (
                <div className="inline-status error" role="status">
                  Link and price per person are required.
                </div>
              )}
              <div className="qa-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() => handleTopAdd(false)}
                  disabled={!isDraftValid && !attemptedAdd}
                >
                  <FaPlus size={11} /> Add Flight
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Flight groups */}
        {flightGroups.length > 0 ? (
          flightGroups.map(renderGroup)
        ) : displayedFlights.length === 0 ? (
          <div className="group">
            <div className="group-body" style={{ padding: '24px', textAlign: 'center' }}>
              <div className="empty-inline-state">
                {flights.length === 0
                  ? 'No flights yet. Use the form above to add your first flight option, or paste a booking URL to autofill.'
                  : 'No matching flights. Adjust filters or add a new option.'}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bulk import modal */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Add Flights</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="fw-semibold">Paste one flight per line</Form.Label>
          <Form.Text className="d-block mb-2 text-muted">
            Format: description, price, link, startDate, endDate
          </Form.Text>
          <Form.Control
            as="textarea"
            rows={6}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="Ryanair Morning, 120, https://example.com, 2026-04-10, 2026-04-12"
          />

          {parsedBulkFlights.length > 0 && (
            <div className="mt-3">
              <div className="small text-muted mb-2">
                Valid rows: {validBulkFlights.length} / {parsedBulkFlights.length}
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <Table size="sm" bordered>
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Link</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBulkFlights.map((row) => (
                      <tr key={`${row.lineNumber}-${row.link}`} className={row.error ? 'table-danger' : ''}>
                        <td>{row.lineNumber}</td>
                        <td>{row.description || '-'}</td>
                        <td>{row.pricePerPerson || '-'}</td>
                        <td className="text-truncate" style={{ maxWidth: '240px' }}>
                          {row.link || '-'}
                        </td>
                        <td className={row.error ? 'text-danger' : 'text-success'}>{row.error || 'Ready'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBulkModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleBulkImport} disabled={validBulkFlights.length === 0}>
            Import {validBulkFlights.length > 0 ? validBulkFlights.length : ''} Flights
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Clear group confirmation modal */}
      <Modal show={pendingClearGroup !== null} onHide={() => setPendingClearGroup(null)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <FaExclamationTriangle size={32} className="text-danger" />
          </div>
          <h5 className="fw-semibold mb-2">Clear flight group?</h5>
          <p className="text-muted mb-0">
            All <strong>{pendingClearGroup?.flights.length}</strong> flight
            {pendingClearGroup?.flights.length !== 1 ? 's' : ''} in{' '}
            <strong>{pendingClearGroup?.label}</strong> will be permanently removed.
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pt-0 pb-3 gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setPendingClearGroup(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (pendingClearGroup) {
                const idsToRemove = new Set(pendingClearGroup.flights.map((f) => f.id));
                onChange(flights.filter((f) => !idsToRemove.has(f.id)));
              }
              setPendingClearGroup(null);
            }}
          >
            Clear Group
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FlightManager;
