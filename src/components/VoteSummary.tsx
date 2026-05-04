import React, { useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { Destination, TripVotes } from '../types';
import { formatCurrency } from '../utils/budget';
import { FaPlane, FaBed, FaMapMarkerAlt } from 'react-icons/fa';

interface Props {
  show: boolean;
  onHide: () => void;
  destinations: Destination[];
  votes: TripVotes;
  tripMembers: string[];
}

const initials = (name: string) => name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const AVATAR_COLORS = ['#3a6b8c', '#5e6b4e', '#b8523a', '#8c5e3a', '#5e3a8c', '#3a8c6b', '#a55c3e', '#4e6b6b'];
const getColor = (name: string) => AVATAR_COLORS[Math.abs(name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

const AvatarStack: React.FC<{ names: string[]; max?: number }> = ({ names, max = 5 }) => {
  const visible = names.slice(0, max);
  const overflow = names.length - visible.length;
  return (
    <span className="stack" style={{ display: 'inline-flex' }}>
      {visible.map((n) => (
        <span key={n} className="av" style={{ width: 22, height: 22, background: getColor(n), borderRadius: '50%', marginLeft: -5, border: '2px solid var(--surface-0)', fontSize: 10, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600 }}>
          {initials(n)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="av" style={{ width: 22, height: 22, background: 'var(--ink-3)', borderRadius: '50%', marginLeft: -5, border: '2px solid var(--surface-0)', fontSize: 10, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600 }}>
          +{overflow}
        </span>
      )}
    </span>
  );
};

const VoteSummary: React.FC<Props> = ({ show, onHide, destinations, votes }) => {
  const allFlights = useMemo(() => destinations.flatMap((d) => d.flights.map((f) => ({ ...f, destName: d.name }))), [destinations]);
  const allAccommodations = useMemo(() => destinations.flatMap((d) => d.accommodations.map((a) => ({ ...a, destName: d.name }))), [destinations]);

  const destRows = useMemo(() => {
    return destinations.map((d) => {
      const flightVotes = d.flights.flatMap((f) => votes.flights[f.id] || []);
      const accVotes = d.accommodations.flatMap((a) => votes.accommodations[a.id] || []);
      const destVotes = votes.destinations[d.id] || [];
      const all = [...destVotes, ...flightVotes, ...accVotes];
      const uniqueVoters = [...new Set(all)];
      return { dest: d, total: all.length, voters: uniqueVoters };
    }).sort((a, b) => b.total - a.total);
  }, [destinations, votes]);

  const topFlights = useMemo(() => {
    return allFlights
      .map((f) => ({ ...f, voteCount: (votes.flights[f.id] || []).length, voters: votes.flights[f.id] || [] }))
      .filter((f) => f.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 5);
  }, [allFlights, votes.flights]);

  const topStays = useMemo(() => {
    return allAccommodations
      .map((a) => ({ ...a, voteCount: (votes.accommodations[a.id] || []).length, voters: votes.accommodations[a.id] || [] }))
      .filter((a) => a.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 5);
  }, [allAccommodations, votes.accommodations]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Where the team is leaning</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28 }}>
        {/* Destinations */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <FaMapMarkerAlt size={14} style={{ color: 'var(--accent)' }} />
            <h5 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>Destinations</h5>
          </div>
          <div className="leader-rows">
            {destRows.map((r, i) => (
              <div key={r.dest.id} className={`leader-row${i === 0 && r.total > 0 ? ' top' : ''}`}>
                <div className="rank">{i + 1}</div>
                <div className="info">
                  <div className="label">{r.dest.name}</div>
                  <div className="sub">{r.total} total {r.total === 1 ? 'vote' : 'votes'}</div>
                </div>
                <AvatarStack names={r.voters} max={5} />
              </div>
            ))}
          </div>
        </div>

        {/* Top flights */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <FaPlane size={14} style={{ color: 'var(--accent)' }} />
            <h5 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>Top flight options</h5>
          </div>
          <div className="leader-rows">
            {topFlights.map((f, i) => (
              <div key={f.id} className={`leader-row${i === 0 ? ' top' : ''}`}>
                <div className="rank">{i + 1}</div>
                <div className="info">
                  <div className="label">{f.origin ? `${f.origin} →` : ''} {f.description || 'Flight'} · {formatCurrency(f.pricePerPerson)}</div>
                  <div className="sub">{f.destName}</div>
                </div>
                <AvatarStack names={f.voters} max={5} />
              </div>
            ))}
            {topFlights.length === 0 && <div className="empty"><div className="em-icon">✈</div>No votes on flights yet.</div>}
          </div>
        </div>

        {/* Top stays */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <FaBed size={14} style={{ color: 'var(--sage)' }} />
            <h5 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>Top stays</h5>
          </div>
          <div className="leader-rows">
            {topStays.map((s, i) => (
              <div key={s.id} className={`leader-row${i === 0 ? ' top' : ''}`}>
                <div className="rank">{i + 1}</div>
                <div className="info">
                  <div className="label">{s.description || 'Stay'}</div>
                  <div className="sub">{s.destName} · {formatCurrency(s.totalPrice)}</div>
                </div>
                <AvatarStack names={s.voters} max={5} />
              </div>
            ))}
            {topStays.length === 0 && <div className="empty"><div className="em-icon">🏠</div>No votes on stays yet.</div>}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default VoteSummary;
