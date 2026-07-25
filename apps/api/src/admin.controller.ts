import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
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
  ListAdminNotificationsDto,
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
import { AdminNotificationsService } from './admin-notifications.service';
import {
  CompleteMediaAssetDto,
  PresignMediaAssetDto,
  UpdateSiteContentDto,
} from './content/content.dto';
import { SiteContentService } from './content/site-content.service';

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
    private readonly notifications: AdminNotificationsService,
    private readonly siteContent: SiteContentService,
  ) {}

  @Roles(UserRole.ADMIN)
  @Get('content')
  getSiteContent() {
    return this.siteContent.getAdminContent();
  }

  @Roles(UserRole.ADMIN)
  @Put('content/draft')
  saveSiteContentDraft(
    @Body() input: UpdateSiteContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.siteContent.saveDraft(input.content, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Post('content/publish')
  publishSiteContent(@Req() request: AuthenticatedRequest) {
    return this.siteContent.publish(request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Post('content/preview')
  createSiteContentPreview(@Req() request: AuthenticatedRequest) {
    return this.siteContent.createPreviewToken(request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Get('media')
  listMedia(@Query() query: PaginationDto) {
    return this.siteContent.listMedia(query.page, query.pageSize);
  }

  @Roles(UserRole.ADMIN)
  @Post('media/presign')
  presignMedia(
    @Body() input: PresignMediaAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.siteContent.presignMedia(input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Post('media/:id/complete')
  completeMedia(
    @Param('id') id: string,
    @Body() input: CompleteMediaAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.siteContent.completeMedia(id, input, request.user.userId);
  }

  @Roles(UserRole.ADMIN)
  @Delete('media/:id')
  archiveMedia(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.siteContent.archiveMedia(id, request.user.userId);
  }

  @Get('dashboard')
  dashboard() {
    return this.commerce.dashboard();
  }

  @Get('notifications')
  listNotifications(
    @Query() query: ListAdminNotificationsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.list(request.user.userId, query);
  }

  @Patch('notifications/read-all')
  markAllNotificationsRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.user.userId);
  }

  @Patch('notifications/:notificationId/read')
  markNotificationRead(
    @Param('notificationId') notificationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.markRead(request.user.userId, notificationId);
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
