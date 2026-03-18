import React, { useState } from 'react';
import { Dropdown, Form } from 'react-bootstrap';
import { FaUserCircle } from 'react-icons/fa';

interface Props {
  currentPerson: string;
  onPersonChange: (name: string) => void;
  tripMembers: string[];
  onAddMember: (name: string) => void;
}

const PersonSelector: React.FC<Props> = ({ currentPerson, onPersonChange, tripMembers, onAddMember }) => {
  const [newName, setNewName] = useState('');

  const handleAddAndSelect = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!tripMembers.includes(trimmed)) {
      onAddMember(trimmed);
    }
    onPersonChange(trimmed);
    setNewName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddAndSelect();
    }
  };

  return (
    <Dropdown className="person-selector">
      <Dropdown.Toggle size="sm" variant={currentPerson ? 'primary' : 'outline-secondary'} id="person-selector-toggle">
        <FaUserCircle className="me-1" />
        {currentPerson || 'Who are you?'}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {tripMembers.map((member) => (
          <Dropdown.Item
            key={member}
            active={member === currentPerson}
            onClick={() => onPersonChange(member)}
          >
            {member}
          </Dropdown.Item>
        ))}
        {tripMembers.length > 0 && <Dropdown.Divider />}
        <div className="px-3 py-2 d-flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Form.Control
            size="sm"
            placeholder="Add name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Add new trip member"
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleAddAndSelect}
            disabled={!newName.trim()}
          >
            Add
          </button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default PersonSelector;
