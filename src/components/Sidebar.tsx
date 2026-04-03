import React, { useMemo, useState } from 'react';
import { Nav, Button, Form, Modal } from 'react-bootstrap';
import { Destination } from '../types';
import { FaMapMarkerAlt, FaPlus, FaTrash, FaSearch, FaExclamationTriangle } from 'react-icons/fa';
import VoteButton from './VoteButton';

type SidebarSort = 'added' | 'name-asc' | 'name-desc' | 'votes';

interface Props {
  destinations: Destination[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddClick: () => void;
  onRemove: (id: string) => void;
  votes: Record<string, string[]>;
  currentPerson: string;
  onToggleVote: (destId: string) => void;
}

const Sidebar: React.FC<Props> = ({ destinations, activeId, onSelect, onAddClick, onRemove, votes, currentPerson, onToggleVote }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);
  const [sortBy, setSortBy] = useState<SidebarSort>('added');

  const filteredDestinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? destinations.filter((destination) => destination.name.toLowerCase().includes(query))
      : [...destinations];

    if (sortBy === 'name-asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'votes') {
      filtered.sort((a, b) => (votes[b.id]?.length ?? 0) - (votes[a.id]?.length ?? 0));
    }

    return filtered;
  }, [destinations, searchQuery, sortBy, votes]);

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

        <Form.Select
          size="sm"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SidebarSort)}
          aria-label="Sort destinations"
          className="mt-2"
        >
          <option value="added">Added order</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="votes">Most votes</option>
        </Form.Select>
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
                <VoteButton
                  voters={votes[destination.id] || []}
                  currentPerson={currentPerson}
                  onToggle={() => onToggleVote(destination.id)}
                />
                <button
                  type="button"
                  className="nav-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingRemove({ id: destination.id, name: destination.name });
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

      <Modal show={pendingRemove !== null} onHide={() => setPendingRemove(null)} centered size="sm">
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <FaExclamationTriangle size={32} className="text-danger" />
          </div>
          <h5 className="fw-semibold mb-2">Remove destination?</h5>
          <p className="text-muted mb-0">
            <strong>{pendingRemove?.name}</strong> and all its flights, stays and budget data will be permanently deleted.
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pt-0 pb-3 gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setPendingRemove(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (pendingRemove) {
                onRemove(pendingRemove.id);
                setPendingRemove(null);
              }
            }}
          >
            <FaTrash className="me-1" /> Remove
          </Button>
        </Modal.Footer>
      </Modal>
    </aside>
  );
};

export default Sidebar;
