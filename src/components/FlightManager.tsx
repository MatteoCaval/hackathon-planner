import React, { useMemo, useState } from 'react';
import { Table, Button, Form, Card, Modal, InputGroup } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Flight } from '../types';
import { FaTrash, FaExternalLinkAlt, FaPlus, FaPlaneDeparture, FaEdit, FaSave, FaClone, FaClipboard, FaListUl } from 'react-icons/fa';
import { getUrlAutofill } from '../utils/urlAutofill';

interface Props {
  flights: Flight[];
  onChange: (flights: Flight[]) => void;
  draft: Partial<Flight>;
  onDraftChange: (draft: Partial<Flight>) => void;
}

interface ParsedBulkFlight {
  description: string;
  pricePerPerson: number;
  link: string;
  startDate: string;
  endDate: string;
  error: string;
}

const parseBulkFlights = (bulkInput: string): ParsedBulkFlight[] => {
  return bulkInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description = '', rawPrice = '', link = '', startDate = '', endDate = ''] = line.split(',').map((part) => part.trim());
      const pricePerPerson = Number(rawPrice);

      if (!link || !Number.isFinite(pricePerPerson) || pricePerPerson <= 0) {
        return {
          description,
          pricePerPerson: Number.isFinite(pricePerPerson) ? pricePerPerson : 0,
          link,
          startDate,
          endDate,
          error: 'Expected: description, price, link, startDate, endDate'
        };
      }

      return {
        description,
        pricePerPerson,
        link,
        startDate,
        endDate,
        error: ''
      };
    });
};

