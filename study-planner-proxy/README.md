# Study Planner AI Proxy

A lightweight Express server that proxies requests from Study Planner Pro to the Google Gemini API. Your API key lives only here — never exposed to the client.

## How it works

```
User browser → your Express proxy (Render) → Google Gemini API
```

The frontend calls `/api/ai` on this server. The server adds your secret API key and forwards to Gemini. Users get AI features with zero setup on their end.

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env

# 3. Add your Gemini API key to .env
# Get one free at https://aistudio.google.com/app/apikey
# It looks like: AIzaSy...

# 4. Start the proxy
npm run dev    # with nodemon (auto-restart)
# or
npm start      # plain node

# Server runs at http://localhost:3001
# Test it: curl http://localhost:3001/health
```

## Deploy to Render (free tier)

### Option 1 — GitHub (recommended)

1. Push this folder to a GitHub repo (can be the same repo as the frontend, or separate)
2. Go to **render.com** → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects Node.js. Set:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. Add environment variables:
   - `GEMINI_API_KEY` → your key from aistudio.google.com
   - `ALLOWED_ORIGINS` → your frontend URL (e.g. `https://yourapp.netlify.app`)
6. Click **Deploy**
7. Render gives you a URL like `https://study-planner-ai-proxy.onrender.com`

### Option 2 — render.yaml (one-click)

The `render.yaml` file in this repo enables one-click deploy:
1. Fork/push to GitHub
2. Go to render.com → New → Blueprint
3. Connect repo — Render reads `render.yaml` automatically
4. Set `GEMINI_API_KEY` and `ALLOWED_ORIGINS` when prompted

## After deploying

Update your frontend `.env.production`:
```
VITE_AI_PROXY_URL=https://your-proxy-name.onrender.com
```

Then rebuild and redeploy the frontend.

## ⚠️ Important: ALLOWED_ORIGINS

In production, always set `ALLOWED_ORIGINS` to your exact frontend URL:
```
ALLOWED_ORIGINS=https://yourapp.netlify.app
```

This prevents other websites from using your proxy (and your API quota).

During development, `ALLOWED_ORIGINS=*` is fine.

## Render free tier notes

- Free services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- 750 free hours/month — enough for one always-on service
- Upgrade to Starter ($7/month) to eliminate cold starts

## Endpoints

| Method | Path       | Description                    |
|--------|------------|--------------------------------|
| GET    | /health    | Health check — returns status  |
| POST   | /api/ai    | Main AI proxy endpoint         |

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

20 requests per IP per minute. Adjust in `server.js` if needed.
