import React, { useMemo, useState } from 'react';
import { Table, Button, Form, Card, Modal, InputGroup, Row, Col, Badge } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Accommodation } from '../types';
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
  FaFilter
} from 'react-icons/fa';
import { getUrlAutofill } from '../utils/urlAutofill';
import { formatCurrency } from '../utils/budget';

interface Props {
  accommodations: Accommodation[];
  onChange: (acc: Accommodation[]) => void;
  draft: Partial<Accommodation>;
  onDraftChange: (draft: Partial<Accommodation>) => void;
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

type SortBy = 'price' | 'description' | 'startDate';

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
  onChange,
  draft,
  onDraftChange
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

  const quickAddDescriptionRef = React.useRef<HTMLInputElement>(null);
  const quickAddEndDateRef = React.useRef<HTMLInputElement>(null);
  const editAccEndDateRef = React.useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-04-01`;
  const parsedBulkAccommodations = useMemo(() => parseBulkAccommodations(bulkInput), [bulkInput]);
  const validBulkAccommodations = parsedBulkAccommodations.filter((row) => !row.error);

  const isDraftLinkValid = Boolean(draft.link);
  const isDraftPriceValid = typeof draft.totalPrice === 'number' && draft.totalPrice > 0;
  const isDraftValid = isDraftLinkValid && isDraftPriceValid;

  const setDraftValue = (updates: Partial<Accommodation>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const handleStartDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean,
    updateState: (value: Partial<Accommodation>) => void,
    currentState: Partial<Accommodation>
  ) => {
    const newStart = e.target.value;
    updateState({
      ...currentState,
      startDate: newStart,
      endDate: currentState.endDate && currentState.endDate < newStart ? '' : currentState.endDate
    });

    if (newStart) {
      setTimeout(() => {
        const ref = isEdit ? editAccEndDateRef : quickAddEndDateRef;
        if (ref.current) {
          ref.current.focus();
          try {
            (ref.current as { showPicker?: () => void }).showPicker?.();
          } catch {
            // showPicker not available in every browser.
          }
        }
      }, 50);
    }
  };

  const handleAdd = (focusNext = false) => {
    setAttemptedAdd(true);
    if (!(draft.link && typeof draft.totalPrice === 'number' && draft.totalPrice > 0)) {
      return;
    }

    const acc: Accommodation = {
      id: uuidv4(),
      link: draft.link,
      description: draft.description || '',
      totalPrice: Number(draft.totalPrice),
      startDate: draft.startDate || '',
      endDate: draft.endDate || ''
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
        description: accommodation.description ? `${accommodation.description} (Copy)` : 'Accommodation (Copy)'
      }
    ]);
  };

  const startEdit = (accommodation: Accommodation) => {
    setEditingId(accommodation.id);
    setEditForm(accommodation);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!(editingId && editForm.link && editForm.totalPrice)) {
      return;
    }

    const updated = accommodations.map((accommodation) => {
      if (accommodation.id !== editingId) {
        return accommodation;
      }

      return {
        ...accommodation,
        ...editForm,
        totalPrice: Number(editForm.totalPrice)
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
      endDate: row.endDate
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

      return (a.description || '').localeCompare(b.description || '') * direction;
    });
  }, [accommodations, maxPrice, searchQuery, sortBy, sortDirection]);

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

          <div className="subtle-text mb-2">Quick add (Enter to save, Cmd/Ctrl + Enter to save and keep typing).</div>
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

            <Form.Group>
              <Form.Label className="small text-muted mb-1">Start</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                min={minDate}
                value={draft.startDate || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e, false, setDraftValue, draft)}
                onKeyDown={handleQuickAddKeyDown}
                aria-label="Accommodation start date"
              />
            </Form.Group>

            <Form.Group>
              <Form.Label className="small text-muted mb-1">End</Form.Label>
              <Form.Control
                ref={quickAddEndDateRef}
                size="sm"
                type="date"
                min={draft.startDate || minDate}
                value={draft.endDate || ''}
                onChange={(e) => setDraftValue({ endDate: e.target.value })}
                onKeyDown={handleQuickAddKeyDown}
                aria-label="Accommodation end date"
              />
            </Form.Group>

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
                size="sm"
                type="number"
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
          </div>

          {(attemptedAdd && (!isDraftLinkValid || !isDraftPriceValid)) && (
            <div className="inline-status error" role="status">Link and total price are required.</div>
          )}

          <div className="d-flex justify-content-end mt-3">
            <Button size="sm" variant="primary" onClick={() => handleAdd(false)} disabled={!isDraftValid}>
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
              {displayedAccommodations.map((accommodation) => (
                <tr key={accommodation.id}>
                  <td>
                    {editingId === accommodation.id ? (
                      <div className="d-flex flex-column gap-2">
                        <Form.Control
                          size="sm"
                          placeholder="Description"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        />
                        <div className="d-flex gap-2">
                          <Form.Control
                            size="sm"
                            type="date"
                            min={minDate}
                            value={editForm.startDate || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e, true, setEditForm, editForm)}
                          />
                          <Form.Control
                            ref={editAccEndDateRef}
                            size="sm"
                            type="date"
                            value={editForm.endDate || ''}
                            min={editForm.startDate || ''}
                            onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                          />
                        </div>
                        <Form.Control
                          size="sm"
                          placeholder="Link"
                          value={editForm.link || ''}
                          onChange={(e) => setEditForm({ ...editForm, link: e.target.value })}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="fw-semibold">{accommodation.description || 'Accommodation Option'}</div>
                        <div className="small subtle-text my-1">
                          {accommodation.startDate || 'No start date'} <span className="mx-1">to</span> {accommodation.endDate || 'No end date'}
                        </div>
                        <a href={accommodation.link} target="_blank" rel="noreferrer" className="small text-decoration-none d-inline-flex align-items-center gap-1">
                          View Stay <FaExternalLinkAlt size={10} />
                        </a>
                      </>
                    )}
                  </td>
                  <td style={{ verticalAlign: editingId === accommodation.id ? 'top' : 'middle' }}>
                    {editingId === accommodation.id ? (
                      <Form.Control
                        size="sm"
                        type="number"
                        step="10"
                        min="0"
                        value={editForm.totalPrice}
                        onChange={(e) => setEditForm({ ...editForm, totalPrice: Number(e.target.value) })}
                      />
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
                      <>
                        <Button variant="link" className="text-secondary p-0 me-3" onClick={() => startEdit(accommodation)} aria-label="Edit accommodation option">
                          <FaEdit />
                        </Button>
                        <Button variant="link" className="text-secondary p-0 me-3" onClick={() => handleDuplicate(accommodation)} aria-label="Duplicate accommodation option">
                          <FaClone />
                        </Button>
                        <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(accommodation.id)} aria-label="Remove accommodation option">
                          <FaTrash />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

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
