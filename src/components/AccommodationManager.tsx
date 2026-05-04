import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Modal, Form, Table, Badge, Button, InputGroup } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Accommodation, Flight, SearchLinkTemplate } from '../types';
import {
  FaTrash,
  FaEdit,
  FaSave,
  FaExternalLinkAlt,
  FaPlus,
  FaHotel,
  FaClone,
  FaClipboard,
  FaListUl,
  FaFilter,
  FaLayerGroup,
  FaSearch,
  FaTimes,
  FaLink,
  FaExclamationTriangle
} from 'react-icons/fa';
import { getUrlAutofill } from '../utils/urlAutofill';
import DateRangePicker from './DateRangePicker';
import { formatCurrency } from '../utils/budget';
import { getAccommodationSearchLinks } from '../utils/bookingLinks';
import VoteButton from './VoteButton';

interface Props {
  accommodations: Accommodation[];
  flights: Flight[];
  onChange: (acc: Accommodation[]) => void;
  draft: Partial<Accommodation>;
  onDraftChange: (draft: Partial<Accommodation>) => void;
  destinationName: string;
  searchLinks: SearchLinkTemplate[];
  peopleCount: number;
  votes: Record<string, string[]>;
  currentPerson: string;
  onToggleVote: (accId: string) => void;
  customGroupLinks: Record<string, Record<string, string>>;
  onCustomGroupLinksChange: (links: Record<string, Record<string, string>>) => void;
  stayLinks: { label: string; url: string }[];
  onStayLinksChange: (links: { label: string; url: string }[]) => void;
}

interface AccommodationGroup {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  accommodations: Accommodation[];
}

interface ParsedBulkAccommodation {
  lineNumber: number;
  description: string;
  totalPrice: number;
  link: string;
  startDate: string;
  endDate: string;
  error: string;
}

type SortBy = 'price' | 'description' | 'startDate' | 'dateAdded';
type ImageStatus = 'idle' | 'loading' | 'valid' | 'error';

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

const validateImageUrl = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (!url.trim()) { resolve(false); return; }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

const parseBulkAccommodations = (bulkInput: string): ParsedBulkAccommodation[] => {
  return bulkInput
    .split('\n')
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => Boolean(line))
    .map(({ line, lineNumber }) => {
      const [description = '', rawPrice = '', link = '', startDate = '', endDate = ''] = line.split(',').map((part) => part.trim());
      const totalPrice = Number(rawPrice);

      if (!link || !Number.isFinite(totalPrice) || totalPrice <= 0) {
        return {
          lineNumber,
          description,
          totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
          link,
          startDate,
          endDate,
          error: 'Expected: description, price, link, startDate, endDate'
        };
      }

      return {
        lineNumber,
        description,
        totalPrice,
        link,
        startDate,
        endDate,
        error: ''
      };
    });
};

