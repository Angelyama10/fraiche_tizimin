import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateSpecialRequestDto } from './special-request.dto';
import { SpecialRequestsService } from './special-requests.service';

@Controller('special-requests')
export class SpecialRequestsController {
  constructor(private readonly requests: SpecialRequestsService) {}

  @Post()
  create(@Body() input: CreateSpecialRequestDto) {
    return this.requests.create(input);
  }

  @Get(':publicToken')
  get(@Param('publicToken') publicToken: string) {
    return this.requests.get(publicToken);
  }
}
