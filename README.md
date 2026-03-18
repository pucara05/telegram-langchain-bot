<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# 🤖 Telegram LangChain Bot

Bot inteligente para grupos de Telegram construido con **NestJS** y **LangChain**. Responde mensajes usando IA con memoria conversacional persistente.

## 🚀 Características

- Recibe mensajes de grupos de Telegram en tiempo real via webhook
- Responde usando IA (Groq - llama-3.1-8b-instant)
- Memoria conversacional persistente con **Redis** por chat
- Arquitectura modular con NestJS
- Validación de variables de entorno al arrancar
- Comando `/reset` para limpiar el historial

## 🛠️ Stack Tecnológico

- **Runtime:** Node.js
- **Framework:** NestJS
- **IA:** LangChain + Groq (llama-3.1-8b-instant)
- **Memoria:** Redis (Docker)
- **Tunnel:** ngrok (desarrollo local)
- **Package Manager:** pnpm

## 📋 Prerrequisitos

- Node.js >= 18
- pnpm
- Docker y Docker Compose
- Token de bot de [@BotFather](https://t.me/botfather)
- API Key de [Groq](https://console.groq.com)
- [ngrok](https://ngrok.com)

## ⚙️ Instalación

1. Clona el repositorio
```bash
git clone https://github.com/pucara05/telegram-langchain-bot.git
cd telegram-langchain-bot
```

2. Instala las dependencias
```bash
pnpm install
```

3. Configura las variables de entorno
```bash
cp .env.example .env
```

4. Edita el `.env` con tus credenciales

5. Levanta Redis
```bash
docker-compose up -d
```

## 🔐 Variables de Entorno
```env
TELEGRAM_BOT_TOKEN=    # Token de @BotFather
GROQ_API_KEY=          # API Key de Groq
NGROK_URL=             # URL de ngrok (desarrollo)
PORT=3000
REDIS_URL=redis://localhost:6379
```

## 🚀 Uso en Desarrollo

1. Inicia ngrok
```bash
ngrok http 3000
```

2. Copia la URL y pégala en `NGROK_URL` del `.env`

3. Inicia el servidor
```bash
pnpm run start:dev
```

4. Agrega el bot al grupo de Telegram como administrador

5. Escribe cualquier mensaje — el bot responderá con IA

## 💬 Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/reset` | Limpia el historial de conversación del chat |

## 🏗️ Arquitectura
```
src/
├── config/
│   └── env.validation.ts         # Validación de variables de entorno
├── ai/
│   ├── ai.module.ts
│   └── ai.service.ts             # LangChain + Groq + Redis memory
└── telegram/
    ├── dto/
    │   └── telegram-update.dto.ts # Tipado del payload de Telegram
    ├── telegram.controller.ts     # Recibe webhooks
    ├── telegram.module.ts
    └── telegram.service.ts        # Envía mensajes a Telegram
```

## 🔄 Flujo de mensajes
```
Usuario escribe en Telegram
        ↓
TelegramController recibe webhook
        ↓
AiService obtiene historial de Redis
        ↓
LangChain invoca modelo Groq
        ↓
AiService guarda intercambio en Redis
        ↓
TelegramService envía respuesta
        ↓
Usuario recibe respuesta
```

## 📄 Licencia

MIT

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
