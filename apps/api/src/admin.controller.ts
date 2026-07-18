import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProductLine, UserRole } from '@prisma/client';
import {
  BulkUpdatePricesDto,
  CreatePromotionDto,
  CreateShipmentDto,
  ListAdminInventoryDto,
  ListAdminOrdersDto,
  ListAdminProductsDto,
  ListPromotionsDto,
  PaginationDto,
  UpdateOrderStatusDto,
  UpdatePricingPolicyDto,
  UpdatePromotionDto,
  UpdateShipmentDto,
} from './admin-commerce.dto';
import { AdminCommerceService } from './admin-commerce.service';
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
import { ShipmentsService } from './shipments.service';
import { InventoryAlertsService } from './inventory-alerts.service';

type AuthenticatedRequest = { user: AuthenticatedUser };

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly commerce: AdminCommerceService,
    private readonly payments: PaymentsService,
    private readonly shipments: ShipmentsService,
    private readonly inventoryAlerts: InventoryAlertsService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.commerce.dashboard();
  }

  @Get('products')
  listProducts(@Query() query: ListAdminProductsDto) {
    return this.commerce.listProducts(query);
  }

  @Get('inventory')
  listInventory(@Query() query: ListAdminInventoryDto) {
    return this.commerce.listInventory(query);
  }

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
  listOrders(@Query() query: ListAdminOrdersDto) {
    return this.commerce.listOrders(query);
  }

  @Get('orders/:publicToken')
  getOrder(@Param('publicToken') publicToken: string) {
    return this.commerce.getOrder(publicToken);
  }

  @Patch('orders/:publicToken/status')
  updateOrderStatus(
    @Param('publicToken') publicToken: string,
    @Body() input: UpdateOrderStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.updateOrderStatus(publicToken, input, request.user.userId);
  }

  @Post('orders/:publicToken/shipments')
  createShipment(
    @Param('publicToken') publicToken: string,
    @Body() input: CreateShipmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shipments.create(publicToken, input, request.user.userId);
  }

  @Patch('shipments/:shipmentId')
  updateShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() input: UpdateShipmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shipments.update(shipmentId, input, request.user.userId);
  }

  @Get('promotions')
  listPromotions(@Query() query: ListPromotionsDto) {
    return this.commerce.listPromotions(query);
  }

  @Roles(UserRole.ADMIN)
  @Post('promotions')
  createPromotion(@Body() input: CreatePromotionDto, @Req() request: AuthenticatedRequest) {
    return this.commerce.createPromotion(input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('promotions/:id')
  updatePromotion(
    @Param('id') id: string,
    @Body() input: UpdatePromotionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.updatePromotion(id, input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('pricing-policies/:line')
  updatePricingPolicy(
    @Param('line', new ParseEnumPipe(ProductLine)) line: ProductLine,
    @Body() input: UpdatePricingPolicyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.updatePricingPolicy(line, input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('prices/bulk')
  bulkUpdatePrices(
    @Body() input: BulkUpdatePricesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commerce.bulkUpdatePrices(input, request.user.userId);
  }

  @Get('inventory-alerts')
  listInventoryAlerts(@Query() query: PaginationDto) {
    return this.inventoryAlerts.list(query);
  }

  @Post('inventory-alerts/scan')
  async scanInventory() {
    await this.inventoryAlerts.scan();
    return { scanned: true };
  }

  @Post('inventory-alerts/:alertId/acknowledge')
  acknowledgeInventoryAlert(
    @Param('alertId') alertId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryAlerts.acknowledge(alertId, request.user.userId);
  }
}
