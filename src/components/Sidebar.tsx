import React, { useState } from 'react';
import { Nav, Button, Modal, Form, InputGroup, Spinner } from 'react-bootstrap';
import { Destination } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { FaMapMarkerAlt, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';

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
    <div className="sidebar-container vh-100 p-3 d-flex flex-column" style={{ width: '280px', minWidth: '280px' }}>
      <div className="mb-4 px-2">
        <small className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>Destinations</small>
      </div>
      
      <Nav className="flex-column mb-3 flex-grow-1 overflow-auto">
        {destinations.map(d => (
          <Nav.Item key={d.id} className="mb-1">
            <button 
              className={`nav-link-custom w-100 ${activeId === d.id ? 'active' : ''}`}
              onClick={() => onSelect(d.id)}
            >
              <FaMapMarkerAlt className="me-3 opacity-50" />
              <span className="flex-grow-1 text-truncate">{d.name}</span>
              
              <span 
                className="text-danger p-1 rounded-circle hover-bg-danger-light" 
                style={{ cursor: 'pointer', opacity: 0.6 }}
                onClick={(e) => { e.stopPropagation(); onRemove(d.id); }}
                title="Remove"
              >
                <FaTrash size={12} />
              </span>
            </button>
          </Nav.Item>
        ))}
        {destinations.length === 0 && (
            <div className="text-center text-muted mt-5">
                <small>No destinations yet.<br/>Add one to get started.</small>
            </div>
        )}
      </Nav>
      
      <Button variant="primary" className="w-100 d-flex align-items-center justify-content-center gap-2 py-2" onClick={() => setShowModal(true)}>
        <FaPlus /> Add Destination
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered contentClassName="border-0 shadow-lg" style={{ borderRadius: '16px' }}>
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
          <Button variant="light" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!newName || !newLat || !newLng}>Add Destination</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Sidebar;
