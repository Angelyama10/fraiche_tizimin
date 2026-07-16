import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  CreateProductDto,
  ReviewTransferProofDto,
  UpdateInventoryDto,
  UpdateProductDto,
  UpdateSpecialRequestDto,
  UpdateVariantDto,
} from './admin.dto';
import { AdminService } from './admin.service';
import { JwtAuthGuard, Roles } from './auth.guard';
import { AuthenticatedUser } from './jwt.strategy';
import { PaymentsService } from './payments.service';
import { RolesGuard } from './roles.guard';

type AuthenticatedRequest = { user: AuthenticatedUser };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly payments: PaymentsService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Post('products')
  createProduct(@Body() input: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.admin.createProduct(input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.admin.updateProduct(id, input, request.user.userId);
  }

  @Patch('variants/:id')
  updateVariant(
    @Param('id') id: string,
    @Body() input: UpdateVariantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.admin.updateVariant(id, input, request.user.userId);
  }

  @Patch('inventory/:variantId')
  updateInventory(
    @Param('variantId') variantId: string,
    @Body() input: UpdateInventoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.admin.updateInventory(variantId, input, request.user.userId);
  }

  @Patch('transfer-proofs/:proofId')
  reviewTransferProof(
    @Param('proofId') proofId: string,
    @Body() input: ReviewTransferProofDto,
  ) {
    return this.payments.reviewTransferProof(proofId, input.status, input.notes);
  }

  @Post('orders/:orderToken/confirm-cash')
  confirmCash(@Param('orderToken') orderToken: string) {
    return this.payments.confirmCashPayment(orderToken);
  }

  @Patch('special-requests/:publicToken')
  updateSpecialRequest(
    @Param('publicToken') publicToken: string,
    @Body() input: UpdateSpecialRequestDto,
  ) {
    return this.admin.updateSpecialRequest(publicToken, input);
  }

  @Get('orders')
  listOrders() {
    return this.admin.listOrders();
  }
}
