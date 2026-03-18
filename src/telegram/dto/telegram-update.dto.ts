import { IsNumber, IsString, IsOptional, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class TelegramChatDto {
  @IsNumber()
  id: number;

  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  username?: string;
}

export class TelegramFromDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  @IsOptional()
  is_bot?: boolean;

  @IsString()
  @IsOptional()
  first_name?: string;

  @IsString()
  @IsOptional()
  last_name?: string;

  @IsString()
  @IsOptional()
  username?: string;
}

export class TelegramMessageDto {
  @IsNumber()
  message_id: number;

  @IsNumber()
  date: number;

  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat: TelegramChatDto;

  @ValidateNested()
  @IsOptional()
  @Type(() => TelegramFromDto)
  from?: TelegramFromDto;

  @IsString()
  @IsOptional()
  text?: string;
}

export class TelegramUpdateDto {
  @IsNumber()
  update_id: number;

  @ValidateNested()
  @IsOptional()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;
}