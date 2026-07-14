import { IsUUID } from 'class-validator';

export class CreateSubscriptionDto {
  /** Plan al que se suscribe (o al que se cambia). */
  @IsUUID()
  planId!: string;
}
