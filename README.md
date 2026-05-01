# Telegram Booking Bot

A Telegram booking bot for service-based businesses built with TypeScript, Grammy, Prisma, PostgreSQL, and Express.

The project lets customers book appointments inside Telegram, while the backend manages services, masters, working hours, blocked time slots, and appointment history.

## Features

- Browse available services in Telegram
- Pick a date and time slot for a booking
- Prevent overlaps with existing appointments and blocked slots
- Respect master working hours, including `startTime` and `endTime`
- View and cancel existing appointments
- Persist data in PostgreSQL through Prisma
- Run in polling mode for local development and webhook mode in production
- Expose a simple `/health` endpoint for health checks

## Tech Stack

- TypeScript
- [Grammy](https://grammy.dev/) for the Telegram bot
- [Prisma](https://www.prisma.io/) ORM
- PostgreSQL
- Express
- Docker Compose for local database setup

## Project Structure

```text
src/
  app/            Express server and runtime config
  bot/            Telegram bot, handlers, flows, keyboards, messages
  lib/            Shared infrastructure such as Prisma client
  services/       Booking, schedule, catalog, notification, user logic
  utils/          Date/time and formatting helpers
prisma/
  migrations/     Database migrations
  seed.ts         Seed data for local development
docker-compose.yml
```

## Database Model

The current schema includes:

- `User`
- `Master`
- `Service`
- `Appointment`
- `WorkingHour`
- `BlockedSlot`

This makes the bot suitable for businesses such as barbershops, salons, or any appointment-based service.

## Environment Variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/new_project
PORT=3000
BOT_TIMEZONE=America/Los_Angeles
NODE_ENV=development
```

Notes:

- `BOT_TOKEN` is required
- `BOT_TIMEZONE` defaults to `America/Los_Angeles` if not set
- In production, set `NODE_ENV=production` to enable webhook mode

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL with Docker Compose

```bash
docker compose up -d
```

This starts a local PostgreSQL 16 container with:

- database: `new_project`
- user: `postgres`
- password: `postgres`

### 3. Generate the Prisma client

```bash
npm run prisma:generate
```

### 4. Apply migrations

```bash
npm run prisma:migrate
```

### 5. Seed demo data

```bash
npm run prisma:seed
```

The seed currently creates:

- one master
- two services
- working hours from `10:00` to `19:00` for weekdays `1-6`

### 6. Start the app

```bash
npm run dev
```

In development, the bot runs in long-polling mode and the server starts on `http://localhost:3000`.

## Production Mode

In production:

- the Express app serves the Telegram webhook endpoint at `/webhook`
- the app keeps the `/health` endpoint for monitoring
- you should provide a public HTTPS URL and configure the Telegram webhook

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
```

## Build Check

```bash
npm run build
```

## License

This repository includes a `LICENSE` file. Update this section if you want to document a specific license name or usage terms.
