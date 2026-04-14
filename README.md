# UniProject

Basic Next.js starter with frontend and backend API capabilities.

## Stack

- Next.js (App Router)
- React
- Built-in API routes via `app/api`

## Run Locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Why Your Deploy Failed

If your host says it cannot detect a static files directory, it is trying to deploy this project as a static site.

This project is a Next.js server app with API routes (`app/api/*`), so it must be deployed as a Node web service (or on Vercel), not as static hosting.

## Deploy (Render)

This repo now includes `render.yaml` so Render can detect the correct service type.

If creating manually on Render, use:

- Service type: Web Service (not Static Site)
- Build command: `npm install && npm run build`
- Start command: `npm run start`

## Deploy (Vercel)

Vercel automatically detects Next.js and supports API routes out of the box.

## API Endpoints

### Health Check

- Method: `GET`
- Path: `/api/health`

Response example:

```json
{
	"ok": true,
	"service": "uniproject-api",
	"timestamp": "2026-04-14T00:00:00.000Z"
}
```

### Echo Payload

- Method: `POST`
- Path: `/api/echo`
- Body: JSON

Request example:

```json
{
	"name": "James",
	"role": "student"
}
```

Response example:

```json
{
	"received": {
		"name": "James",
		"role": "student"
	},
	"message": "Echo from Next.js API route"
}
```
