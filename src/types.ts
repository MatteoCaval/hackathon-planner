export interface Flight {
  id: string;
  link: string;
  startDate: string;
  endDate: string;
  pricePerPerson: number;
}

export interface Accommodation {
  id: string;
  link: string;
  description: string;
  totalPrice: number;
}

export interface Destination {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  totalBudget: number;
  flights: Flight[];
  accommodations: Accommodation[];
}

export const DUBLIN_COORDS: [number, number] = [53.3498, -6.2603];
