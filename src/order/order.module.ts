import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { CourierModule } from '../courier/courier.module';

@Module({
  imports: [CourierModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}

