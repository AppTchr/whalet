import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsUUID,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsNotFutureDate(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (!value) return true;
          return new Date(value as string) <= new Date();
        },
        defaultMessage() {
          return 'paidAt must not be a future date';
        },
      },
    });
  };
}

export class PayFaturaDto {
  @ApiProperty({ description: 'Conta bancária para débito UUID', format: 'uuid' })
  @IsUUID()
  bankAccountId: string;

  @ApiPropertyOptional({ description: 'Data do pagamento (ISO 8601). Default: now em BRT. Não pode ser futura.' })
  @IsOptional()
  @IsDateString()
  @IsNotFutureDate()
  paidAt?: string;
}
