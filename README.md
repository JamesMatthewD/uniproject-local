Attributions:
Card images: Byron Knoll: http://code.google.com/p/vector-playing-cards/

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
