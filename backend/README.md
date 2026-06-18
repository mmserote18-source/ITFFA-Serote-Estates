# EstateHub Backend

Node.js + Express REST API connected to the MySQL database in `estatehub_schema.sql`.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MySQL](https://dev.mysql.com/downloads/) 8+ (or MariaDB)

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set your MySQL credentials:

```bash
copy .env.example .env
```

Edit `.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=estatehub_db
JWT_SECRET=your-random-secret-key
PORT=3000
```

### 3. Create the database

Import the schema (from the project root):

**Option A – MySQL command line:**
```bash
mysql -u root -p < estatehub_schema.sql
```

**Option B – Node script (uses `.env`):**
```bash
npm run setup-db
```

### 4. Start the server

```bash
npm start
```

Open **http://localhost:3000** — the server serves the website and API together.

Dev mode with auto-restart:
```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server & database status |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/properties` | List properties (supports filters) |
| GET | `/api/properties/:id` | Property detail |
| GET | `/api/favourites` | User favourites (auth) |
| POST | `/api/favourites/:id` | Toggle favourite (auth) |
| POST | `/api/enquiries` | Submit enquiry |
| POST | `/api/bookings` | Book viewing |
| GET | `/api/admin/stats` | Dashboard stats (admin/agent) |
| GET | `/api/admin/enquiries` | All enquiries |
| GET | `/api/admin/bookings` | All bookings |
| POST | `/api/admin/properties` | Add listing |

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@estatehub.co.za | Admin123 |
| Buyer | thabo.k@gmail.com | Password123 |
| Agent | sarah.d@estatehub.co.za | Password123 |

## Troubleshooting

- **`/api/health` returns database disconnected** — check MySQL is running and `.env` credentials are correct.
- **Empty property lists** — run `estatehub_schema.sql` to seed sample data.
- **CORS errors** — open the site via `http://localhost:3000`, not as a local file (`file://`).