const AccommodationManager: React.FC<Props> = ({
  accommodations,
  flights,
  onChange,
  draft,
  onDraftChange,
  destinationName,
  searchLinks,
  peopleCount,
  votes,
  currentPerson,
  onToggleVote,
  customGroupLinks,
  onCustomGroupLinksChange,
  stayLinks,
  onStayLinksChange
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Accommodation>>({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [attemptedAdd, setAttemptedAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [groupByDate, setGroupByDate] = useState(true);
  const [pendingClearGroup, setPendingClearGroup] = useState<AccommodationGroup | null>(null);

  const [editingGroupLink, setEditingGroupLink] = useState<{ groupKey: string; linkId: string; url: string } | null>(null);
  const [showAddStayLink, setShowAddStayLink] = useState(false);
  const [newStayLink, setNewStayLink] = useState({ label: '', url: '' });
  const [editingStayLinkIndex, setEditingStayLinkIndex] = useState<number | null>(null);
  const [editStayLink, setEditStayLink] = useState({ label: '', url: '' });

  const [draftImageStatus, setDraftImageStatus] = useState<ImageStatus>('idle');
  const [editImageStatus, setEditImageStatus] = useState<ImageStatus>('idle');

  // Track which group quick-add forms are open
  const [openQuickAdd, setOpenQuickAdd] = useState<string | null>(null);
  // Per-group draft state for inline quick-add
  const [groupDraft, setGroupDraft] = useState<Partial<Accommodation>>({});
  const [groupAttemptedAdd, setGroupAttemptedAdd] = useState(false);
  const [groupDraftImageStatus, setGroupDraftImageStatus] = useState<ImageStatus>('idle');

  useEffect(() => {
    const url = draft.imageUrl || '';
    if (!url) { setDraftImageStatus('idle'); return; }
    setDraftImageStatus('loading');
    let cancelled = false;
    validateImageUrl(url).then((ok) => {
      if (!cancelled) setDraftImageStatus(ok ? 'valid' : 'error');
    });
    return () => { cancelled = true; };
  }, [draft.imageUrl]);

  useEffect(() => {
    const url = editForm.imageUrl || '';
    if (!url) { setEditImageStatus('idle'); return; }
    setEditImageStatus('loading');
    let cancelled = false;
    validateImageUrl(url).then((ok) => {
      if (!cancelled) setEditImageStatus(ok ? 'valid' : 'error');
    });
    return () => { cancelled = true; };
  }, [editForm.imageUrl]);

  useEffect(() => {
    const url = groupDraft.imageUrl || '';
    if (!url) { setGroupDraftImageStatus('idle'); return; }
    setGroupDraftImageStatus('loading');
    let cancelled = false;
    validateImageUrl(url).then((ok) => {
      if (!cancelled) setGroupDraftImageStatus(ok ? 'valid' : 'error');
    });
    return () => { cancelled = true; };
  }, [groupDraft.imageUrl]);

  const quickAddDescriptionRef = useRef<HTMLInputElement>(null);
  const groupDescriptionRef = useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-01-01`;
  const parsedBulkAccommodations = useMemo(() => parseBulkAccommodations(bulkInput), [bulkInput]);
  const validBulkAccommodations = parsedBulkAccommodations.filter((row) => !row.error);

  const suggestedDateRanges = useMemo(() => {
    const flightRangeKeys = new Set<string>();
    const ranges: { startDate: string; endDate: string; label: string }[] = [];
    for (const f of flights) {
      if (!f.startDate || !f.endDate) continue;
      const key = `${f.startDate}|${f.endDate}`;
      if (flightRangeKeys.has(key)) continue;
      flightRangeKeys.add(key);
      const hasAccommodation = accommodations.some(
        (a) => a.startDate === f.startDate && a.endDate === f.endDate
      );
      if (hasAccommodation) continue;
      const fmt = (d: string) => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
      };
      ranges.push({ startDate: f.startDate, endDate: f.endDate, label: `${fmt(f.startDate)} – ${fmt(f.endDate)}` });
    }
    return ranges;
  }, [flights, accommodations]);

  const draftSearchLinks = useMemo(() => {
    if (!draft.startDate || !draft.endDate) return [];
    return getAccommodationSearchLinks(searchLinks, destinationName, draft.startDate, draft.endDate, peopleCount);
  }, [draft.startDate, draft.endDate, searchLinks, destinationName, peopleCount]);

  const isDraftLinkValid = Boolean(draft.link);
  const isDraftPriceValid = typeof draft.totalPrice === 'number' && draft.totalPrice > 0;
  const isDraftImageValid = !draft.imageUrl || draftImageStatus === 'valid';

  const setDraftValue = (updates: Partial<Accommodation>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const handleAdd = (focusNext = false) => {
    setAttemptedAdd(true);
    if (!(draft.link && typeof draft.totalPrice === 'number' && draft.totalPrice > 0) || !isDraftImageValid) {
      return;
    }

    const acc: Accommodation = {
      id: uuidv4(),
      link: draft.link,
      description: draft.description || '',
      totalPrice: Number(draft.totalPrice),
      startDate: draft.startDate || '',
      endDate: draft.endDate || '',
      ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
      createdAt: Date.now(),
      ...(draft.rooms && draft.rooms > 0 ? { rooms: Math.min(draft.rooms, 50) } : {}),
      beds: Math.min((draft.beds != null && draft.beds > 0) ? draft.beds : peopleCount, 50)
    };

    onChange([...accommodations, acc]);
    onDraftChange({});
    setAttemptedAdd(false);

    if (focusNext) {
      setTimeout(() => {
        quickAddDescriptionRef.current?.focus();
      }, 0);
    }
  };

  const handleGroupAdd = (startDate: string, endDate: string, focusNext = false) => {
    setGroupAttemptedAdd(true);
    const isGroupImageValid = !groupDraft.imageUrl || groupDraftImageStatus === 'valid';
    if (!(groupDraft.link && typeof groupDraft.totalPrice === 'number' && groupDraft.totalPrice > 0) || !isGroupImageValid) {
      return;
    }

    const acc: Accommodation = {
      id: uuidv4(),
      link: groupDraft.link,
      description: groupDraft.description || '',
      totalPrice: Number(groupDraft.totalPrice),
      startDate,
      endDate,
      ...(groupDraft.imageUrl ? { imageUrl: groupDraft.imageUrl } : {}),
      createdAt: Date.now(),
      ...(groupDraft.rooms && groupDraft.rooms > 0 ? { rooms: Math.min(groupDraft.rooms, 50) } : {}),
      beds: Math.min((groupDraft.beds != null && groupDraft.beds > 0) ? groupDraft.beds : peopleCount, 50)
    };

    onChange([...accommodations, acc]);
    setGroupDraft({});
    setGroupAttemptedAdd(false);

    if (!focusNext) {
      setOpenQuickAdd(null);
    } else {
      setTimeout(() => {
        groupDescriptionRef.current?.focus();
      }, 0);
    }
  };

  const handleRemove = (id: string) => {
    onChange(accommodations.filter((accommodation) => accommodation.id !== id));
  };

  const handleDuplicate = (accommodation: Accommodation) => {
    onChange([
      ...accommodations,
      {
        ...accommodation,
        id: uuidv4(),
        description: accommodation.description ? `${accommodation.description} (Copy)` : 'Accommodation (Copy)',
        createdAt: Date.now()
      }
    ]);
  };

  const startEdit = (accommodation: Accommodation) => {
    setEditingId(accommodation.id);
    setEditForm(accommodation);
    setEditImageStatus(accommodation.imageUrl ? 'valid' : 'idle');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setEditImageStatus('idle');
  };

  const saveEdit = () => {
    if (!(editingId && editForm.link && editForm.totalPrice)) {
      return;
    }
    if (editForm.imageUrl && editImageStatus !== 'valid') {
      return;
    }

    const updated = accommodations.map((accommodation) => {
      if (accommodation.id !== editingId) {
        return accommodation;
      }

      return {
        ...accommodation,
        ...editForm,
        totalPrice: Number(editForm.totalPrice),
        rooms: editForm.rooms && editForm.rooms > 0 ? editForm.rooms : undefined,
        beds: editForm.beds && editForm.beds > 0 ? editForm.beds : undefined,
        updatedAt: Date.now()
      } as Accommodation;
    });

    onChange(updated);
    cancelEdit();
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleAdd(Boolean(e.metaKey || e.ctrlKey));
  };

  const handleGroupQuickAddKeyDown = (e: React.KeyboardEvent<HTMLElement>, startDate: string, endDate: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleGroupAdd(startDate, endDate, Boolean(e.metaKey || e.ctrlKey));
  };

  const handlePasteAutofill = async () => {
    if (!navigator.clipboard?.readText) return;
    const clipboardText = (await navigator.clipboard.readText()).trim();
    const autofill = getUrlAutofill(clipboardText);
    if (!autofill) return;

    setDraftValue({
      link: autofill.link,
      description: draft.description || `${autofill.providerName} Stay`,
      startDate: draft.startDate || autofill.startDate,
      endDate: draft.endDate || autofill.endDate,
      totalPrice: typeof draft.totalPrice === 'number' ? draft.totalPrice : autofill.amount
    });
  };

  const handleBulkImport = () => {
    if (validBulkAccommodations.length === 0) return;

    const importedAccommodations = validBulkAccommodations.map((row) => ({
      id: uuidv4(),
      description: row.description,
      totalPrice: row.totalPrice,
      link: row.link,
      startDate: row.startDate,
      endDate: row.endDate,
      createdAt: Date.now()
    }));

    onChange([...accommodations, ...importedAccommodations]);
    setBulkInput('');
    setShowBulkModal(false);
  };

  const displayedAccommodations = useMemo(() => {
    const parsedMaxPrice = Number(maxPrice);
    const hasMaxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice > 0;
    const query = searchQuery.trim().toLowerCase();

    const filteredAccommodations = accommodations.filter((accommodation) => {
      const matchesQuery = query.length === 0
        || accommodation.description.toLowerCase().includes(query)
        || accommodation.link.toLowerCase().includes(query);
      const matchesPrice = !hasMaxPrice || accommodation.totalPrice <= parsedMaxPrice;
      return matchesQuery && matchesPrice;
    });

    return filteredAccommodations.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortBy === 'price') {
        return (a.totalPrice - b.totalPrice) * direction;
      }

      if (sortBy === 'startDate') {
        const aDate = a.startDate || '9999-12-31';
        const bDate = b.startDate || '9999-12-31';
        return aDate.localeCompare(bDate) * direction;
      }

      if (sortBy === 'dateAdded') {
        const aTime = a.createdAt ?? 0;
        const bTime = b.createdAt ?? 0;
        return (aTime - bTime) * direction;
      }

      return (a.description || '').localeCompare(b.description || '') * direction;
    });
  }, [accommodations, maxPrice, searchQuery, sortBy, sortDirection]);

  const accGroups = useMemo((): AccommodationGroup[] => {
    if (!groupByDate) return [];
    const groupMap = new Map<string, Accommodation[]>();
    for (const acc of displayedAccommodations) {
      const key = `${acc.startDate || 'no-start'}|${acc.endDate || 'no-end'}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.push(acc);
      } else {
        groupMap.set(key, [acc]);
      }
    }
    return Array.from(groupMap.entries()).map(([key, groupAccs]) => {
      const first = groupAccs[0];
      const start = first.startDate || 'No start date';
      const end = first.endDate || 'No end date';
      return {
        key,
        label: `${start} to ${end}`,
        startDate: first.startDate,
        endDate: first.endDate,
        accommodations: groupAccs
      };
    });
  }, [displayedAccommodations, groupByDate]);

  const renderEditForm = (accommodation: Accommodation) => (
    <div className="stay-card is-open" key={accommodation.id}>
      <div className="stay-card-body" style={{ gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Edit Stay</div>
        <Form.Control size="sm" placeholder="Description" value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        <DateRangePicker
          startDate={editForm.startDate || ''}
          endDate={editForm.endDate || ''}
          minDate={minDate}
          onChange={(start, end) => setEditForm({ ...editForm, startDate: start, endDate: end })}
        />
        <div className="d-flex gap-2 align-items-center">
          <Form.Control size="sm" placeholder="Link" value={editForm.link || ''} onChange={(e) => setEditForm({ ...editForm, link: e.target.value })} />
          {editForm.link && (
            <a href={editForm.link} target="_blank" rel="noreferrer" className="btn-icon" title="Open link"><FaExternalLinkAlt size={12} /></a>
          )}
        </div>
        <Form.Control size="sm" type="number" step="10" min="0" placeholder="Total price" value={editForm.totalPrice ?? ''} onChange={(e) => setEditForm({ ...editForm, totalPrice: Number(e.target.value) })} />
        <div>
          <Form.Control
            size="sm"
            placeholder="Image URL (optional)"
            value={editForm.imageUrl || ''}
            isInvalid={editImageStatus === 'error'}
            isValid={editImageStatus === 'valid'}
            onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
          />
          {editImageStatus === 'loading' && <div className="small text-muted mt-1">Checking image...</div>}
          {editImageStatus === 'error' && <div className="small text-danger mt-1">Image could not be loaded.</div>}
          {editImageStatus === 'valid' && (
            <img src={editForm.imageUrl} alt="preview" style={{ marginTop: 6, width: 80, height: 56, objectFit: 'cover', borderRadius: 6 }} />
          )}
        </div>
        <div className="d-flex gap-2">
          <Form.Control size="sm" type="number" min="0" step="1" placeholder="Rooms" value={editForm.rooms ?? ''} onChange={(e) => setEditForm({ ...editForm, rooms: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 80 }} />
          <Form.Control size="sm" type="number" min="0" step="1" placeholder="Beds" value={editForm.beds ?? ''} onChange={(e) => setEditForm({ ...editForm, beds: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 80 }} />
        </div>
        <div className="qa-actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={cancelEdit}>Cancel</button>
          <button type="button" className="btn btn-sm btn-accent" onClick={saveEdit}><FaSave size={11} /> Save</button>
        </div>
      </div>
    </div>
  );

  const renderStayCard = (accommodation: Accommodation) => {
    if (editingId === accommodation.id) return renderEditForm(accommodation);

    const voterList = votes[accommodation.id] || [];
    const isVoted = currentPerson !== '' && voterList.includes(currentPerson);
    const nights = accommodation.startDate && accommodation.endDate
      ? nightsBetween(accommodation.startDate, accommodation.endDate) : 0;
    const perNight = nights > 0 ? accommodation.totalPrice / nights : 0;
    const perPerson = peopleCount > 0 ? accommodation.totalPrice / peopleCount : 0;

    const metaParts: React.ReactNode[] = [];
    if (accommodation.rooms != null && accommodation.rooms > 0) {
      metaParts.push(<span key="rooms">{accommodation.rooms} room{accommodation.rooms !== 1 ? 's' : ''}</span>);
    }
    if (accommodation.beds != null && accommodation.beds > 0) {
      metaParts.push(<span key="beds">{accommodation.beds} bed{accommodation.beds !== 1 ? 's' : ''}</span>);
    }

    const metaWithPips: React.ReactNode[] = [];
    metaParts.forEach((part, i) => {
      if (i > 0) metaWithPips.push(<span key={`pip-${i}`} className="pip" />);
      metaWithPips.push(part);
    });

    const perParts: string[] = [];
    if (perNight > 0) perParts.push(`${formatCurrency(perNight)}/night`);
    if (perPerson > 0) perParts.push(`${formatCurrency(perPerson)}/person`);

    return (
      <div key={accommodation.id} className={`stay-card${isVoted ? ' is-voted' : ''}`}>
        <div
          className="stay-photo"
          style={accommodation.imageUrl ? { backgroundImage: `url(${accommodation.imageUrl})` } : undefined}
        >
          <div className="photo-actions">
            {accommodation.link && (
              <a href={accommodation.link} target="_blank" rel="noreferrer" className="btn-icon" title="Open link" onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                <FaExternalLinkAlt size={11} />
              </a>
            )}
            <button type="button" className="btn-icon" title="Edit" onClick={() => startEdit(accommodation)} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
              <FaEdit size={11} />
            </button>
            <button type="button" className="btn-icon" title="Clone" onClick={() => handleDuplicate(accommodation)} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
              <FaClone size={11} />
            </button>
            <button type="button" className="btn-icon" title="Delete" onClick={() => handleRemove(accommodation.id)} style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
              <FaTrash size={11} />
            </button>
          </div>
        </div>

        <div className="stay-card-body">
          <div className="stay-name" title={accommodation.description || 'Accommodation Option'}>
            {accommodation.description || 'Accommodation Option'}
          </div>

          {metaWithPips.length > 0 && (
            <div className="stay-meta">{metaWithPips}</div>
          )}

          <div className="stay-bottom">
            <div className="stay-price">
              <span className="amount">{formatCurrency(accommodation.totalPrice)}</span>
              {perParts.length > 0 && (
                <span className="per">{perParts.join(' · ')}</span>
              )}
            </div>
            <VoteButton
              voters={voterList}
              currentPerson={currentPerson}
              onToggle={() => onToggleVote(accommodation.id)}
            />
          </div>
        </div>

      </div>
    );
  };

  const renderGroupQuickAdd = (groupKey: string, startDate: string, endDate: string) => {
    const isOpen = openQuickAdd === groupKey;
    const isGroupImageValid = !groupDraft.imageUrl || groupDraftImageStatus === 'valid';
    const isGroupLinkValid = Boolean(groupDraft.link);
    const isGroupPriceValid = typeof groupDraft.totalPrice === 'number' && groupDraft.totalPrice > 0;

    if (!isOpen) {
      return (
        <div
          className="quick-add"
          onClick={() => { setOpenQuickAdd(groupKey); setGroupDraft({}); setGroupAttemptedAdd(false); }}
        >
          <FaPlus size={14} />
          <span>Add stay</span>
        </div>
      );
    }

    return (
      <div className="quick-add is-open">
        <div className="qa-grid">
          <Form.Group>
            <Form.Label className="small text-muted mb-1">Description</Form.Label>
            <Form.Control
              ref={groupDescriptionRef}
              size="sm"
              placeholder="Hotel name"
              value={groupDraft.description || ''}
              onChange={(e) => setGroupDraft({ ...groupDraft, description: e.target.value })}
              onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
              autoFocus
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted mb-1">Link</Form.Label>
            <InputGroup size="sm">
              <Form.Control
                placeholder="https://..."
                value={groupDraft.link || ''}
                isInvalid={groupAttemptedAdd && !isGroupLinkValid}
                onChange={(e) => setGroupDraft({ ...groupDraft, link: e.target.value })}
                onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
              />
              <Button variant="outline-secondary" size="sm" onClick={async () => {
                if (!navigator.clipboard?.readText) return;
                const text = (await navigator.clipboard.readText()).trim();
                const af = getUrlAutofill(text);
                if (af) {
                  setGroupDraft({
                    ...groupDraft,
                    link: af.link,
                    description: groupDraft.description || `${af.providerName} Stay`,
                    totalPrice: typeof groupDraft.totalPrice === 'number' ? groupDraft.totalPrice : af.amount
                  });
                }
              }} title="Paste and autofill">
                <FaClipboard size={11} />
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted mb-1">Total Price</Form.Label>
            <Form.Control
              size="sm"
              type="number"
              min="0"
              step="10"
              placeholder="0"
              value={groupDraft.totalPrice ?? ''}
              isInvalid={groupAttemptedAdd && !isGroupPriceValid}
              onChange={(e) => setGroupDraft({ ...groupDraft, totalPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
              onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small text-muted mb-1">Image URL</Form.Label>
            <Form.Control
              size="sm"
              placeholder="https://... (optional)"
              value={groupDraft.imageUrl || ''}
              isInvalid={groupDraftImageStatus === 'error'}
              isValid={groupDraftImageStatus === 'valid'}
              onChange={(e) => setGroupDraft({ ...groupDraft, imageUrl: e.target.value })}
              onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
            />
          </Form.Group>
          <div className="d-flex gap-2">
            <Form.Group style={{ flex: 1 }}>
              <Form.Label className="small text-muted mb-1">Rooms</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="0"
                step="1"
                placeholder="--"
                value={groupDraft.rooms ?? ''}
                onChange={(e) => setGroupDraft({ ...groupDraft, rooms: e.target.value === '' ? undefined : Number(e.target.value) })}
                onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
              />
            </Form.Group>
            <Form.Group style={{ flex: 1 }}>
              <Form.Label className="small text-muted mb-1">Beds</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                min="0"
                step="1"
                placeholder="--"
                value={groupDraft.beds ?? peopleCount}
                onChange={(e) => setGroupDraft({ ...groupDraft, beds: e.target.value === '' ? undefined : Number(e.target.value) })}
                onKeyDown={(e) => handleGroupQuickAddKeyDown(e, startDate, endDate)}
              />
            </Form.Group>
          </div>
        </div>

        {groupAttemptedAdd && !isGroupLinkValid && (
          <div className="inline-status error" role="status">A booking link is required.</div>
        )}
        {groupAttemptedAdd && !isGroupPriceValid && (
          <div className="inline-status error" role="status">A total price greater than 0 is required.</div>
        )}
        {groupAttemptedAdd && !isGroupImageValid && (
          <div className="inline-status error" role="status">Image URL could not be loaded -- fix or remove it.</div>
        )}

        <div className="qa-actions">
          <span className="qa-hint">Enter to save, Cmd+Enter to save &amp; keep adding</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setOpenQuickAdd(null); setGroupDraft({}); setGroupAttemptedAdd(false); }}>Cancel</button>
          <button type="button" className="btn btn-sm btn-accent" onClick={() => handleGroupAdd(startDate, endDate, false)}>
            <FaPlus size={11} /> Add
          </button>
        </div>
      </div>
    );
  };

  const renderGroupSearchLinks = (group: AccommodationGroup) => {
    const groupSearchLinks = getAccommodationSearchLinks(searchLinks, destinationName, group.startDate, group.endDate, peopleCount);
    const groupCustomLinks = customGroupLinks[group.key] || {};

    return (
      <div className="search-links">
        {groupSearchLinks.map((sl) => {
          const linkId = searchLinks.find((t) => t.label === sl.label)?.id || sl.label;
          const customUrl = groupCustomLinks[linkId];
          const isEditing = editingGroupLink?.groupKey === group.key && editingGroupLink?.linkId === linkId;

          if (isEditing) {
            return (
              <InputGroup key={sl.label} size="sm" style={{ width: 320 }}>
                <Form.Control
                  size="sm"
                  placeholder={`Custom ${sl.label} URL`}
                  value={editingGroupLink.url}
                  onChange={(e) => setEditingGroupLink({ ...editingGroupLink, url: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const url = editingGroupLink.url.trim();
                      const next = { ...customGroupLinks };
                      if (url) {
                        next[group.key] = { ...groupCustomLinks, [linkId]: url };
                      } else {
                        const { [linkId]: _, ...rest } = groupCustomLinks;
                        if (Object.keys(rest).length > 0) {
                          next[group.key] = rest;
                        } else {
                          delete next[group.key];
                        }
                      }
                      onCustomGroupLinksChange(next);
                      setEditingGroupLink(null);
                    } else if (e.key === 'Escape') {
                      setEditingGroupLink(null);
                    }
                  }}
                  autoFocus
                />
                <Button variant="outline-success" size="sm" title="Save" onClick={() => {
                  const url = editingGroupLink.url.trim();
                  const next = { ...customGroupLinks };
                  if (url) {
                    next[group.key] = { ...groupCustomLinks, [linkId]: url };
                  } else {
                    const { [linkId]: _, ...rest } = groupCustomLinks;
                    if (Object.keys(rest).length > 0) {
                      next[group.key] = rest;
                    } else {
                      delete next[group.key];
                    }
                  }
                  onCustomGroupLinksChange(next);
                  setEditingGroupLink(null);
                }}>
                  <FaSave size={10} />
                </Button>
                <Button variant="outline-secondary" size="sm" title="Cancel" onClick={() => setEditingGroupLink(null)}>
                  <FaTimes size={10} />
                </Button>
              </InputGroup>
            );
          }

          return (
            <div key={sl.label} style={{ display: 'inline-flex', gap: 0 }}>
              <a href={customUrl || sl.url} target="_blank" rel="noreferrer" className="link-chip" title={customUrl ? 'Custom link' : 'Auto-generated link'}>
                <FaSearch size={10} /> {sl.label}
              </a>
              <button
                type="button"
                className="btn-icon"
                style={{ width: 24, height: 24, fontSize: 10 }}
                title="Edit link"
                onClick={() => setEditingGroupLink({ groupKey: group.key, linkId, url: customUrl || sl.url })}
              >
                <FaEdit size={10} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="section">
        {/* Section header */}
        <div className="section-head">
          <h2 className="section-title">Stays</h2>
          <span className="section-sub">{accommodations.length} option{accommodations.length !== 1 ? 's' : ''}</span>
          <div className="section-actions">
            {(stayLinks.length > 0 || showAddStayLink) && (
              <>
                {stayLinks.map((sl, i) => (
                  editingStayLinkIndex === i ? (
                    <InputGroup key={i} size="sm" style={{ width: 320 }}>
                      <Form.Control size="sm" placeholder="Label" value={editStayLink.label} onChange={(e) => setEditStayLink({ ...editStayLink, label: e.target.value })} style={{ maxWidth: 100 }} />
                      <Form.Control
                        size="sm"
                        placeholder="URL"
                        value={editStayLink.url}
                        onChange={(e) => setEditStayLink({ ...editStayLink, url: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editStayLink.label.trim() && editStayLink.url.trim()) {
                            const next = [...stayLinks];
                            next[i] = { label: editStayLink.label.trim(), url: editStayLink.url.trim() };
                            onStayLinksChange(next);
                            setEditingStayLinkIndex(null);
                          } else if (e.key === 'Escape') {
                            setEditingStayLinkIndex(null);
                          }
                        }}
                      />
                      <Button variant="outline-success" size="sm" onClick={() => {
                        if (editStayLink.label.trim() && editStayLink.url.trim()) {
                          const next = [...stayLinks];
                          next[i] = { label: editStayLink.label.trim(), url: editStayLink.url.trim() };
                          onStayLinksChange(next);
                          setEditingStayLinkIndex(null);
                        }
                      }}><FaSave size={10} /></Button>
                      <Button variant="outline-danger" size="sm" onClick={() => {
                        onStayLinksChange(stayLinks.filter((_, j) => j !== i));
                        setEditingStayLinkIndex(null);
                      }}><FaTrash size={10} /></Button>
                      <Button variant="outline-secondary" size="sm" onClick={() => setEditingStayLinkIndex(null)}><FaTimes size={10} /></Button>
                    </InputGroup>
                  ) : (
                    <div key={i} style={{ display: 'inline-flex', gap: 0 }}>
                      <a href={sl.url} target="_blank" rel="noreferrer" className="link-chip">
                        <FaLink size={10} /> {sl.label}
                      </a>
                      <button type="button" className="btn-icon" style={{ width: 24, height: 24, fontSize: 10 }} title="Edit link" onClick={() => { setEditingStayLinkIndex(i); setEditStayLink(sl); }}>
                        <FaEdit size={10} />
                      </button>
                    </div>
                  )
                ))}
                {showAddStayLink && (
                  <InputGroup size="sm" style={{ width: 320 }}>
                    <Form.Control size="sm" placeholder="Label" value={newStayLink.label} onChange={(e) => setNewStayLink({ ...newStayLink, label: e.target.value })} style={{ maxWidth: 100 }} autoFocus />
                    <Form.Control
                      size="sm"
                      placeholder="URL"
                      value={newStayLink.url}
                      onChange={(e) => setNewStayLink({ ...newStayLink, url: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newStayLink.label.trim() && newStayLink.url.trim()) {
                          onStayLinksChange([...stayLinks, { label: newStayLink.label.trim(), url: newStayLink.url.trim() }]);
                          setNewStayLink({ label: '', url: '' });
                          setShowAddStayLink(false);
                        } else if (e.key === 'Escape') {
                          setShowAddStayLink(false);
                          setNewStayLink({ label: '', url: '' });
                        }
                      }}
                    />
                    <Button variant="outline-success" size="sm" onClick={() => {
                      if (newStayLink.label.trim() && newStayLink.url.trim()) {
                        onStayLinksChange([...stayLinks, { label: newStayLink.label.trim(), url: newStayLink.url.trim() }]);
                        setNewStayLink({ label: '', url: '' });
                        setShowAddStayLink(false);
                      }
                    }}><FaSave size={10} /></Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => { setShowAddStayLink(false); setNewStayLink({ label: '', url: '' }); }}><FaTimes size={10} /></Button>
                  </InputGroup>
                )}
              </>
            )}
            {!showAddStayLink && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAddStayLink(true)}>
                <FaPlus size={10} /> <FaLink size={10} /> Add list
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowBulkModal(true)}>
              <FaListUl size={11} /> Bulk
            </button>
          </div>
        </div>

        {/* Filters and sort */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 18 }}>
          <Form.Group style={{ flex: '1 1 200px', maxWidth: 280 }}>
            <Form.Label className="small text-muted mb-1">Search</Form.Label>
            <Form.Control
              size="sm"
              placeholder="Filter by description or link"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </Form.Group>
          <Form.Group style={{ flex: '0 1 140px' }}>
            <Form.Label className="small text-muted mb-1">Max total</Form.Label>
            <InputGroup size="sm">
              <InputGroup.Text><FaFilter size={10} /></InputGroup.Text>
              <Form.Control
                type="number"
                min="0"
                step="10"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </InputGroup>
          </Form.Group>
          <Form.Group style={{ flex: '0 1 120px' }}>
            <Form.Label className="small text-muted mb-1">Sort by</Form.Label>
            <Form.Select size="sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              <option value="price">Price</option>
              <option value="description">Name</option>
              <option value="startDate">Start date</option>
              <option value="dateAdded">Date added</option>
            </Form.Select>
          </Form.Group>
          <Form.Group style={{ flex: '0 1 90px' }}>
            <Form.Label className="small text-muted mb-1">Direction</Form.Label>
            <Form.Select size="sm" value={sortDirection} onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}>
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </Form.Select>
          </Form.Group>
          <button
            type="button"
            className={`btn btn-sm ${groupByDate ? 'btn-accent' : 'btn-outline'}`}
            onClick={() => setGroupByDate(!groupByDate)}
            style={{ alignSelf: 'flex-end', marginBottom: 1 }}
          >
            <FaLayerGroup size={11} /> Group
          </button>
        </div>

        {/* Top-level quick add (always visible) */}
        <div className="group" style={{ marginBottom: 20 }}>
          <div className="group-head" style={{ borderBottom: 'none' }}>
            <div className="dates"><FaHotel size={14} /> Add Stay</div>
          </div>
          <div style={{ padding: '0 20px 18px' }}>
            <div className="qa-grid" style={{ marginBottom: 10 }}>
              <Form.Group>
                <Form.Label className="small text-muted mb-1">Description</Form.Label>
                <Form.Control
                  ref={quickAddDescriptionRef}
                  size="sm"
                  placeholder="City Center Hotel"
                  value={draft.description || ''}
                  onChange={(e) => setDraftValue({ description: e.target.value })}
                  onKeyDown={handleQuickAddKeyDown}
                />
              </Form.Group>

              <DateRangePicker
                startDate={draft.startDate || ''}
                endDate={draft.endDate || ''}
                minDate={minDate}
                onChange={(start, end) => setDraftValue({ startDate: start, endDate: end })}
              />

              <Form.Group>
                <Form.Label className="small text-muted mb-1">Link</Form.Label>
                <InputGroup size="sm">
                  <Form.Control
                    placeholder="https://..."
                    value={draft.link || ''}
                    isInvalid={attemptedAdd && !isDraftLinkValid}
                    onChange={(e) => setDraftValue({ link: e.target.value })}
                    onKeyDown={handleQuickAddKeyDown}
                  />
                  <Button variant="outline-secondary" size="sm" onClick={handlePasteAutofill} title="Paste URL and autofill fields">
                    <FaClipboard size={11} />
                  </Button>
                </InputGroup>
              </Form.Group>

              <Form.Group>
                <Form.Label className="small text-muted mb-1">Total Price</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  inputMode="numeric"
                  step="10"
                  min="0"
                  placeholder="0"
                  value={draft.totalPrice ?? ''}
                  isInvalid={attemptedAdd && !isDraftPriceValid}
                  onChange={(e) => setDraftValue({ totalPrice: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onKeyDown={handleQuickAddKeyDown}
                />
              </Form.Group>

              <Form.Group>
                <Form.Label className="small text-muted mb-1">Image URL</Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="https://... (optional)"
                  value={draft.imageUrl || ''}
                  isInvalid={draftImageStatus === 'error'}
                  isValid={draftImageStatus === 'valid'}
                  onChange={(e) => setDraftValue({ imageUrl: e.target.value })}
                  onKeyDown={handleQuickAddKeyDown}
                />
                {draftImageStatus === 'loading' && <div className="small text-muted mt-1">Checking image...</div>}
                {draftImageStatus === 'error' && <div className="small text-danger mt-1">Image could not be loaded.</div>}
                {draftImageStatus === 'valid' && (
                  <img src={draft.imageUrl} alt="preview" style={{ marginTop: 6, width: 80, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                )}
              </Form.Group>

              <div className="d-flex gap-2">
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="small text-muted mb-1">Rooms</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="--"
                    value={draft.rooms ?? ''}
                    onChange={(e) => setDraftValue({ rooms: e.target.value === '' ? undefined : Number(e.target.value) })}
                    onKeyDown={handleQuickAddKeyDown}
                  />
                </Form.Group>
                <Form.Group style={{ flex: 1 }}>
                  <Form.Label className="small text-muted mb-1">Beds</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="--"
                    value={draft.beds ?? peopleCount}
                    onChange={(e) => setDraftValue({ beds: e.target.value === '' ? undefined : Number(e.target.value) })}
                    onKeyDown={handleQuickAddKeyDown}
                  />
                </Form.Group>
              </div>
            </div>

            {attemptedAdd && !isDraftLinkValid && (
              <div className="inline-status error" role="status">A booking link is required.</div>
            )}
            {attemptedAdd && !isDraftPriceValid && (
              <div className="inline-status error" role="status">A total price greater than 0 is required.</div>
            )}
            {attemptedAdd && !isDraftImageValid && (
              <div className="inline-status error" role="status">Image URL could not be loaded -- fix or remove it.</div>
            )}

            {suggestedDateRanges.length > 0 && !draft.startDate && !draft.endDate && (
              <div className="d-flex flex-wrap gap-1 mb-2">
                <span className="small text-muted" style={{ lineHeight: '24px' }}>From flights:</span>
                {suggestedDateRanges.map((r) => (
                  <Badge
                    key={`${r.startDate}|${r.endDate}`}
                    bg="info"
                    className="fw-normal"
                    role="button"
                    style={{ cursor: 'pointer', fontSize: '0.75rem' }}
                    onClick={() => setDraftValue({ startDate: r.startDate, endDate: r.endDate })}
                  >
                    {r.label}
                  </Badge>
                ))}
              </div>
            )}

            <div className="qa-actions">
              <span className="qa-hint">Enter to save, Cmd+Enter to save &amp; keep adding</span>
              {draftSearchLinks.map((sl) => (
                <a key={sl.label} href={sl.url} target="_blank" rel="noreferrer" className="link-chip" title="Search for selected dates">
                  <FaSearch size={10} /> {sl.label}
                </a>
              ))}
              <button type="button" className="btn btn-sm btn-accent" onClick={() => handleAdd(false)}>
                <FaPlus size={11} /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Grouped view */}
        {groupByDate ? (
          accGroups.length > 0 ? (
            accGroups.map((group) => {
              const nights = group.startDate && group.endDate ? nightsBetween(group.startDate, group.endDate) : 0;
              return (
                <div className="group" key={group.key}>
                  <div className="group-head">
                    <div className="dates">
                      {group.startDate && group.endDate
                        ? fmtDateRange(group.startDate, group.endDate)
                        : group.label}
                    </div>
                    {nights > 0 && (
                      <>
                        <span className="dot-sep" />
                        <span className="nights">{nights} night{nights !== 1 ? 's' : ''}</span>
                      </>
                    )}
                    <span className="dot-sep" />
                    <span className="nights">{group.accommodations.length} stay{group.accommodations.length !== 1 ? 's' : ''}</span>

                    <div className="group-actions">
                      {renderGroupSearchLinks(group)}
                      <button
                        type="button"
                        className="btn-icon"
                        title="Clear this group"
                        onClick={() => setPendingClearGroup(group)}
                      >
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </div>

                  <div className="group-body">
                    {group.accommodations.map(renderStayCard)}
                    {renderGroupQuickAdd(group.key, group.startDate, group.endDate)}
                  </div>
                </div>
              );
            })
          ) : (
            displayedAccommodations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-3)' }}>
                {accommodations.length === 0
                  ? 'No stays yet. Use the form above to add your first accommodation, or paste a booking URL to autofill.'
                  : 'No matching stays. Adjust filters or add a new option.'}
              </div>
            )
          )
        ) : (
          /* Flat (ungrouped) view */
          displayedAccommodations.length > 0 ? (
            <div className="group">
              <div className="group-body">
                {displayedAccommodations.map(renderStayCard)}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-3)' }}>
              {accommodations.length === 0
                ? 'No stays yet. Use the form above to add your first accommodation, or paste a booking URL to autofill.'
                : 'No matching stays. Adjust filters or add a new option.'}
            </div>
          )
        )}
      </div>

      {/* Bulk import modal */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Add Accommodations</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="fw-semibold">Paste one accommodation per line</Form.Label>
          <Form.Text className="d-block mb-2 text-muted">
            Format: description, price, link, startDate, endDate
          </Form.Text>
          <Form.Control
            as="textarea"
            rows={6}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="Hotel Central, 650, https://example.com, 2026-04-10, 2026-04-12"
          />

          {parsedBulkAccommodations.length > 0 && (
            <div className="mt-3">
              <div className="small text-muted mb-2">
                Valid rows: {validBulkAccommodations.length} / {parsedBulkAccommodations.length}
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
                    {parsedBulkAccommodations.map((row) => (
                      <tr key={`${row.lineNumber}-${row.link}`} className={row.error ? 'table-danger' : ''}>
                        <td>{row.lineNumber}</td>
                        <td>{row.description || '-'}</td>
                        <td>{row.totalPrice || '-'}</td>
                        <td className="text-truncate" style={{ maxWidth: '240px' }}>{row.link || '-'}</td>
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
          <Button variant="outline-secondary" onClick={() => setShowBulkModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleBulkImport} disabled={validBulkAccommodations.length === 0}>
            Import {validBulkAccommodations.length > 0 ? validBulkAccommodations.length : ''} Accommodations
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Clear group confirmation modal */}
      <Modal show={pendingClearGroup !== null} onHide={() => setPendingClearGroup(null)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <FaExclamationTriangle size={32} className="text-danger" />
          </div>
          <h5 className="fw-semibold mb-2">Clear accommodation group?</h5>
          <p className="text-muted mb-0">
            All <strong>{pendingClearGroup?.accommodations.length}</strong> accommodation{pendingClearGroup?.accommodations.length !== 1 ? 's' : ''} in <strong>{pendingClearGroup?.startDate && pendingClearGroup?.endDate ? fmtDateRange(pendingClearGroup.startDate, pendingClearGroup.endDate) : pendingClearGroup?.label}</strong> will be permanently removed.
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pt-0 pb-3 gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setPendingClearGroup(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => {
            if (pendingClearGroup) {
              const idsToRemove = new Set(pendingClearGroup.accommodations.map((a) => a.id));
              onChange(accommodations.filter((a) => !idsToRemove.has(a.id)));
            }
            setPendingClearGroup(null);
          }}>Clear Group</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AccommodationManager;
