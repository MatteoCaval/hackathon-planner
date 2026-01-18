import React, { useState } from 'react';
import { Nav, Button, Modal, Form, InputGroup, Spinner } from 'react-bootstrap';
import { Destination } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  destinations: Destination[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (d: Destination) => void;
  onRemove: (id: string) => void;
}

const Sidebar: React.FC<Props> = ({ destinations, activeId, onSelect, onAdd, onRemove }) => {
  const [showModal, setShowModal] = useState(false);
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
      setShowModal(false);
      setNewName('');
      setNewLat('');
      setNewLng('');
    }
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
    <div className="bg-light border-end vh-100 p-3" style={{ width: '250px', minWidth: '250px' }}>
      <h5 className="mb-3">Destinations</h5>
      <Nav className="flex-column mb-3">
        {destinations.map(d => (
          <Nav.Item key={d.id} className="d-flex align-items-center justify-content-between mb-2">
            <Button 
              variant={activeId === d.id ? 'primary' : 'outline-secondary'} 
              className="text-start flex-grow-1 me-2 text-truncate"
              onClick={() => onSelect(d.id)}
            >
              {d.name}
            </Button>
            <Button 
                variant="outline-danger" 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); onRemove(d.id); }}
                title="Remove"
            >×</Button>
          </Nav.Item>
        ))}
      </Nav>
      <Button variant="success" className="w-100" onClick={() => setShowModal(true)}>
        + Add Destination
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Destination</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>City Name</Form.Label>
              <InputGroup>
                <Form.Control 
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
            <div className="row">
                <div className="col-6">
                    <Form.Group className="mb-3">
                    <Form.Label>Latitude</Form.Label>
                    <Form.Control type="number" value={newLat} onChange={e => setNewLat(e.target.value)} placeholder="0.00" />
                    </Form.Group>
                </div>
                <div className="col-6">
                    <Form.Group className="mb-3">
                    <Form.Label>Longitude</Form.Label>
                    <Form.Control type="number" value={newLng} onChange={e => setNewLng(e.target.value)} placeholder="0.00" />
                    </Form.Group>
                </div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!newName || !newLat || !newLng}>Add</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Sidebar;
