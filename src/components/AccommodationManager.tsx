import React, { useState } from 'react';
import { Table, Button, Form, Card } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { Accommodation } from '../types';
import { FaTrash, FaEdit, FaSave, FaExternalLinkAlt, FaPlus, FaHotel } from 'react-icons/fa';

interface Props {
  accommodations: Accommodation[];
  onChange: (acc: Accommodation[]) => void;
}

const AccommodationManager: React.FC<Props> = ({ accommodations, onChange }) => {
  const [newAcc, setNewAcc] = useState<Partial<Accommodation>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Accommodation>>({});

  const handleAdd = () => {
    if (newAcc.link && newAcc.totalPrice) {
      const acc: Accommodation = {
        id: uuidv4(),
        link: newAcc.link,
        description: newAcc.description || '',
        totalPrice: Number(newAcc.totalPrice),
        startDate: newAcc.startDate || '',
        endDate: newAcc.endDate || '',
      };
      onChange([...accommodations, acc]);
      setNewAcc({});
    }
  };

  const handleRemove = (id: string) => {
    onChange(accommodations.filter(a => a.id !== id));
  };
  
  const startEdit = (acc: Accommodation) => {
      setEditingId(acc.id);
      setEditForm(acc);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };
  
  const saveEdit = () => {
      if (editingId && editForm.link && editForm.totalPrice) {
        const updated = accommodations.map(a => {
            if (a.id === editingId) {
                return {
                    ...a,
                    ...editForm,
                    totalPrice: Number(editForm.totalPrice)
                } as Accommodation;
            }
            return a;
        });
        onChange(updated);
        cancelEdit();
      }
  };

  return (
    <Card className="mb-4 h-100">
      <Card.Header className="d-flex align-items-center gap-2 bg-white">
        <FaHotel className="text-primary" />
        <span className="h6 mb-0">Accommodation Options</span>
      </Card.Header>
      <Card.Body className="p-0">
        <Table hover responsive className="mb-0 align-middle">
          <thead className="bg-light">
            <tr>
              <th style={{ width: '50%' }}>Description & Dates</th>
              <th style={{ width: '25%' }}>Total Price</th>
              <th style={{ width: '25%' }}></th>
            </tr>
          </thead>
          <tbody>
            {accommodations.map(a => (
              <tr key={a.id}>
                <td>
                    {editingId === a.id ? (
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
                            <div className="fw-bold text-dark">{a.description}</div>
                            <div className="text-muted small my-1">
                                {a.startDate && a.endDate ? (
                                    <span>{a.startDate} <span className="mx-1">to</span> {a.endDate}</span>
                                ) : (
                                    <span className="fst-italic text-black-50">No dates set</span>
                                )}
                            </div>
                            <a href={a.link} target="_blank" rel="noreferrer" className="small text-decoration-none d-flex align-items-center gap-1">
                                View Property <FaExternalLinkAlt size={10} />
                            </a>
                        </>
                    )}
                </td>
                <td style={{ verticalAlign: editingId === a.id ? 'top' : 'middle' }}>
                    {editingId === a.id ? (
                        <Form.Control 
                            size="sm" 
                            type="number" 
                            value={editForm.totalPrice} 
                            onChange={e => setEditForm({...editForm, totalPrice: Number(e.target.value)})} 
                        />
                    ) : (
                        <span className="fw-bold text-primary">€{a.totalPrice}</span>
                    )}
                </td>
                <td className="text-end" style={{ verticalAlign: editingId === a.id ? 'top' : 'middle' }}>
                    {editingId === a.id ? (
                        <div className="d-flex gap-2 justify-content-end">
                             <Button size="sm" variant="success" onClick={saveEdit}><FaSave /></Button>
                             <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="link" className="text-secondary p-0 me-3" onClick={() => startEdit(a)}>
                                <FaEdit />
                            </Button>
                            <Button variant="link" className="text-danger p-0" onClick={() => handleRemove(a.id)}>
                                <FaTrash />
                            </Button>
                        </>
                    )}
                </td>
              </tr>
            ))}
            <tr className="bg-light border-top">
              <td>
                <Form.Control 
                  size="sm" 
                  placeholder="Description" 
                  value={newAcc.description || ''} 
                  onChange={e => setNewAcc({...newAcc, description: e.target.value})} 
                  className="mb-2"
                />
                <div className="d-flex gap-1 mb-2">
                    <Form.Control 
                    size="sm" 
                    type="date"
                    value={newAcc.startDate || ''} 
                    onChange={e => {
                        const newStart = e.target.value;
                        setNewAcc(prev => ({
                            ...prev, 
                            startDate: newStart,
                            // Reset end date if it's before the new start date
                            endDate: prev.endDate && prev.endDate < newStart ? '' : prev.endDate
                        }));
                    }} 
                    />
                    <Form.Control 
                    size="sm" 
                    type="date"
                    value={newAcc.endDate || ''} 
                    min={newAcc.startDate || ''}
                    onChange={e => setNewAcc({...newAcc, endDate: e.target.value})} 
                    />
                </div>
                <Form.Control 
                  size="sm" 
                  placeholder="https://..." 
                  value={newAcc.link || ''} 
                  onChange={e => setNewAcc({...newAcc, link: e.target.value})} 
                />
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <Form.Control 
                  size="sm" 
                  type="number" 
                  placeholder="Price €" 
                  value={newAcc.totalPrice || ''} 
                  onChange={e => setNewAcc({...newAcc, totalPrice: Number(e.target.value)})} 
                />
              </td>
              <td className="text-end" style={{ verticalAlign: 'top' }}>
                  <Button size="sm" variant="primary" onClick={handleAdd} disabled={!newAcc.link || !newAcc.totalPrice}>
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

export default AccommodationManager;
