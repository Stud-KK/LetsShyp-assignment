export interface Location {
  x: number;
  y: number;
}

export interface Courier {
  id: string;
  name: string;
  location: Location;
  isAvailable: boolean;
}

