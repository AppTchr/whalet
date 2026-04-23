import { IsInt, IsPositive } from 'class-validator';

export class UpsertBudgetDto {
  @IsInt()
  @IsPositive()
  amountCents: number;
}
