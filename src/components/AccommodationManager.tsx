import React, { useMemo, useState, useEffect } from 'react';
import { Table, Button, Form, Card, Modal, InputGroup, Row, Col, Badge } from 'react-bootstrap';
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
  FaBed,
  FaDoorOpen,
  FaLink
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

  const [editingGroupLink, setEditingGroupLink] = useState<{ groupKey: string; linkId: string; url: string } | null>(null);
  const [showAddStayLink, setShowAddStayLink] = useState(false);
  const [newStayLink, setNewStayLink] = useState({ label: '', url: '' });
  const [editingStayLinkIndex, setEditingStayLinkIndex] = useState<number | null>(null);
  const [editStayLink, setEditStayLink] = useState({ label: '', url: '' });

  const [draftImageStatus, setDraftImageStatus] = useState<ImageStatus>('idle');
  const [editImageStatus, setEditImageStatus] = useState<ImageStatus>('idle');

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

  const quickAddDescriptionRef = React.useRef<HTMLInputElement>(null);
  const quickAddPriceRef = React.useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-04-01`;
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
  const isDraftImageValid = !draft.imageUrl || draftImageStatus === 'valid' || draftImageStatus === 'loading';

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
      ...(draft.rooms && draft.rooms > 0 ? { rooms: draft.rooms } : {}),
      beds: (draft.beds != null && draft.beds > 0) ? draft.beds : peopleCount
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

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }

    e.preventDefault();
    handleAdd(Boolean(e.metaKey || e.ctrlKey));
  };

  const handlePasteAutofill = async () => {
    if (!navigator.clipboard?.readText) {
      return;
    }

    const clipboardText = (await navigator.clipboard.readText()).trim();
    const autofill = getUrlAutofill(clipboardText);
    if (!autofill) {
      return;
    }

    setDraftValue({
      link: autofill.link,
      description: draft.description || `${autofill.providerName} Stay`,
      startDate: draft.startDate || autofill.startDate,
      endDate: draft.endDate || autofill.endDate,
      totalPrice: typeof draft.totalPrice === 'number' ? draft.totalPrice : autofill.amount
    });
  };

  const handleBulkImport = () => {
    if (validBulkAccommodations.length === 0) {
      return;
    }

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

  const prefillDraftFromGroup = (startDate: string, endDate: string) => {
    onDraftChange({ ...draft, startDate, endDate });
    setTimeout(() => {
      quickAddDescriptionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      quickAddDescriptionRef.current?.focus();
    }, 50);
  };

  const renderAccRow = (accommodation: Accommodation) => (
    <tr key={accommodation.id}>
      <td>
        {editingId === accommodation.id ? (
          <div className="d-flex flex-column gap-2">
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
                <a href={editForm.link} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary" title="Open link"><FaExternalLinkAlt size={12} /></a>
              )}
            </div>
            <div>
              <Form.Control
                size="sm"
                placeholder="Image URL (optional)"
                value={editForm.imageUrl || ''}
                isInvalid={editImageStatus === 'error'}
                isValid={editImageStatus === 'valid'}
                onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
              />
              {editImageStatus === 'loading' && <div className="small text-muted mt-1">Checking image…</div>}
              {editImageStatus === 'error' && <div className="small text-danger mt-1">Image could not be loaded. Check the URL.</div>}
              {editImageStatus === 'valid' && (
                <img src={editForm.imageUrl} alt="preview" style={{ marginTop: 6, width: 80, height: 56, objectFit: 'cover', borderRadius: 4 }} />
              )}
            </div>
            <div className="d-flex gap-2">
              <Form.Control size="sm" type="number" min="0" step="1" placeholder="Rooms" value={editForm.rooms ?? ''} onChange={(e) => setEditForm({ ...editForm, rooms: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 80 }} />
              <Form.Control size="sm" type="number" min="0" step="1" placeholder="Beds" value={editForm.beds ?? ''} onChange={(e) => setEditForm({ ...editForm, beds: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ width: 80 }} />
            </div>
          </div>
        ) : (
          <div className="d-flex gap-2">
            {accommodation.imageUrl && (
              <a href={accommodation.imageUrl} target="_blank" rel="noreferrer" title="View image" style={{ display: 'block', alignSelf: 'stretch', flexShrink: 0 }}>
                <img
                  src={accommodation.imageUrl}
                  alt={accommodation.description || 'Accommodation'}
                  style={{ width: 72, height: '100%', objectFit: 'cover', borderRadius: 6, display: 'block', border: '1px solid var(--bs-border-color)' }}
                />
              </a>
            )}
            <div>
              <div className="fw-semibold">{accommodation.description || 'Accommodation Option'}</div>
              <div className="small subtle-text my-1">
                {accommodation.startDate || 'No start date'} <span className="mx-1">to</span> {accommodation.endDate || 'No end date'}
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <a href={accommodation.link} target="_blank" rel="noreferrer" className="small text-decoration-none d-inline-flex align-items-center gap-1">
                  View Stay <FaExternalLinkAlt size={10} />
                </a>
                {accommodation.rooms != null && accommodation.rooms > 0 && (
                  <span className="small subtle-text d-inline-flex align-items-center gap-1"><FaDoorOpen size={10} /> {accommodation.rooms} room{accommodation.rooms !== 1 ? 's' : ''}</span>
                )}
                {accommodation.beds != null && accommodation.beds > 0 && (
                  <span className="small subtle-text d-inline-flex align-items-center gap-1"><FaBed size={10} /> {accommodation.beds} bed{accommodation.beds !== 1 ? 's' : ''}</span>
                )}
                {accommodation.createdAt && (
                  <span className="small subtle-text" title={new Date(accommodation.createdAt).toLocaleString()}>Added {formatTimeAgo(accommodation.createdAt)}</span>
                )}
                {accommodation.updatedAt && (
                  <span className="small subtle-text" title={new Date(accommodation.updatedAt).toLocaleString()}>Updated {formatTimeAgo(accommodation.updatedAt)}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </td>
      <td style={{ verticalAlign: editingId === accommodation.id ? 'top' : 'middle' }}>
        {editingId === accommodation.id ? (
          <Form.Control size="sm" type="number" step="10" min="0" value={editForm.totalPrice} onChange={(e) => setEditForm({ ...editForm, totalPrice: Number(e.target.value) })} />
        ) : (
          <strong>{formatCurrency(accommodation.totalPrice)}</strong>
        )}
      </td>
      <td className="text-end" style={{ verticalAlign: editingId === accommodation.id ? 'top' : 'middle' }}>
        {editingId === accommodation.id ? (
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="success" onClick={saveEdit} aria-label="Save accommodation changes"><FaSave /></Button>
            <Button size="sm" variant="outline-secondary" onClick={cancelEdit}>Cancel</Button>
          </div>
        ) : (
          <div className="d-flex align-items-center gap-2 justify-content-end">
            <VoteButton voters={votes[accommodation.id] || []} currentPerson={currentPerson} onToggle={() => onToggleVote(accommodation.id)} />
            <Button variant="link" className="text-secondary p-0" onClick={() => startEdit(accommodation)} aria-label="Edit accommodation option"><FaEdit /></Button>
            <Button variant="link" className="text-secondary p-0" onClick={() => handleDuplicate(accommodation)} aria-label="Duplicate accommodation option"><FaClone /></Button>
            <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(accommodation.id)} aria-label="Remove accommodation option"><FaTrash /></Button>
          </div>
        )}
      </td>
    </tr>
  );

  return (
    <>
      <Card className="workspace-card manager-card">
        <Card.Header className="workspace-card-header">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div className="d-flex align-items-center gap-2">
              <FaHotel className="text-primary" aria-hidden="true" />
              <h2 className="workspace-card-title m-0">Accommodation Options</h2>
              <Badge bg="light" text="dark">{accommodations.length}</Badge>
            </div>
            <Button size="sm" variant="outline-secondary" onClick={() => setShowBulkModal(true)}>
              <FaListUl className="me-1" /> Bulk Add
            </Button>
          </div>

          {(stayLinks.length > 0 || showAddStayLink) && (
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
              {stayLinks.map((sl, i) => (
                editingStayLinkIndex === i ? (
                  <InputGroup key={i} size="sm" style={{ width: 360 }}>
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
                  <div key={i} className="btn-group btn-group-sm">
                    <a href={sl.url} target="_blank" rel="noreferrer" className="btn btn-outline-info d-inline-flex align-items-center gap-1">
                      <FaLink size={10} /> {sl.label}
                    </a>
                    <button type="button" className="btn btn-outline-info" title="Edit link" onClick={() => { setEditingStayLinkIndex(i); setEditStayLink(sl); }}>
                      <FaEdit size={10} />
                    </button>
                  </div>
                )
              ))}
              {showAddStayLink && (
                <InputGroup size="sm" style={{ width: 360 }}>
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
            </div>
          )}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="subtle-text">Quick add (Enter to save, Cmd/Ctrl + Enter to save and keep typing).</span>
            {!showAddStayLink && (
              <Button size="sm" variant="outline-info" className="d-inline-flex align-items-center gap-1" onClick={() => setShowAddStayLink(true)}>
                <FaPlus size={10} /> <FaLink size={10} /> Add list
              </Button>
            )}
          </div>
          <div className="manager-quick-add-grid">
            <Form.Group>
              <Form.Label className="small text-muted mb-1">Description</Form.Label>
              <Form.Control
                ref={quickAddDescriptionRef}
                size="sm"
                placeholder="City Center Hotel"
                value={draft.description || ''}
                onChange={(e) => setDraftValue({ description: e.target.value })}
                onKeyDown={handleQuickAddKeyDown}
                aria-label="Accommodation description"
              />
            </Form.Group>

            <div>
              <DateRangePicker
                startDate={draft.startDate || ''}
                endDate={draft.endDate || ''}
                minDate={minDate}
                onChange={(start, end) => setDraftValue({ startDate: start, endDate: end })}
              />
              {suggestedDateRanges.length > 0 && !draft.startDate && !draft.endDate && (
                <div className="d-flex flex-wrap gap-1 mt-1">
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
            </div>

            <Form.Group>
              <Form.Label className="small text-muted mb-1">Link</Form.Label>
              <InputGroup size="sm">
                <Form.Control
                  placeholder="https://..."
                  value={draft.link || ''}
                  isInvalid={attemptedAdd && !isDraftLinkValid}
                  onChange={(e) => setDraftValue({ link: e.target.value })}
                  onKeyDown={handleQuickAddKeyDown}
                  aria-label="Accommodation booking link"
                />
                <Button variant="outline-secondary" onClick={handlePasteAutofill} title="Paste URL and autofill fields">
                  <FaClipboard />
                </Button>
              </InputGroup>
            </Form.Group>

            <Form.Group>
              <Form.Label className="small text-muted mb-1">Total Price</Form.Label>
              <Form.Control
                ref={quickAddPriceRef}
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
                aria-label="Accommodation total price"
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
                aria-label="Accommodation image URL"
              />
              {draftImageStatus === 'loading' && <div className="small text-muted mt-1">Checking image…</div>}
              {draftImageStatus === 'error' && <div className="small text-danger mt-1">Image could not be loaded. Check the URL.</div>}
              {draftImageStatus === 'valid' && (
                <img src={draft.imageUrl} alt="preview" style={{ marginTop: 6, width: 80, height: 56, objectFit: 'cover', borderRadius: 4 }} />
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
                  placeholder="—"
                  value={draft.rooms ?? ''}
                  onChange={(e) => setDraftValue({ rooms: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onKeyDown={handleQuickAddKeyDown}
                  aria-label="Number of rooms"
                />
              </Form.Group>
              <Form.Group style={{ flex: 1 }}>
                <Form.Label className="small text-muted mb-1">Beds</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="—"
                  value={draft.beds ?? peopleCount}
                  onChange={(e) => setDraftValue({ beds: e.target.value === '' ? undefined : Number(e.target.value) })}
                  onKeyDown={handleQuickAddKeyDown}
                  aria-label="Number of beds"
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
            <div className="inline-status error" role="status">Image URL could not be loaded — fix or remove it.</div>
          )}

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
            <div className="d-flex flex-wrap gap-2">
              {draftSearchLinks.map((sl) => (
                <a key={sl.label} href={sl.url} target="_blank" rel="noreferrer" className="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-1" title="Search accommodation for selected dates">
                  <FaSearch size={10} /> {sl.label}
                </a>
              ))}
            </div>
            <Button size="sm" variant="primary" onClick={() => handleAdd(false)}>
              <FaPlus className="me-1" /> Add Accommodation
            </Button>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          <div className="manager-controls">
            <Row className="g-2 align-items-end">
              <Col md={5}>
                <Form.Label className="small text-muted mb-1">Search</Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="Filter by description or link"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search accommodation options"
                />
              </Col>
              <Col md={3}>
                <Form.Label className="small text-muted mb-1">Max total</Form.Label>
                <InputGroup size="sm">
                  <InputGroup.Text><FaFilter /></InputGroup.Text>
                  <Form.Control
                    type="number"
                    min="0"
                    step="10"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    aria-label="Filter by max accommodation price"
                  />
                </InputGroup>
              </Col>
              <Col md={2}>
                <Form.Label className="small text-muted mb-1">Sort by</Form.Label>
                <Form.Select size="sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} aria-label="Sort accommodation by">
                  <option value="price">Price</option>
                  <option value="description">Name</option>
                  <option value="startDate">Start date</option>
                  <option value="dateAdded">Date added</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="small text-muted mb-1">Direction</Form.Label>
                <Form.Select size="sm" value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')} aria-label="Sort order">
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </Form.Select>
              </Col>
            </Row>
            <div className="mt-2">
              <Button
                size="sm"
                variant={groupByDate ? 'primary' : 'outline-secondary'}
                onClick={() => setGroupByDate(!groupByDate)}
                className="d-inline-flex align-items-center gap-1"
              >
                <FaLayerGroup /> Group by dates
              </Button>
            </div>
          </div>

          <Table hover responsive className="mb-0 align-middle manager-table">
            <thead>
              <tr>
                <th style={{ width: '52%' }}>Option</th>
                <th style={{ width: '18%' }}>Total</th>
                <th style={{ width: '30%' }} />
              </tr>
            </thead>
            <tbody>
              {groupByDate ? (
                <>
                  {accGroups.map((group) => {
                    const groupSearchLinks = getAccommodationSearchLinks(searchLinks, destinationName, group.startDate, group.endDate, peopleCount);
                    const groupCustomLinks = customGroupLinks[group.key] || {};
                    return (
                      <React.Fragment key={group.key}>
                        <tr className="table-light">
                          <td colSpan={3}>
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-1">
                              <div className="d-flex align-items-center gap-2">
                                <strong>{group.label}</strong>
                                <Badge bg="secondary" pill>{group.accommodations.length}</Badge>
                              </div>
                              <div className="d-flex flex-wrap gap-2 align-items-center">
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
                                        <Button
                                          variant="outline-success"
                                          size="sm"
                                          title="Save"
                                          onClick={() => {
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
                                          }}
                                        >
                                          <FaSave size={10} />
                                        </Button>
                                        <Button variant="outline-secondary" size="sm" title="Cancel" onClick={() => setEditingGroupLink(null)}>
                                          <FaTimes size={10} />
                                        </Button>
                                      </InputGroup>
                                    );
                                  }

                                  return (
                                    <div key={sl.label} className="btn-group btn-group-sm">
                                      <a href={customUrl || sl.url} target="_blank" rel="noreferrer" className="btn btn-outline-warning d-inline-flex align-items-center gap-1" title={customUrl ? 'Custom link' : 'Auto-generated link'}>
                                        <FaSearch size={10} /> {sl.label}{customUrl ? '' : ' (auto)'}
                                      </a>
                                      <button
                                        type="button"
                                        className="btn btn-outline-warning"
                                        title="Edit link"
                                        onClick={() => setEditingGroupLink({ groupKey: group.key, linkId, url: customUrl || sl.url })}
                                      >
                                        <FaEdit size={10} />
                                      </button>
                                    </div>
                                  );
                                })}
                                <Button size="sm" variant="outline-secondary" onClick={() => prefillDraftFromGroup(group.startDate, group.endDate)}>
                                  <FaPlus className="me-1" /> Add another
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {group.accommodations.map(renderAccRow)}
                      </React.Fragment>
                    );
                  })}
                </>
              ) : (
                displayedAccommodations.map(renderAccRow)
              )}

              {displayedAccommodations.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-5">
                    <div className="empty-inline-state">No matching stays. Adjust filters or add a new option.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Add Accommodations</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="fw-semibold">Paste one accommodation per line</Form.Label>
          <Form.Text className="d-block mb-2 text-muted">
            Format: `description, price, link, startDate, endDate`
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
    </>
  );
};

export default AccommodationManager;
