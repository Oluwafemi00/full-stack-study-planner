# Study Planner AI Proxy

A lightweight Express server that proxies requests from Study Planner Pro to the Google Gemini API. API key lives only here — never exposed to the client.

## How it works

```
User browser → Express proxy  → Google Gemini API
```

The frontend calls `/api/ai` on this server. The server adds secret API key and forwards to Gemini. Users get AI features with zero setup on their end.

## Endpoints

| Method | Path    | Description                   |
| ------ | ------- | ----------------------------- |
| GET    | /health | Health check — returns status |
| POST   | /api/ai | Main AI proxy endpoint        |

### POST /api/ai

Request body:

```json
{
  "prompt": "Your prompt here",
  "maxTokens": 1024,
  "temperature": 0.4
}
```

Response:

```json
{
  "result": "AI response text here"
}
```

Error response:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

## Rate limiting

20 requests per IP per minute.
