import { IsOptional, IsUUID } from 'class-validator';

export class CreateOrderDto {
  /** Local de la orden (obligatorio; validado contra el tenant). */
  @IsUUID()
  venueId!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;
}
