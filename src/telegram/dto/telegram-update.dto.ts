export class TelegramChatDto {
  id: number;
  type: string;
}

export class TelegramFromDto {
  id: number;
  username?: string;    // opcional, no todos tienen username
  first_name?: string;
}

export class TelegramMessageDto {
  message_id: number;
  chat: TelegramChatDto;
  from: TelegramFromDto;
  text?: string;        // opcional, puede ser foto, sticker, etc.
}

export class TelegramUpdateDto {
  update_id: number;
  message?: TelegramMessageDto;  // opcional, hay otros tipos de updates
}