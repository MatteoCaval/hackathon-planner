import React, { useState } from 'react';
import { Modal, Form, Button, InputGroup, Spinner } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import { v4 as uuidv4 } from 'uuid';
import { Destination } from '../types';

interface Props {
  show: boolean;
  onHide: () => void;
  onAdd: (d: Destination) => void;
}

const AddDestinationModal: React.FC<Props> = ({ show, onHide, onAdd }) => {
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleAdd = () => {
    if (newName && newLat && newLng) {
      const newDest: Destination = {
        id: uuidv4(),
        name: newName,
        latitude: parseFloat(newLat),
        longitude: parseFloat(newLng),
        totalBudget: 5000,
        flights: [],
        accommodations: []
      };
      onAdd(newDest);
      handleClose();
    }
  };

  const handleClose = () => {
    setNewName('');
    setNewLat('');
    setNewLng('');
    onHide();
  };

  const handleSearch = async () => {
    if (!newName) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newName)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setNewLat(data[0].lat);
        setNewLng(data[0].lon);
      } else {
          alert('Location not found. Please check spelling or enter coordinates manually.');
      }
    } catch (error) {
      console.error("Geocoding failed", error);
      alert('Error searching for location.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered contentClassName="border-0 shadow-lg" style={{ borderRadius: '16px' }}>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="h5 fw-bold">Add New Destination</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group className="mb-4">
            <Form.Label className="text-muted small fw-bold">CITY NAME</Form.Label>
            <InputGroup>
              <InputGroup.Text className="bg-white border-end-0">
                  <FaSearch className="text-muted" />
              </InputGroup.Text>
              <Form.Control 
                  className="border-start-0 ps-0"
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="e.g. Lisbon" 
                  onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSearch(); }}}
              />
              <Button variant="outline-primary" onClick={handleSearch} disabled={isSearching || !newName}>
                {isSearching ? <Spinner animation="border" size="sm" /> : 'Find'}
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">Click 'Find' to auto-fill coordinates.</Form.Text>
          </Form.Group>
          
          <div className="row g-3">
              <div className="col-6">
                  <Form.Group>
                  <Form.Label className="text-muted small fw-bold">LATITUDE</Form.Label>
                  <Form.Control type="number" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="0.00" />
                  </Form.Group>
              </div>
              <div className="col-6">
                  <Form.Group>
                  <Form.Label className="text-muted small fw-bold">LONGITUDE</Form.Label>
                  <Form.Control type="number" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="0.00" />
                  </Form.Group>
              </div>
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer className="border-0 pt-0">
        <Button variant="light" onClick={handleClose}>Cancel</Button>
        <Button variant="primary" onClick={handleAdd} disabled={!newName || !newLat || !newLng}>Add Destination</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddDestinationModal;
