import { DeliveryType } from '../order.entity';

export interface Location {
  x: number;
  y: number;
}

export class CreateOrderDto {
  pickupLocation: Location;
  dropLocation: Location;
  deliveryType: DeliveryType;
  packageDetails?: string;
  vehicleDetails?: string;
}

