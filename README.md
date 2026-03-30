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
# 🤖 AI Agent Telegram (RAG + Tools + Memory + Backend API)

Agente inteligente para Telegram diseñado para **uso empresarial**, capaz de responder consultas internas, acceder a APIs del negocio y utilizar conocimiento propio mediante RAG.

---

## 🧠 ¿Qué es este proyecto?

Un **AI Agent privado para empresas**, que permite a equipos internos consultar:

- 📊 información de usuarios
- 💳 estados de pagos
- 🎫 tickets y eventos
- 📚 documentación interna (RAG)

Todo desde Telegram, en lenguaje natural.

---

## 🚀 Características

- 📩 Webhook en tiempo real con Telegram
- 🧠 LLM (Mistral) para razonamiento
- 💾 Memoria persistente por usuario (Redis)
- 🔧 Tools dinámicas:
  - Hora
  - Clima
  - Búsqueda web
- 🔌 **Integración con backend empresarial (API real)**
- 📚 **RAG (Retrieval-Augmented Generation)**
  - Embeddings locales (Transformers)
  - Vector DB (Chroma persistente)
- ⚡ Arquitectura modular con NestJS
- 🔐 Validación de entorno
- 🧹 Comandos de control de memoria

---

## 🧬 Stack Tecnológico

| Capa | Tecnología |
|------|--------|
| Backend | NestJS |
| Runtime | Node.js |
| LLM | Mistral (LangChain) |
| Embeddings | Transformers (`@xenova/transformers`) |
| Vector DB | Chroma |
| Memoria | Redis (Docker) |
| API externa | Backend empresarial (Axios) |
| Tools | OpenWeather + Serper |
| Dev Tunnel | ngrok |
| Package Manager | pnpm |

---

## 🧠 Arquitectura del Agente

```txt
Usuario (Empresa)
        ↓
Telegram
        ↓
NestJS Webhook
        ↓
AI Service
        ↓
┌────────────────────────────┐
│        LLM (Mistral)       │
└────────────┬───────────────┘
             ↓
   ┌───────────────────────┐
   │     Decision Layer    │
   └───────────────────────┘
     ↓        ↓        ↓
   RAG      Tools    API Backend
     ↓        ↓        ↓
   Chroma   APIs    Sistema Empresa
     ↓
Redis Memory
📚 RAG (Conocimiento interno)

El sistema utiliza archivos .md como base de conocimiento:

AGENT_API.md
🔄 Flujo:
Se carga el documento
Se divide en chunks
Se generan embeddings (Transformers local)
Se almacenan en Chroma
Se recupera contexto relevante en cada consulta

👉 Sin costo
👉 Sin APIs externas
👉 Persistente

🔌 Tool empresarial (Backend API)
get_agent_context(identifier)
📥 Input:
email
ticketCode
paymentId
📤 Retorna:
información del usuario
estado de pagos
tickets
eventos
🔐 Seguridad:
Autenticación vía API Key
Integración backend real
🤖 Inteligencia del agente

El agente decide automáticamente:

Caso	Acción
Pregunta interna	usa RAG
Pregunta de usuario real	usa API
Pregunta general	usa LLM
Datos externos	usa tools
🐳 Infraestructura (Docker)
services:
  redis:
    image: redis:alpine

  chroma:
    image: chromadb/chroma

👉 Persistencia incluida
👉 Listo para producción

⚙️ Instalación
git clone https://github.com/pucara05/telegram-langchain-bot.git
cd telegram-langchain-bot
pnpm install
🔐 Variables de entorno
TELEGRAM_BOT_TOKEN=

MISTRAL_API_KEY=

OPENWEATHER_API_KEY=
SERPER_API_KEY=

AGENT_API_URL=
AGENT_API_KEY=

REDIS_URL=redis://localhost:6379
CHROMA_URL=http://localhost:8000

NGROK_URL=
PORT=3000
🚀 Desarrollo
docker-compose up -d
pnpm run start:dev
ngrok http 3000

Registrar webhook:

curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
-d "url=<NGROK_URL>/telegram/webhook"
💬 Ejemplos de uso
📊 Backend real
"Busca el usuario con email Yennyarb32@gmail.com
"
"Cuál es el estado del pago 151312334101"
📚 RAG
"Explícame el endpoint de tickets"
"Cómo funciona la API de pagos"
🌐 Tools
"Qué clima hay en Bogotá"
"Qué hora es en Madrid"
🧠 Flujo completo
Usuario → Telegram
        ↓
Webhook
        ↓
AI Service
        ↓
¿RAG?
¿Tool?
¿API?
        ↓
LLM genera respuesta
        ↓
Redis guarda memoria
        ↓
Telegram responde
⚡ Optimización
✅ Embeddings locales (gratis)
✅ Persistencia en Chroma
✅ No recalcula embeddings
✅ Uso inteligente de RAG
✅ Tools bajo demanda
🏗️ Estructura
src/
├── ai/
├── rag/
│   ├── documents/
│   └── rag.service.ts
├── tools/
├── telegram/
├── config/
🎯 Caso de uso real

Este agente está diseñado para:

🏢 Equipos internos de empresas
🎫 Soporte operativo
💳 Consulta de pagos
📊 Acceso a datos sin dashboards
🤖 Asistente interno inteligente
📄 Licencia

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
