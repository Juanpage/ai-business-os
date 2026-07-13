import { IsUUID } from 'class-validator';

export class ApplyPromotionDto {
  @IsUUID()
  promotionId!: string;
}
