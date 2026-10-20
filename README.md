# People & Pay

Full-stack HR employee management and salary clustering app. Employee records are persisted in the MySQL database shown in the supplied phpMyAdmin screenshot.

## Project structure

```text
IP_FINAL/
├── backend/   Express API and tests
└── frontend/  Expo React Native app (Android, iOS, web)
```

## Requirements

- Node.js 18 or newer
- npm

## Run the backend

In one terminal:

```powershell
cd backend
npm install
npm run dev
```

The API listens on the port configured by `PORT` (`3099` in the provided `.env`). Run backend tests with `npm test`.

Configure `backend/.env` from `backend/.env.example`. Set `DB_USER` and `DB_PASSWORD` to the MySQL account used by phpMyAdmin. Never commit `backend/.env`.

The default schema mapping matches the screenshot:

- Database: `ip_std6730251336`
- Table: `Ratchata_6730251336_Employ`
- Columns: `Ratchata_6730251336_id`, `Ratchata_6730251336_name`, `Ratchata_6730251336_position`, `Ratchata_6730251336_status`, `Ratchata_6730251336_salary`

At startup the API connects to MySQL and creates this table only if it does not exist. It does not seed, overwrite, or delete existing records. Change the `DB_TABLE` or `DB_COLUMN_*` values in `.env` if the actual schema differs. `GET /api/health` checks database connectivity.

## Run the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm start
```

Press `w` in Expo to open web, or use the QR code with Expo Go. The default API URL is `http://localhost:3099` on web/iOS simulator and `http://10.0.2.2:3099` on the Android emulator. For a physical device, set the computer's LAN address before starting Expo:

```powershell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:3099"
npm start
```

Replace the example address with the computer's reachable LAN IP.

## Demo login

- Username: value of `AUTH_USERNAME` in `backend/.env` (default `admin`)
- Password: value of `AUTH_PASSWORD` in `backend/.env` (default `password123`)

Set `AUTH_TOKEN_SECRET` to a unique random value before using the application beyond a local demo. Login tokens are signed and expire after 8 hours.

## API

- `POST /api/login`
- `GET /api/employees`
- `POST /api/employees`
- `PUT /api/employees/:id/status`
- `DELETE /api/employees/:id`
- `GET /api/employees/salary-clusters`

Employee and analytics endpoints require a signed bearer token issued by login. The salary endpoint applies one-dimensional K-Means with `k = 3` and returns each tier's average salary (`centroid`) and employee count.

## Submission repository name

Rename the public GitHub repository to `Std` followed by the last 7 digits of the student ID and `IPFinal2026`, as specified in the exam instructions.