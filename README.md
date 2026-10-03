# Cyberouter Chat

A minimal chat UI for [Enclave Cyberouter](https://router.enclave.ai) — OpenAI-compatible access to cyber-capable open-weight models.

## Features

- Talks to `https://router.enclave.ai/v1`
- Lists all available models from your key
- Streaming responses
- Model picker (or `auto` for router selection)
- API key stored only in browser localStorage

## Quick start

1. Sign up at [router.enclave.ai](https://router.enclave.ai) and create an API key
2. Open the app, paste the key in Settings
3. Chat

## Local development

```bash
npm install
npm run dev
```

## Deploy

This repo is set up for Vercel. Connect the GitHub repo and deploy — no env vars required (users supply their own keys).

## API

OpenAI-compatible:

- `GET /v1/models`
- `POST /v1/chat/completions` (streaming supported)

Base URL: `https://router.enclave.ai/v1`
