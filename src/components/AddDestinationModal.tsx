import React, { useMemo, useState } from 'react';
import { Modal, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { Destination } from '../types';

interface Props {
  show: boolean;
  onHide: () => void;
  onAdd: (d: Destination) => void;
}

const isFiniteNumber = (value: string): boolean => {
  if (value.trim() === '') {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed);
};

const AddDestinationModal: React.FC<Props> = ({ show, onHide, onAdd }) => {
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'error' | 'success' | 'warning'; message: string } | null>(null);

  const isNameValid = useMemo(() => newName.trim().length > 0, [newName]);
  const isLatValid = useMemo(() => isFiniteNumber(newLat), [newLat]);
  const isLngValid = useMemo(() => isFiniteNumber(newLng), [newLng]);
  const isFormValid = isNameValid && isLatValid && isLngValid;

  const handleAdd = () => {
    setAttemptedSubmit(true);
    if (!isFormValid) {
      setStatusMessage({ kind: 'error', message: 'Please complete all required fields.' });
      return;
    }

    const newDest: Destination = {
      id: uuidv4(),
      name: newName.trim(),
      latitude: parseFloat(newLat),
      longitude: parseFloat(newLng),
      notes: '',
      extraCosts: [],
      budgetEstimator: {
        flightAssignments: {},
        selectedAccommodationId: ''
      },
      flightDraft: {},
      accommodationDraft: {},
      flights: [],
      accommodations: []
    };

    onAdd(newDest);
    handleClose();
  };

  const handleClose = () => {
    setNewName('');
    setNewLat('');
    setNewLng('');
    setAttemptedSubmit(false);
    setStatusMessage(null);
    onHide();
  };

  const handleSearch = async () => {
    if (!newName.trim()) {
      setStatusMessage({ kind: 'warning', message: 'Enter a city name before searching.' });
      return;
    }

    setIsSearching(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newName)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setNewLat(data[0].lat);
        setNewLng(data[0].lon);
        setStatusMessage({ kind: 'success', message: 'Coordinates updated from search result.' });
      } else {
        setStatusMessage({ kind: 'warning', message: 'Location not found. Please edit manually.' });
      }
    } catch (error) {
      console.error('Geocoding failed', error);
      setStatusMessage({ kind: 'error', message: 'Search failed. Please try again.' });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      contentClassName="border-0 shadow-lg"
      aria-labelledby="add-destination-title"
    >
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title id="add-destination-title" className="h5 fw-bold">Add Destination</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form noValidate>
          <Form.Group className="mb-4">
            <Form.Label className="text-muted small fw-bold">CITY NAME</Form.Label>
            <InputGroup>
              <InputGroup.Text className="bg-white border-end-0">
                <FaSearch className="text-muted" />
              </InputGroup.Text>
              <Form.Control
                className="border-start-0 ps-0"
                value={newName}
                isInvalid={attemptedSubmit && !isNameValid}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (attemptedSubmit) setStatusMessage(null);
                }}
                placeholder="e.g. Lisbon"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                aria-label="Destination city name"
              />
              <Button variant="outline-primary" onClick={handleSearch} disabled={isSearching || !newName.trim()}>
                {isSearching ? <Spinner animation="border" size="sm" /> : 'Find'}
              </Button>
            </InputGroup>
            <Form.Control.Feedback type="invalid">City name is required.</Form.Control.Feedback>
            <Form.Text className="text-muted">Use Find to auto-fill coordinates.</Form.Text>
          </Form.Group>

          <div className="row g-3">
            <div className="col-6">
              <Form.Group>
                <Form.Label className="text-muted small fw-bold">LATITUDE</Form.Label>
                <Form.Control
                  type="number"
                  value={newLat}
                  isInvalid={attemptedSubmit && !isLatValid}
                  onChange={e => setNewLat(e.target.value)}
                  placeholder="0.00"
                  aria-label="Latitude"
                />
                <Form.Control.Feedback type="invalid">Valid latitude is required.</Form.Control.Feedback>
              </Form.Group>
            </div>
            <div className="col-6">
              <Form.Group>
                <Form.Label className="text-muted small fw-bold">LONGITUDE</Form.Label>
                <Form.Control
                  type="number"
                  value={newLng}
                  isInvalid={attemptedSubmit && !isLngValid}
                  onChange={e => setNewLng(e.target.value)}
                  placeholder="0.00"
                  aria-label="Longitude"
                />
                <Form.Control.Feedback type="invalid">Valid longitude is required.</Form.Control.Feedback>
              </Form.Group>
            </div>
          </div>

          {statusMessage && (
            <div className={`inline-status ${statusMessage.kind === 'error' ? 'error' : statusMessage.kind}`} role="status" aria-live="polite">
              {statusMessage.message}
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="light" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleAdd} disabled={!isFormValid}>Add Destination</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddDestinationModal;
