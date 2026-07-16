import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

@Module({ providers: [ReservationsService] })
export class ReservationsModule {}
