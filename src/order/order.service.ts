import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus, DeliveryType } from './order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CourierService } from '../courier/courier.service';
import { v4 as uuidv4 } from 'uuid';

// Simple in-memory store
const orders: Map<string, Order> = new Map();

// State transition rules
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// Express order distance threshold
const EXPRESS_DISTANCE_THRESHOLD = 10;

@Injectable()
export class OrderService {
  constructor(private readonly courierService: CourierService) {}

  // Calculate Manhattan distance
  private calculateDistance(loc1: { x: number; y: number }, loc2: { x: number; y: number }): number {
    return Math.abs(loc1.x - loc2.x) + Math.abs(loc1.y - loc2.y);
  }

  // Find nearest available courier
  private findNearestCourier(pickupLocation: { x: number; y: number }, deliveryType: DeliveryType): { courierId: string; distance: number } | null {
    const availableCouriers = this.courierService.getAvailableCouriers();
    
    if (availableCouriers.length === 0) {
      return null;
    }

    let nearest: { courierId: string; distance: number } | null = null;

    for (const courier of availableCouriers) {
      const distance = this.calculateDistance(pickupLocation, courier.location);
      
      // Express orders must be within threshold
      if (deliveryType === DeliveryType.EXPRESS && distance > EXPRESS_DISTANCE_THRESHOLD) {
        continue;
      }

      if (!nearest || distance < nearest.distance) {
        nearest = { courierId: courier.id, distance };
      }
    }

    return nearest;
  }

  // Create order with atomic assignment
  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const orderId = uuidv4();
    const now = new Date();

    // Try to assign courier atomically
    const nearestCourier = this.findNearestCourier(createOrderDto.pickupLocation, createOrderDto.deliveryType);
    
    let courierId: string | undefined;
    let status: OrderStatus = OrderStatus.CREATED;
    let assignmentReason: string | undefined;

    if (nearestCourier) {
      // Try to reserve courier (atomic operation)
      const reserved = this.courierService.reserveCourier(nearestCourier.courierId);
      if (reserved) {
        courierId = nearestCourier.courierId;
        status = OrderStatus.ASSIGNED;
      } else {
        assignmentReason = 'Courier was just assigned to another order';
      }
    } else {
      if (createOrderDto.deliveryType === DeliveryType.EXPRESS) {
        assignmentReason = `No courier available within ${EXPRESS_DISTANCE_THRESHOLD} units for express delivery`;
      } else {
        assignmentReason = 'No available couriers at the moment';
      }
    }

    const order: Order = {
      id: orderId,
      ...createOrderDto,
      status,
      courierId,
      createdAt: now,
      updatedAt: now,
    };

    orders.set(orderId, order);

    // Add assignment reason to response if not assigned
    if (!courierId && assignmentReason) {
      (order as any).assignmentReason = assignmentReason;
    }

    return order;
  }

  // Get all orders
  getAllOrders(): Order[] {
    return Array.from(orders.values());
  }

  // Get order by ID
  getOrderById(id: string): Order {
    const order = orders.get(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  // Update order status with validation
  async updateOrderStatus(id: string, newStatus: OrderStatus): Promise<Order> {
    const order = orders.get(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Validate state transition
    const validNextStates = VALID_TRANSITIONS[order.status];
    if (!validNextStates.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${order.status} to ${newStatus}. Valid transitions: ${validNextStates.join(', ')}`
      );
    }

    // Update order
    order.status = newStatus;
    order.updatedAt = new Date();

    // If cancelled, release courier
    if (newStatus === OrderStatus.CANCELLED && order.courierId) {
      this.courierService.releaseCourier(order.courierId);
      order.courierId = undefined;
    }

    // If delivered, release courier
    if (newStatus === OrderStatus.DELIVERED && order.courierId) {
      this.courierService.releaseCourier(order.courierId);
    }

    return order;
  }

  // Simulate courier movement and auto-progress order
  async simulateCourierMovement(courierId: string): Promise<{ order?: Order; message: string }> {
    const courier = this.courierService.getCourierById(courierId);
    if (!courier) {
      throw new NotFoundException(`Courier with ID ${courierId} not found`);
    }

    const activeOrder = this.getOrderByCourierId(courierId);
    if (!activeOrder) {
      return { message: 'Courier has no active order' };
    }

    // Move courier towards target location
    let targetLocation = activeOrder.pickupLocation;
    if (activeOrder.status === OrderStatus.ASSIGNED) {
      targetLocation = activeOrder.pickupLocation;
    } else if (activeOrder.status === OrderStatus.PICKED_UP) {
      targetLocation = activeOrder.dropLocation;
    }

    // Simple movement: move 1 unit towards target
    const dx = targetLocation.x - courier.location.x;
    const dy = targetLocation.y - courier.location.y;

    if (Math.abs(dx) > 0) {
      courier.location.x += dx > 0 ? 1 : -1;
    } else if (Math.abs(dy) > 0) {
      courier.location.y += dy > 0 ? 1 : -1;
    }

    // Check if reached pickup location
    if (activeOrder.status === OrderStatus.ASSIGNED) {
      const distanceToPickup = this.calculateDistance(courier.location, activeOrder.pickupLocation);
      if (distanceToPickup === 0) {
        await this.updateOrderStatus(activeOrder.id, OrderStatus.PICKED_UP);
        const updatedOrder = this.getOrderById(activeOrder.id);
        return { order: updatedOrder, message: 'Courier reached pickup location. Order status updated to PICKED_UP' };
      }
    }

    // Check if reached drop location
    if (activeOrder.status === OrderStatus.PICKED_UP || activeOrder.status === OrderStatus.IN_TRANSIT) {
      const distanceToDrop = this.calculateDistance(courier.location, activeOrder.dropLocation);
      if (distanceToDrop === 0) {
        if (activeOrder.status === OrderStatus.PICKED_UP) {
          await this.updateOrderStatus(activeOrder.id, OrderStatus.IN_TRANSIT);
        }
        await this.updateOrderStatus(activeOrder.id, OrderStatus.DELIVERED);
        const updatedOrder = this.getOrderById(activeOrder.id);
        return { order: updatedOrder, message: 'Courier reached drop location. Order status updated to DELIVERED' };
      } else if (activeOrder.status === OrderStatus.PICKED_UP) {
        await this.updateOrderStatus(activeOrder.id, OrderStatus.IN_TRANSIT);
        const updatedOrder = this.getOrderById(activeOrder.id);
        return { order: updatedOrder, message: 'Order status updated to IN_TRANSIT' };
      }
    }

    return { order: activeOrder, message: 'Courier moved. Order status unchanged' };
  }

  // Get order by courier ID
  private getOrderByCourierId(courierId: string): Order | undefined {
    for (const order of orders.values()) {
      if (order.courierId === courierId && 
          order.status !== OrderStatus.DELIVERED && 
          order.status !== OrderStatus.CANCELLED) {
        return order;
      }
    }
    return undefined;
  }
}

