import { Controller, Get, Param } from '@nestjs/common';
import { CourierService } from './courier.service';

@Controller('couriers')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get()
  getAllCouriers() {
    return this.courierService.getAllCouriers();
  }

  @Get('available')
  getAvailableCouriers() {
    return this.courierService.getAvailableCouriers();
  }

  @Get(':id')
  getCourierById(@Param('id') id: string) {
    return this.courierService.getCourierById(id);
  }
}

