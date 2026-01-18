import React from 'react';
import { Nav, Button } from 'react-bootstrap';
import { Destination } from '../types';
import { FaMapMarkerAlt, FaPlus, FaTrash } from 'react-icons/fa';

interface Props {
  destinations: Destination[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onRemove: (id: string) => void;
}

const Sidebar: React.FC<Props> = ({ destinations, activeId, onSelect, onAddClick, onRemove }) => {
  return (
    <div className="sidebar-container h-100 d-flex flex-column" style={{ width: '280px', minWidth: '280px' }}>
      <div className="p-3 pb-0">
        <div className="mb-3 px-2">
          <small className="text-uppercase text-muted fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>Destinations</small>
        </div>
      </div>
      
      <div className="flex-grow-1 overflow-auto px-3">
        <Nav className="flex-column">
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
      </div>
      
      <div className="p-3 border-top bg-light mt-auto">
          <Button variant="primary" className="w-100 d-flex align-items-center justify-content-center gap-2 py-2" onClick={onAddClick}>
            <FaPlus /> Add Destination
          </Button>
      </div>
    </div>
  );
};

export default Sidebar;