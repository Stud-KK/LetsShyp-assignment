import { Injectable, NotFoundException } from '@nestjs/common';
import { Courier } from './courier.entity';

// Simple in-memory store with initial couriers
const couriers: Map<string, Courier> = new Map();

// Initialize with some sample couriers
function initializeCouriers() {
  const initialCouriers: Courier[] = [
    { id: 'courier-1', name: 'John Doe', location: { x: 0, y: 0 }, isAvailable: true },
    { id: 'courier-2', name: 'Jane Smith', location: { x: 5, y: 5 }, isAvailable: true },
    { id: 'courier-3', name: 'Bob Johnson', location: { x: 10, y: 10 }, isAvailable: true },
    { id: 'courier-4', name: 'Alice Brown', location: { x: 15, y: 15 }, isAvailable: true },
    { id: 'courier-5', name: 'Charlie Wilson', location: { x: 20, y: 20 }, isAvailable: true },
  ];

  initialCouriers.forEach(courier => {
    couriers.set(courier.id, courier);
  });
}

// Initialize on module load
initializeCouriers();

@Injectable()
export class CourierService {
  // Get all couriers
  getAllCouriers(): Courier[] {
    return Array.from(couriers.values());
  }

  // Get available couriers (thread-safe by checking availability)
  getAvailableCouriers(): Courier[] {
    return Array.from(couriers.values()).filter(c => c.isAvailable);
  }

  // Get courier by ID
  getCourierById(id: string): Courier {
    const courier = couriers.get(id);
    if (!courier) {
      throw new NotFoundException(`Courier with ID ${id} not found`);
    }
    return courier;
  }

  // Reserve courier (atomic operation to prevent race conditions)
  reserveCourier(id: string): boolean {
    const courier = couriers.get(id);
    if (!courier || !courier.isAvailable) {
      return false;
    }
    courier.isAvailable = false;
    return true;
  }

  // Release courier
  releaseCourier(id: string): void {
    const courier = couriers.get(id);
    if (courier) {
      courier.isAvailable = true;
    }
  }

  // Update courier location
  updateCourierLocation(id: string, location: { x: number; y: number }): Courier {
    const courier = this.getCourierById(id);
    courier.location = location;
    return courier;
  }
}

