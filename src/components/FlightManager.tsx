import React, { useState } from 'react';
import { Table, Button, Form, Card } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Flight } from '../types';
import { FaTrash, FaExternalLinkAlt, FaPlus, FaPlaneDeparture, FaEdit, FaSave } from 'react-icons/fa';

interface Props {
  flights: Flight[];
  onChange: (flights: Flight[]) => void;
}

const FlightManager: React.FC<Props> = ({ flights, onChange }) => {
  const [newFlight, setNewFlight] = useState<Partial<Flight>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Flight>>({});

  const handleAdd = () => {
    if (newFlight.link && newFlight.pricePerPerson) {
      const flight: Flight = {
        id: uuidv4(),
        link: newFlight.link,
        description: newFlight.description || '',
        startDate: newFlight.startDate || '',
        endDate: newFlight.endDate || '',
        pricePerPerson: Number(newFlight.pricePerPerson),
      };
      onChange([...flights, flight]);
      setNewFlight({});
    }
  };

  const handleRemove = (id: string) => {
    onChange(flights.filter(f => f.id !== id));
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

  return (
    <Card className="mb-4 h-100">
      <Card.Header className="d-flex align-items-center gap-2 bg-white">
        <FaPlaneDeparture className="text-primary" />
        <span className="h6 mb-0">Flight Options</span>
      </Card.Header>
      <Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="bg-light">
            <tr>
              <th style={{ width: '50%' }}>Description & Dates</th>
              <th style={{ width: '25%' }}>Price/Person</th>
              <th style={{ width: '25%' }}></th>
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
                                onChange={e => setEditForm({...editForm, description: e.target.value})} 
                             />
                             <div className="d-flex gap-1">
                                <Form.Control 
                                    size="sm" 
                                    type="date"
                                    value={editForm.startDate || ''} 
                                    onChange={e => {
                                        const newStart = e.target.value;
                                        setEditForm(prev => ({
                                            ...prev, 
                                            startDate: newStart,
                                            endDate: prev.endDate && prev.endDate < newStart ? '' : prev.endDate
                                        }));
                                    }} 
                                />
                                <Form.Control 
                                    size="sm" 
                                    type="date"
                                    value={editForm.endDate || ''} 
                                    min={editForm.startDate || ''}
                                    onChange={e => setEditForm({...editForm, endDate: e.target.value})} 
                                />
                             </div>
                             <Form.Control 
                                size="sm" 
                                placeholder="Link" 
                                value={editForm.link || ''} 
                                onChange={e => setEditForm({...editForm, link: e.target.value})} 
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
                            value={editForm.pricePerPerson} 
                            onChange={e => setEditForm({...editForm, pricePerPerson: Number(e.target.value)})} 
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
                            <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(f.id)}>
                                <FaTrash />
                            </Button>
                        </>
                    )}
                </td>
              </tr>
            ))}
            <tr className="bg-light border-top">
              <td>
                <div className="d-flex flex-column gap-2">
                    <Form.Control 
                    size="sm" 
                    placeholder="Description (e.g. Ryanair Morning)" 
                    value={newFlight.description || ''} 
                    onChange={e => setNewFlight({...newFlight, description: e.target.value})} 
                    />
                    <div className="d-flex gap-1">
                        <Form.Control 
                        size="sm" 
                        type="date"
                        value={newFlight.startDate || ''} 
                        onChange={e => {
                            const newStart = e.target.value;
                            setNewFlight(prev => ({
                                ...prev, 
                                startDate: newStart,
                                endDate: prev.endDate && prev.endDate < newStart ? '' : prev.endDate
                            }));
                        }} 
                        />
                        <Form.Control 
                        size="sm" 
                        type="date"
                        value={newFlight.endDate || ''} 
                        min={newFlight.startDate || ''}
                        onChange={e => setNewFlight({...newFlight, endDate: e.target.value})} 
                        />
                    </div>
                    <Form.Control 
                    size="sm" 
                    placeholder="Link (https://...)" 
                    value={newFlight.link || ''} 
                    onChange={e => setNewFlight({...newFlight, link: e.target.value})} 
                    />
                </div>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <Form.Control 
                  size="sm" 
                  type="number" 
                  placeholder="Price €" 
                  value={newFlight.pricePerPerson || ''} 
                  onChange={e => setNewFlight({...newFlight, pricePerPerson: Number(e.target.value)})} 
                />
              </td>
              <td className="text-end" style={{ verticalAlign: 'top' }}>
                  <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newFlight.link || !newFlight.pricePerPerson}>
                    <FaPlus />
                  </Button>
              </td>
            </tr>
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default FlightManager;
