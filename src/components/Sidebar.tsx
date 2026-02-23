import React, { useMemo, useState } from 'react';
import { Nav, Button, Form } from 'react-bootstrap';
import { Destination } from '../types';
import { FaMapMarkerAlt, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';

interface Props {
  destinations: Destination[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onRemove: (id: string) => void;
}

const Sidebar: React.FC<Props> = ({ destinations, activeId, onSelect, onAddClick, onRemove }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return destinations;
    }

    return destinations.filter((destination) => destination.name.toLowerCase().includes(query));
  }, [destinations, searchQuery]);

  return (
    <aside className="sidebar-container h-100 d-flex flex-column" aria-label="Destinations sidebar">
      <div className="sidebar-header">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <span className="sidebar-label">Destinations</span>
          <span className="sidebar-count" aria-label={`${destinations.length} destinations`}>
            {destinations.length}
          </span>
        </div>

        <Form.Group controlId="destination-search">
          <div className="sidebar-search">
            <FaSearch aria-hidden="true" />
            <Form.Control
              size="sm"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search destinations"
              aria-label="Search destinations"
            />
          </div>
        </Form.Group>
      </div>

      <div className="flex-grow-1 overflow-auto sidebar-list">
        <Nav as="ul" className="flex-column gap-1">
          {filteredDestinations.map((destination) => (
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

        {filteredDestinations.length === 0 && (
          <div className="sidebar-empty" role="status">
            {destinations.length === 0
              ? 'No destinations yet. Add one to get started.'
              : 'No destinations match this search.'}
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
