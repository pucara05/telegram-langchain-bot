# Agent API Documentation (Example)

Este archivo es un ejemplo de cómo estructurar documentos para RAG.

---

## 📌 Módulo: Payments

### Endpoint
POST /support/payments/{paymentId}/resend-email

### Descripción
Reenvía el correo de confirmación de un pago.

### Parámetros

- paymentId (UUID) → ID del pago

### Headers

- Authorization: Bearer <token>

### Respuesta esperada

```json
{
  "success": true,
  "message": "Email reenviado correctamente"
}


📌 Módulo: Agent Context
Endpoint

GET /agent/context/{identifier}

Descripción

Obtiene información completa del usuario basado en:

email
paymentId
ticketCode
Respuesta
{
  "buyer": {},
  "payments": [],
  "tickets": [],
  "events": []
}

📌 Reglas importantes
Nunca inventar datos si el contexto existe
Priorizar backend sobre RAG si es información dinámica
Usar RAG solo para documentación

---




## 🧠 Uso en el agente

- RAG se usa para documentación (endpoints, reglas)
- Backend se usa para datos reales
- Tools se usan para acciones externas

Orden de prioridad:

1. Backend (datos reales)
2. Tools (acciones)
3. RAG (documentación)