import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { AuthenticatedCustomer } from './customer-jwt.strategy';
import { CustomerAddressDto, UpdateCustomerAddressDto, UpdateCustomerProfileDto } from './customers.dto';
import { CustomersService } from './customers.service';

type CustomerRequest = Request & { user: AuthenticatedCustomer };

@Controller('customers/me')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  profile(@Req() request: CustomerRequest) {
    return this.customers.profile(request.user.customerId);
  }

  @Patch()
  updateProfile(@Req() request: CustomerRequest, @Body() input: UpdateCustomerProfileDto) {
    return this.customers.updateProfile(request.user.customerId, input);
  }

  @Get('addresses')
  addresses(@Req() request: CustomerRequest) {
    return this.customers.addresses(request.user.customerId);
  }

  @Post('addresses')
  createAddress(@Req() request: CustomerRequest, @Body() input: CustomerAddressDto) {
    return this.customers.createAddress(request.user.customerId, input);
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @Req() request: CustomerRequest,
    @Param('addressId') addressId: string,
    @Body() input: UpdateCustomerAddressDto,
  ) {
    return this.customers.updateAddress(request.user.customerId, addressId, input);
  }

  @Delete('addresses/:addressId')
  deleteAddress(@Req() request: CustomerRequest, @Param('addressId') addressId: string) {
    return this.customers.deleteAddress(request.user.customerId, addressId);
  }

  @Post('carts/:cartToken/claim')
  claimCart(@Req() request: CustomerRequest, @Param('cartToken') cartToken: string) {
    return this.customers.claimCart(request.user.customerId, cartToken);
  }

  @Get('wishlist')
  wishlist(@Req() request: CustomerRequest) {
    return this.customers.wishlist(request.user.customerId);
  }

  @Post('wishlist/:productId')
  addWishlistItem(@Req() request: CustomerRequest, @Param('productId') productId: string) {
    return this.customers.addWishlistItem(request.user.customerId, productId);
  }

  @Delete('wishlist/:productId')
  removeWishlistItem(@Req() request: CustomerRequest, @Param('productId') productId: string) {
    return this.customers.removeWishlistItem(request.user.customerId, productId);
  }
}
