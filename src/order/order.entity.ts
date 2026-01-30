export enum OrderStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum DeliveryType {
  EXPRESS = 'EXPRESS',
  NORMAL = 'NORMAL',
}

export interface Location {
  x: number;
  y: number;
}

export interface Order {
  id: string;
  pickupLocation: Location;
  dropLocation: Location;
  deliveryType: DeliveryType;
  packageDetails?: string;
  vehicleDetails?: string;
  status: OrderStatus;
  courierId?: string;
  createdAt: Date;
  updatedAt: Date;
}

