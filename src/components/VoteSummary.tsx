import React, { useMemo } from 'react';
import { Modal, Badge, ProgressBar } from 'react-bootstrap';
import { Destination, TripVotes } from '../types';
import { formatCurrency } from '../utils/budget';
import { FaMapMarkerAlt, FaPlaneDeparture, FaHotel, FaTrophy } from 'react-icons/fa';

interface Props {
  show: boolean;
  onHide: () => void;
  destinations: Destination[];
  votes: TripVotes;
  tripMembers: string[];
}

interface RankedItem {
  id: string;
  label: string;
  sublabel: string;
  voters: string[];
  count: number;
}

const rankItems = (
  ids: string[],
  voteMap: Record<string, string[]>,
  labelFn: (id: string) => { label: string; sublabel: string } | null
): RankedItem[] => {
  return ids
    .map((id) => {
      const info = labelFn(id);
      if (!info) return null;
      const voters = voteMap[id] || [];
      return { id, label: info.label, sublabel: info.sublabel, voters, count: voters.length };
    })
    .filter((item): item is RankedItem => item !== null && item.count > 0)
    .sort((a, b) => b.count - a.count);
};

const RankedList: React.FC<{ items: RankedItem[]; maxVotes: number; icon: React.ReactNode; emptyText: string }> = ({ items, maxVotes, icon, emptyText }) => {
  if (items.length === 0) {
    return <div className="text-muted small py-2">{emptyText}</div>;
  }

  return (
    <div className="vote-ranked-list">
      {items.map((item, index) => (
        <div key={item.id} className="vote-ranked-item">
          <div className="vote-rank">
            {index === 0 && item.count > 0 ? (
              <FaTrophy className="text-warning" size={14} />
            ) : (
              <span className="text-muted small">#{index + 1}</span>
            )}
          </div>
          <div className="vote-ranked-info">
            <div className="d-flex align-items-center gap-2">
              <span className="opacity-50">{icon}</span>
              <strong className="text-truncate">{item.label}</strong>
              <Badge bg={item.count > 0 ? 'primary' : 'secondary'} pill className="ms-auto flex-shrink-0">
                {item.count} vote{item.count === 1 ? '' : 's'}
              </Badge>
            </div>
            <div className="small text-muted text-truncate">{item.sublabel}</div>
            {maxVotes > 0 && (
              <ProgressBar
                now={item.count}
                max={maxVotes}
                variant={index === 0 && item.count > 0 ? 'success' : 'primary'}
                style={{ height: 4, marginTop: 4 }}
              />
            )}
            {item.voters.length > 0 && (
              <div className="small text-muted mt-1">{item.voters.join(', ')}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const VoteSummary: React.FC<Props> = ({ show, onHide, destinations, votes, tripMembers }) => {
  const allFlights = useMemo(() => destinations.flatMap((d) => d.flights.map((f) => ({ ...f, destName: d.name }))), [destinations]);
  const allAccommodations = useMemo(() => destinations.flatMap((d) => d.accommodations.map((a) => ({ ...a, destName: d.name }))), [destinations]);

  const rankedDestinations = useMemo(() => rankItems(
    destinations.map((d) => d.id),
    votes.destinations,
    (id) => {
      const d = destinations.find((dest) => dest.id === id);
      if (!d) return null;
      return {
        label: d.name,
        sublabel: `${d.flights.length} flights, ${d.accommodations.length} stays`
      };
    }
  ), [destinations, votes.destinations]);

  const rankedFlights = useMemo(() => rankItems(
    allFlights.map((f) => f.id),
    votes.flights,
    (id) => {
      const f = allFlights.find((fl) => fl.id === id);
      if (!f) return null;
      return {
        label: f.description || 'Flight Option',
        sublabel: [f.destName, f.startDate && f.endDate ? `${f.startDate} to ${f.endDate}` : '', formatCurrency(f.pricePerPerson) + '/pp'].filter(Boolean).join(' · ')
      };
    }
  ), [allFlights, votes.flights]);

  const rankedAccommodations = useMemo(() => rankItems(
    allAccommodations.map((a) => a.id),
    votes.accommodations,
    (id) => {
      const a = allAccommodations.find((acc) => acc.id === id);
      if (!a) return null;
      return {
        label: a.description || 'Accommodation Option',
        sublabel: [a.destName, a.startDate && a.endDate ? `${a.startDate} to ${a.endDate}` : '', formatCurrency(a.totalPrice) + ' total'].filter(Boolean).join(' · ')
      };
    }
  ), [allAccommodations, votes.accommodations]);

  const maxDestVotes = rankedDestinations[0]?.count || 0;
  const maxFlightVotes = rankedFlights[0]?.count || 0;
  const maxAccVotes = rankedAccommodations[0]?.count || 0;

  const totalVoters = tripMembers.length;
  const votersWhoVoted = useMemo(() => {
    const names = new Set<string>();
    for (const voters of Object.values(votes.destinations)) voters.forEach((n) => names.add(n));
    for (const voters of Object.values(votes.flights)) voters.forEach((n) => names.add(n));
    for (const voters of Object.values(votes.accommodations)) voters.forEach((n) => names.add(n));
    return names.size;
  }, [votes]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Vote Results</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex gap-3 mb-4">
          <Badge bg="light" text="dark" className="px-3 py-2">
            {totalVoters} member{totalVoters === 1 ? '' : 's'}
          </Badge>
          <Badge bg="light" text="dark" className="px-3 py-2">
            {votersWhoVoted} voted
          </Badge>
        </div>

        <h6 className="d-flex align-items-center gap-2 mb-3">
          <FaMapMarkerAlt className="text-primary" /> Destinations
        </h6>
        <RankedList
          items={rankedDestinations}
          maxVotes={maxDestVotes}
          icon={<FaMapMarkerAlt size={12} />}
          emptyText="No destinations to rank."
        />

        <hr />

        <h6 className="d-flex align-items-center gap-2 mb-3">
          <FaPlaneDeparture className="text-primary" /> Flights
        </h6>
        <RankedList
          items={rankedFlights}
          maxVotes={maxFlightVotes}
          icon={<FaPlaneDeparture size={12} />}
          emptyText="No flights to rank."
        />

        <hr />

        <h6 className="d-flex align-items-center gap-2 mb-3">
          <FaHotel className="text-primary" /> Accommodations
        </h6>
        <RankedList
          items={rankedAccommodations}
          maxVotes={maxAccVotes}
          icon={<FaHotel size={12} />}
          emptyText="No accommodations to rank."
        />
      </Modal.Body>
    </Modal>
  );
};

export default VoteSummary;
