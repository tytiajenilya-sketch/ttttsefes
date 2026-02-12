## Best CA Shop | Cheap Booking

Admin and redemption portal for managing antistock.io orders, redemption codes,
and live customer chat.

### Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
copy .env.example .env
```

3. Set `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and keep
	`DATABASE_URL` as the default SQLite path.
4. Initialize the database:

```bash
npm run db:push
```

5. Start the development server:

```bash
npm run dev
```

### Usage

- `http://localhost:3000/admin/login` for admin sign-in.
- `http://localhost:3000/admin` for admin tools.
- `http://localhost:3000/redeem` for customer redemptions.
- `http://localhost:3000/chat` for customers to chat using their redeem code.

### Admin actions

- Paste codes from antistock.io to load them into the system.
- Review redemption orders, set stages, and chat with customers.
- Customers use the same redeem code to open a chat thread.
