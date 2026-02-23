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
    <aside className="sidebar-container h-100 d-flex flex-column" aria-label="Destinations sidebar">
      <div className="sidebar-header d-flex align-items-center justify-content-between">
        <span className="sidebar-label">Destinations</span>
        <span className="sidebar-count" aria-label={`${destinations.length} destinations`}>
          {destinations.length}
        </span>
      </div>

      <div className="flex-grow-1 overflow-auto sidebar-list">
        <Nav as="ul" className="flex-column gap-1">
          {destinations.map((destination) => (
            <Nav.Item as="li" key={destination.id}>
              <div className={`nav-link-custom ${activeId === destination.id ? 'active' : ''}`}>
                <button
                  type="button"
                  className="destination-select-btn d-flex align-items-center gap-2 border-0 bg-transparent p-0 m-0 flex-grow-1 text-start"
                  onClick={() => onSelect(destination.id)}
                  aria-current={activeId === destination.id ? 'page' : undefined}
                  aria-label={`Open destination ${destination.name}`}
                >
                  <FaMapMarkerAlt className="opacity-75" aria-hidden="true" />
                  <span className="flex-grow-1 text-truncate">{destination.name}</span>
                </button>
                <button
                  type="button"
                  className="nav-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(destination.id);
                  }}
                  aria-label={`Remove destination ${destination.name}`}
                  title="Remove destination"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            </Nav.Item>
          ))}
        </Nav>

        {destinations.length === 0 && (
          <div className="sidebar-empty" role="status">
            No destinations yet. Add one to get started.
          </div>
        )}
      </div>

      <div className="sidebar-footer mt-auto">
        <Button
          variant="primary"
          className="w-100 d-flex align-items-center justify-content-center gap-2"
          onClick={onAddClick}
          aria-label="Add destination"
        >
          <FaPlus /> Add Destination
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
