import { OrderItemStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateOrderItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(OrderItemStatus)
  status?: OrderItemStatus;
}