const FlightManager: React.FC<Props> = ({ flights, onChange, draft, onDraftChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Flight>>({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  const quickAddDescriptionRef = React.useRef<HTMLInputElement>(null);
  const quickAddEndDateRef = React.useRef<HTMLInputElement>(null);
  const editFlightEndDateRef = React.useRef<HTMLInputElement>(null);

  const currentYear = new Date().getFullYear();
  const minDate = `${currentYear}-04-01`;
  const parsedBulkFlights = useMemo(() => parseBulkFlights(bulkInput), [bulkInput]);
  const validBulkFlights = parsedBulkFlights.filter((row) => !row.error);
  const isDraftValid = Boolean(draft.link && typeof draft.pricePerPerson === 'number' && draft.pricePerPerson > 0);

  const setDraftValue = (updates: Partial<Flight>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const handleStartDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean,
    updateState: (value: Partial<Flight>) => void,
    currentState: Partial<Flight>
  ) => {
    const newStart = e.target.value;
    updateState({
      ...currentState,
      startDate: newStart,
      endDate: currentState.endDate && currentState.endDate < newStart ? '' : currentState.endDate
    });

    if (newStart) {
      setTimeout(() => {
        const ref = isEdit ? editFlightEndDateRef : quickAddEndDateRef;
        if (ref.current) {
          ref.current.focus();
          try {
            (ref.current as { showPicker?: () => void }).showPicker?.();
          } catch {
            // No-op when showPicker is unavailable.
          }
        }
      }, 50);
    }
  };

  const handleAdd = (focusNext: boolean = false) => {
    if (draft.link && typeof draft.pricePerPerson === 'number' && draft.pricePerPerson > 0) {
      const flight: Flight = {
        id: uuidv4(),
        link: draft.link,
        description: draft.description || '',
        startDate: draft.startDate || '',
        endDate: draft.endDate || '',
        pricePerPerson: Number(draft.pricePerPerson),
      };
      onChange([...flights, flight]);
      onDraftChange({});

      if (focusNext) {
        setTimeout(() => {
          quickAddDescriptionRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleRemove = (id: string) => {
    onChange(flights.filter(f => f.id !== id));
  };

  const handleDuplicate = (flight: Flight) => {
    onChange([
      ...flights,
      {
        ...flight,
        id: uuidv4(),
        description: flight.description ? `${flight.description} (Copy)` : 'Flight Option (Copy)'
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
    if (editingId && editForm.link && editForm.pricePerPerson) {
      const updatedFlights = flights.map(f => {
        if (f.id === editingId) {
          return {
            ...f,
            ...editForm,
            pricePerPerson: Number(editForm.pricePerPerson)
          } as Flight;
        }
        return f;
      });
      onChange(updatedFlights);
      cancelEdit();
    }
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleAdd(Boolean(e.metaKey || e.ctrlKey));
  };

  const handlePasteAutofill = async () => {
    if (!navigator.clipboard?.readText) {
      alert('Clipboard access is not available in this browser.');
      return;
    }

    const clipboardText = (await navigator.clipboard.readText()).trim();
    const autofill = getUrlAutofill(clipboardText);
    if (!autofill) {
      alert('Clipboard does not contain a valid URL.');
      return;
    }

    setDraftValue({
      link: autofill.link,
      description: draft.description || `${autofill.providerName} Option`,
      startDate: draft.startDate || autofill.startDate,
      endDate: draft.endDate || autofill.endDate,
      pricePerPerson: typeof draft.pricePerPerson === 'number' ? draft.pricePerPerson : autofill.amount
    });
  };

  const handleBulkImport = () => {
    if (validBulkFlights.length === 0) {
      return;
    }

    const importedFlights = validBulkFlights.map((row) => ({
      id: uuidv4(),
      description: row.description,
      pricePerPerson: row.pricePerPerson,
      link: row.link,
      startDate: row.startDate,
      endDate: row.endDate,
    }));

    onChange([...flights, ...importedFlights]);
    setBulkInput('');
    setShowBulkModal(false);
  };

  return (
    <>
      <Card className="mb-4 h-100">
        <Card.Header className="bg-white position-sticky top-0 z-2 border-bottom">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <FaPlaneDeparture className="text-primary" />
              <span className="h6 mb-0">Flight Options</span>
            </div>
            <Button size="sm" variant="outline-primary" onClick={() => setShowBulkModal(true)}>
              <FaListUl className="me-1" /> Bulk Add
            </Button>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <Form.Label className="small text-muted mb-1">Description</Form.Label>
              <Form.Control
                ref={quickAddDescriptionRef}
                size="sm"
                placeholder="Ryanair Morning"
                value={draft.description || ''}
                onChange={(e) => setDraftValue({ description: e.target.value })}
                onKeyDown={handleQuickAddKeyDown}
              />
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-1">Start</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                min={minDate}
                value={draft.startDate || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e, false, setDraftValue, draft)}
                onKeyDown={handleQuickAddKeyDown}
              />
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-1">End</Form.Label>
              <Form.Control
                ref={quickAddEndDateRef}
                size="sm"
                type="date"
                min={draft.startDate || minDate}
                value={draft.endDate || ''}
                onChange={(e) => setDraftValue({ endDate: e.target.value })}
                onKeyDown={handleQuickAddKeyDown}
              />
            </div>
            <div className="col-md-3">
              <Form.Label className="small text-muted mb-1">Link</Form.Label>
              <InputGroup size="sm">
                <Form.Control
                  placeholder="https://..."
                  value={draft.link || ''}
                  onChange={(e) => setDraftValue({ link: e.target.value })}
                  onKeyDown={handleQuickAddKeyDown}
                />
                <Button variant="outline-secondary" onClick={handlePasteAutofill} title="Paste URL and autofill fields">
                  <FaClipboard />
                </Button>
              </InputGroup>
            </div>
            <div className="col-md-2">
              <Form.Label className="small text-muted mb-1">Price/Person</Form.Label>
              <Form.Control
                size="sm"
                type="number"
                step="10"
                min="0"
                placeholder="0"
                value={draft.pricePerPerson ?? ''}
                onChange={(e) => setDraftValue({ pricePerPerson: e.target.value === '' ? undefined : Number(e.target.value) })}
                onKeyDown={handleQuickAddKeyDown}
              />
            </div>
          </div>
          <div className="d-flex justify-content-end mt-2">
            <Button size="sm" variant="primary" onClick={() => handleAdd(false)} disabled={!isDraftValid}>
              <FaPlus className="me-1" /> Add Flight
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="bg-light">
              <tr>
                <th style={{ width: '50%' }}>Description & Dates</th>
                <th style={{ width: '20%' }}>Price/Person</th>
                <th style={{ width: '30%' }}></th>
              </tr>
            </thead>
            <tbody>
              {flights.map(f => (
                <tr key={f.id}>
                  <td>
                    {editingId === f.id ? (
                      <div className="d-flex flex-column gap-2">
                        <Form.Control
                          size="sm"
                          placeholder="Description"
                          value={editForm.description || ''}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                        />
                        <div className="d-flex gap-1">
                          <Form.Control
                            size="sm"
                            type="date"
                            min={minDate}
                            value={editForm.startDate || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleStartDateChange(e, true, setEditForm, editForm)}
                          />
                          {editForm.startDate && (
                            <Form.Control
                              ref={editFlightEndDateRef}
                              size="sm"
                              type="date"
                              value={editForm.endDate || ''}
                              min={editForm.startDate || ''}
                              onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                            />
                          )}
                        </div>
                        <Form.Control
                          size="sm"
                          placeholder="Link"
                          value={editForm.link || ''}
                          onChange={e => setEditForm({ ...editForm, link: e.target.value })}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="fw-bold text-dark">{f.description || 'Flight Option'}</div>
                        <div className="text-muted small my-1">
                          {f.startDate} <span className="mx-1">to</span> {f.endDate}
                        </div>
                        <a href={f.link} target="_blank" rel="noreferrer" className="small text-decoration-none d-flex align-items-center gap-1">
                          View Deal <FaExternalLinkAlt size={10} />
                        </a>
                      </>
                    )}
                  </td>
                  <td style={{ verticalAlign: editingId === f.id ? 'top' : 'middle' }}>
                    {editingId === f.id ? (
                      <Form.Control
                        size="sm"
                        type="number"
                        step="10"
                        min="0"
                        value={editForm.pricePerPerson}
                        onChange={e => setEditForm({ ...editForm, pricePerPerson: Number(e.target.value) })}
                      />
                    ) : (
                      <span className="fw-bold text-primary">€{f.pricePerPerson}</span>
                    )}
                  </td>
                  <td className="text-end" style={{ verticalAlign: editingId === f.id ? 'top' : 'middle' }}>
                    {editingId === f.id ? (
                      <div className="d-flex gap-2 justify-content-end">
                        <Button size="sm" variant="success" onClick={saveEdit}><FaSave /></Button>
                        <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <Button variant="link" className="text-secondary p-0 me-3" onClick={() => startEdit(f)}>
                          <FaEdit />
                        </Button>
                        <Button variant="link" className="text-secondary p-0 me-3" onClick={() => handleDuplicate(f)}>
                          <FaClone />
                        </Button>
                        <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(f.id)}>
                          <FaTrash />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {flights.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    No flight options yet. Use Quick Add above.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Add Flights</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label className="fw-semibold">Paste one flight per line</Form.Label>
          <Form.Text className="d-block mb-2 text-muted">
            Format: `description, price, link, startDate, endDate`
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
                      <th>Description</th>
                      <th>Price</th>
                      <th>Link</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedBulkFlights.map((row, index) => (
                      <tr key={`${row.link}-${index}`}>
                        <td>{row.description || '-'}</td>
                        <td>{row.pricePerPerson || '-'}</td>
                        <td className="text-truncate" style={{ maxWidth: '240px' }}>{row.link || '-'}</td>
                        <td className={row.error ? 'text-danger' : 'text-success'}>
                          {row.error || 'Ready'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleBulkImport} disabled={validBulkFlights.length === 0}>
            Import {validBulkFlights.length > 0 ? validBulkFlights.length : ''} Flights
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FlightManager;
