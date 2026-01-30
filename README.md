# Let's Shyp - Hyperlocal Booking & Courier Allocation Backend

A NestJS-based backend service for managing hyperlocal delivery orders with automatic courier assignment.

## Features

- **Order Management**: Create and manage delivery orders with strict state machine validation
- **Courier Management**: Maintain a pool of couriers with availability tracking
- **Auto-Assignment**: Automatically assign nearest available courier using Manhattan distance
- **Concurrency Safety**: Atomic operations prevent race conditions in courier assignment
- **Order Progression**: Simulate courier movement and auto-progress order states

## Installation

```bash
npm install
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000`

## API Endpoints

### Orders

#### Create Order
```
POST /orders
Content-Type: application/json

{
  "pickupLocation": { "x": 2, "y": 3 },
  "dropLocation": { "x": 10, "y": 15 },
  "deliveryType": "EXPRESS" | "NORMAL",
  "packageDetails": "Small package",
  "vehicleDetails": "Bike"
}
```

Response includes `assignmentReason` if order couldn't be assigned.

#### Get All Orders
```
GET /orders
```

#### Get Order by ID
```
GET /orders/:id
```

#### Update Order Status
```
PUT /orders/:id/status
Content-Type: application/json

{
  "status": "ASSIGNED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED"
}
```

Valid state transitions:
- CREATED → ASSIGNED, CANCELLED
- ASSIGNED → PICKED_UP, CANCELLED
- PICKED_UP → IN_TRANSIT
- IN_TRANSIT → DELIVERED
- DELIVERED → (terminal)
- CANCELLED → (terminal)

#### Simulate Courier Movement
```
POST /orders/courier/:courierId/move
```

Moves courier 1 unit towards target location and auto-progresses order state when conditions are met.

### Couriers

#### Get All Couriers
```
GET /couriers
```

#### Get Available Couriers
```
GET /couriers/available
```

#### Get Courier by ID
```
GET /couriers/:id
```

## Order State Machine

```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
   ↓         ↓
CANCELLED  CANCELLED
```

## Business Rules

1. **Express Orders**: Can only be assigned to couriers within 10 units (Manhattan distance)
2. **One Active Order per Courier**: A courier can handle only one active order at a time
3. **Atomic Assignment**: Courier reservation is atomic to prevent race conditions
4. **Auto-Progression**: Order states automatically progress when courier reaches locations

## Example Usage

### 1. Create an Express Order
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {"x": 1, "y": 1},
    "dropLocation": {"x": 5, "y": 5},
    "deliveryType": "EXPRESS",
    "packageDetails": "Urgent document"
  }'
```

### 2. Simulate Courier Movement
```bash
curl -X POST http://localhost:3000/orders/courier/courier-1/move
```

### 3. Check Order Status
```bash
curl http://localhost:3000/orders/{orderId}
```

## System Design Approach

The system uses a modular NestJS architecture with in-memory storage for simplicity. Order state transitions are enforced through a validation matrix. Courier assignment uses Manhattan distance calculation with atomic reservation to prevent race conditions. Express orders have a distance threshold (10 units) for eligibility.

## Concurrency Handling

Concurrency is handled through atomic courier reservation. The `reserveCourier()` method checks and sets availability in a single operation, preventing the same courier from being assigned to multiple concurrent orders. The in-memory Map operations are naturally atomic for single-key operations in Node.js's single-threaded event loop.

## Scalability Improvement

In production, I would implement a distributed lock mechanism (e.g., Redis-based locks) for courier reservation across multiple server instances. Additionally, I'd use a proper database (PostgreSQL) with row-level locking and optimistic/pessimistic locking strategies. A message queue (RabbitMQ/Kafka) would handle order creation events and enable horizontal scaling of the assignment logic.

