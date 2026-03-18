import { SearchLinkTemplate } from '../types';

export const DEFAULT_SEARCH_LINKS: SearchLinkTemplate[] = [
  {
    id: 'google-flights',
    label: 'Google Flights',
    urlTemplate: 'https://www.google.com/travel/flights?q=flights+from+{origin}+to+{destination}+{startDate}+to+{endDate}',
    type: 'flight',
    enabled: true
  },
  {
    id: 'ryanair',
    label: 'Ryanair',
    urlTemplate: 'https://www.ryanair.com/gb/en/trip/flights/select?adults=1&dateOut={startDate}&origin=DUB&destination=&isReturn=true&dateIn={endDate}',
    type: 'flight',
    enabled: true
  },
  {
    id: 'booking-com',
    label: 'Booking.com',
    urlTemplate: 'https://www.booking.com/searchresults.html?ss={destination}&checkin={startDate}&checkout={endDate}&group_adults={people}',
    type: 'accommodation',
    enabled: true
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    urlTemplate: 'https://www.airbnb.com/s/{destination}/homes?checkin={startDate}&checkout={endDate}&adults={people}',
    type: 'accommodation',
    enabled: true
  }
];

interface BookingLink {
  label: string;
  url: string;
}

const buildUrl = (
  template: string,
  origin: string,
  destination: string,
  startDate: string,
  endDate: string,
  people?: number
): string => {
  return template
    .replace(/\{origin\}/g, encodeURIComponent(origin || 'Dublin'))
    .replace(/\{destination\}/g, encodeURIComponent(destination))
    .replace(/\{startDate\}/g, startDate)
    .replace(/\{endDate\}/g, endDate)
    .replace(/\{people\}/g, String(people ?? 1));
};

export const getFlightSearchLinks = (
  templates: SearchLinkTemplate[],
  origin: string,
  destinationName: string,
  startDate: string,
  endDate: string
): BookingLink[] => {
  return templates
    .filter((t) => t.type === 'flight' && t.enabled)
    .map((t) => ({
      label: t.label,
      url: buildUrl(t.urlTemplate, origin, destinationName, startDate, endDate)
    }));
};

export const getAccommodationSearchLinks = (
  templates: SearchLinkTemplate[],
  destinationName: string,
  startDate: string,
  endDate: string,
  peopleCount?: number
): BookingLink[] => {
  return templates
    .filter((t) => t.type === 'accommodation' && t.enabled)
    .map((t) => ({
      label: t.label,
      url: buildUrl(t.urlTemplate, '', destinationName, startDate, endDate, peopleCount)
    }));
};
