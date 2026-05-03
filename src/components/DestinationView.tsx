import React from 'react';
import { Accommodation, BudgetAttempt, Destination, ExtraCost, Flight, PlannerSettings, TripVotes } from '../types';
import { DEFAULT_SEARCH_LINKS } from '../utils/bookingLinks';
import FlightManager from './FlightManager';
import AccommodationManager from './AccommodationManager';
import BudgetCalculator from './BudgetCalculator';
import { calculateBudgetSnapshot } from '../utils/budget';

interface Props {
  destination: Destination;
  settings: PlannerSettings;
  onUpdate: (destinationId: string, updater: (currentDestination: Destination) => Destination) => void;
  votes: TripVotes;
  currentPerson: string;
  onToggleVote: (category: keyof TripVotes, entityId: string) => void;
  onSectionChange?: (section: string) => void;
}

const UNSPLASH_FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=70';

const DestinationView: React.FC<Props> = ({ destination, settings, onUpdate, votes, currentPerson, onToggleVote }) => {
  const commitUpdate = (updater: (currentDestination: Destination) => Destination) => {
    onUpdate(destination.id, updater);
  };

  const handleFlightsChange = (flights: Flight[]) => {
    commitUpdate((d) => {
      const validFlightIds = new Set(flights.map((f) => f.id));
      const nextFlightAssignments = Object.entries(d.budgetEstimator.flightAssignments).reduce<Record<string, number>>((acc, [fid, count]) => {
        if (validFlightIds.has(fid)) acc[fid] = count;
        return acc;
      }, {});
      const nextAttempts = d.budgetEstimator.attempts.slice(0, 1).map((attempt) => {
        const nextAttemptAssignments = Object.entries(attempt.flightAssignments).reduce<Record<string, number>>((acc, [fid, count]) => {
          if (validFlightIds.has(fid)) acc[fid] = count;
          return acc;
        }, {});
        const snapshot = calculateBudgetSnapshot({
          flights, accommodations: d.accommodations, flightAssignments: nextAttemptAssignments,
          selectedAccommodationId: attempt.selectedAccommodationId, extraCosts: d.extraCosts, settings
        });
        return { ...attempt, flightAssignments: nextAttemptAssignments, totalCost: snapshot.totalCost, remaining: snapshot.remaining, perPersonTotal: snapshot.perPersonTotal };
      });
      return { ...d, flights, budgetEstimator: { ...d.budgetEstimator, flightAssignments: nextFlightAssignments, attempts: nextAttempts, fixedAttemptId: nextAttempts[0]?.id || '' } };
    });
  };

  const handleAccChange = (accommodations: Accommodation[]) => {
    commitUpdate((d) => {
      const selectedAccommodationId = accommodations.some((a) => a.id === d.budgetEstimator.selectedAccommodationId)
        ? d.budgetEstimator.selectedAccommodationId : '';
      const validIds = new Set(accommodations.map((a) => a.id));
      const nextAttempts = d.budgetEstimator.attempts.slice(0, 1).map((attempt) => {
        const nextAccId = validIds.has(attempt.selectedAccommodationId) ? attempt.selectedAccommodationId : '';
        const snapshot = calculateBudgetSnapshot({
          flights: d.flights, accommodations, flightAssignments: attempt.flightAssignments,
          selectedAccommodationId: nextAccId, extraCosts: d.extraCosts, settings
        });
        return { ...attempt, selectedAccommodationId: nextAccId, totalCost: snapshot.totalCost, remaining: snapshot.remaining, perPersonTotal: snapshot.perPersonTotal };
      });
      return { ...d, accommodations, budgetEstimator: { ...d.budgetEstimator, selectedAccommodationId, attempts: nextAttempts, fixedAttemptId: nextAttempts[0]?.id || '' } };
    });
  };

  const handleFlightDraftChange = (flightDraft: Partial<Flight>) => {
    commitUpdate((d) => ({ ...d, flightDraft }));
  };

  const handleAccommodationDraftChange = (accommodationDraft: Partial<Accommodation>) => {
    commitUpdate((d) => ({ ...d, accommodationDraft }));
  };

  const handleCustomGroupLinksChange = (customGroupLinks: Record<string, Record<string, string>>) => {
    commitUpdate((d) => ({ ...d, customGroupLinks: Object.keys(customGroupLinks).length > 0 ? customGroupLinks : undefined }));
  };

  const handleStayLinksChange = (stayLinks: { label: string; url: string }[]) => {
    commitUpdate((d) => ({ ...d, stayLinks: stayLinks.length > 0 ? stayLinks : undefined }));
  };

  const handleExtraCostsChange = (extraCosts: ExtraCost[]) => {
    commitUpdate((d) => ({ ...d, extraCosts }));
  };

  const handleFlightAssignmentsChange = (flightAssignments: Record<string, number>) => {
    commitUpdate((d) => ({ ...d, budgetEstimator: { ...d.budgetEstimator, flightAssignments } }));
  };

  const handleSelectedAccommodationChange = (selectedAccommodationId: string) => {
    commitUpdate((d) => ({ ...d, budgetEstimator: { ...d.budgetEstimator, selectedAccommodationId } }));
  };

  const handleAttemptsChange = (attempts: BudgetAttempt[]) => {
    const next = attempts.slice(0, 5);
    commitUpdate((d) => ({
      ...d,
      budgetEstimator: {
        ...d.budgetEstimator,
        attempts: next,
        fixedAttemptId: next.length > 0 ? (d.budgetEstimator.fixedAttemptId || next[0]?.id || '') : ''
      }
    }));
  };

  const handleFixedAttemptIdChange = (fixedAttemptId: string) => {
    commitUpdate((d) => ({
      ...d,
      budgetEstimator: {
        ...d.budgetEstimator,
        fixedAttemptId: fixedAttemptId && d.budgetEstimator.attempts.some((a) => a.id === fixedAttemptId) ? fixedAttemptId : ''
      }
    }));
  };

  const flightVoteCount = destination.flights.reduce((sum, f) => sum + (votes.flights[f.id]?.length || 0), 0);
  const accVoteCount = destination.accommodations.reduce((sum, a) => sum + (votes.accommodations[a.id]?.length || 0), 0);

  return (
    <>
      {/* Hero */}
      <section className="hero" aria-label={`${destination.name} overview`}>
        <div className="hero-photo" style={{ backgroundImage: `url(${UNSPLASH_FALLBACK})` }}>
        </div>
        <div className="hero-info">
          <div>
            <div className="hero-eyebrow">{destination.name}</div>
            <h1 className="hero-title">{destination.name}</h1>
            <p className="hero-subtitle">{destination.notes ? destination.notes.slice(0, 80) + (destination.notes.length > 80 ? '…' : '') : 'Add notes in the sidebar to describe this destination.'}</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="label">Flight options</div>
              <div className="value">{destination.flights.length}</div>
            </div>
            <div className="hero-stat">
              <div className="label">Stays</div>
              <div className="value">{destination.accommodations.length}</div>
            </div>
            <div className="hero-stat">
              <div className="label">Total votes</div>
              <div className="value">{flightVoteCount + accVoteCount}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Flights */}
      <FlightManager
        flights={destination.flights}
        onChange={handleFlightsChange}
        draft={destination.flightDraft}
        onDraftChange={handleFlightDraftChange}
        destinationName={destination.name}
        searchLinks={settings.searchLinks || DEFAULT_SEARCH_LINKS}
        votes={votes.flights}
        currentPerson={currentPerson}
        onToggleVote={(flightId) => onToggleVote('flights', flightId)}
      />

      {/* Accommodations */}
      <AccommodationManager
        accommodations={destination.accommodations}
        flights={destination.flights}
        onChange={handleAccChange}
        draft={destination.accommodationDraft}
        onDraftChange={handleAccommodationDraftChange}
        destinationName={destination.name}
        searchLinks={settings.searchLinks || DEFAULT_SEARCH_LINKS}
        peopleCount={settings.peopleCount}
        votes={votes.accommodations}
        currentPerson={currentPerson}
        onToggleVote={(accId) => onToggleVote('accommodations', accId)}
        customGroupLinks={destination.customGroupLinks || {}}
        onCustomGroupLinksChange={handleCustomGroupLinksChange}
        stayLinks={destination.stayLinks || []}
        onStayLinksChange={handleStayLinksChange}
      />

      {/* Final plan / budget calculator */}
      <BudgetCalculator
        flights={destination.flights}
        accommodations={destination.accommodations}
        settings={settings}
        extraCosts={destination.extraCosts}
        onExtraCostsChange={handleExtraCostsChange}
        flightAssignments={destination.budgetEstimator.flightAssignments}
        onFlightAssignmentsChange={handleFlightAssignmentsChange}
        selectedAccommodationId={destination.budgetEstimator.selectedAccommodationId}
        onSelectedAccommodationChange={handleSelectedAccommodationChange}
        attempts={destination.budgetEstimator.attempts}
        fixedAttemptId={destination.budgetEstimator.fixedAttemptId}
        onAttemptsChange={handleAttemptsChange}
        onFixedAttemptIdChange={handleFixedAttemptIdChange}
      />
    </>
  );
};

export default DestinationView;
