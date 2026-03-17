import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. leer las variables de entorno usando ConfigService
  const configService = app.get(ConfigService);
  const Port = configService.get<number>('PORT') || 3000;
  const ngrokUrl = configService.get<string>('NGROK_URL');
  const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
 

  // 2.registrar el webhook de Telegram automáticamente al iniciar la aplicación
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }));


  // 3. Registrar webhook en Telegram automáticamente
  const webhookUrl = `${ngrokUrl}/telegram/webhook`;
  await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
  console.log(`Webhook registrado en: ${webhookUrl}`);

  await app.listen(Port);
  console.log(`Servidor escuchando en el puerto ${Port}`);
}
bootstrap();
