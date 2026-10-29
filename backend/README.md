# Transportation Management System - Backend

## Project Overview

This repository contains the backend REST API for a Transportation Management System (TMS). It supports the operational workflows for managing customers, orders, warehouses, inventory, dispatch, trips, vehicles, payments, and delivery tracking.

The API is built with Node.js and Express and stores application data in MongoDB through Mongoose.

## Features

- User registration and login, access-token refresh, and logout.
- Role-based access for administrators, dispatchers, drivers, warehouse staff, and customers.
- Customer, staff, driver, vehicle, warehouse, and address management.
- Order pricing, creation, assignment to trips, cancellation, delivery updates, and tracking history.
- Route and trip scheduling, including pickup, delivery, and transfer trips, with driver and vehicle availability checks.
- Inventory, receipt, issue, and maintenance workflows.
- Payment, customer wallet, invoice, COD collection, and settlement workflows.
- Dashboard, feedback, failure-reason, and notification endpoints.
- Local proof-of-delivery image uploads.
- Unit and integration tests using Vitest and Supertest.

## Tech Stack

- **Runtime:** Node.js
- **HTTP framework:** Express
- **Database / ODM:** MongoDB / Mongoose
- **Authentication:** JSON Web Tokens, bcrypt
- **Validation:** Joi
- **Middleware:** Helmet, CORS, Morgan, cookie-parser, and Multer
- **Logging:** Winston
- **Testing:** Vitest and Supertest
- **Package manager:** Yarn

## Architecture

The application follows a modular, layered structure:

- `src/server.js` loads environment variables, connects to MongoDB, and starts the HTTP server.
- `src/app.js` configures security and request middleware, static upload serving, API routes, and centralized error handling.
- `src/index.js` mounts each business module below `/api/v1`.
- `src/modules/` contains feature modules, generally separated into routes, controllers, services, repositories, validators, and Mongoose models.
- `src/middlewares/` contains request validation, authentication, authorization, upload, and error-handling middleware.
- `src/configs/`, `src/constants/`, and `src/utils/` contain infrastructure configuration, shared values, and reusable helpers.

Each module generally uses these five layers:

1. **Routes** define the module's HTTP endpoints and connect middleware such as authentication, authorization, and input validation to controller handlers.
2. **Controllers** handle the HTTP boundary: they read request data, call the appropriate service, and return formatted responses or forward errors to the centralized error handler.
3. **Services** implement and coordinate business workflows, including business-rule checks, transaction boundaries, and calls to other modules when needed.
4. **Repositories** encapsulate database access, providing the service layer with operations to query, create, update, and delete persisted data.
5. **Models** define MongoDB document structure, field constraints, references, timestamps, and indexes through Mongoose.

Validators define schemas for checking request parameters, query strings, and bodies. They are supporting components used in the route middleware chain, rather than a separate layer in the five-layer structure.

## Project Structure

```text
backend/
├── src/
│   ├── configs/          # Database and logger configuration
│   ├── constants/        # Roles, statuses, messages, and shared constants
│   ├── middlewares/      # Authentication, authorization, validation, uploads, errors
│   ├── modules/          # Business modules and their routes/services/models
│   ├── utils/            # Shared helpers, JWT, cookies, and API response classes
│   ├── app.js            # Express application setup
│   ├── index.js          # API route registration
│   └── server.js         # Environment loading and server startup
├── tests/
│   ├── integrations/     # Integration tests
│   └── units/            # Unit tests
├── logs/                 # Application log files
├── uploads/              # Locally stored uploaded files
├── .env.example          # Environment variable template
├── package.json          # Scripts and dependencies
└── yarn.lock             # Locked dependency versions
```

## Authentication & Authorization

- JWT-based authentication using short-lived access tokens and persisted refresh tokens.
- Access tokens are sent through the `Authorization: Bearer <access-token>` header.
- Refresh tokens are stored in HTTP-only cookies and persisted in MongoDB.
- Logout revokes the refresh token and clears the authentication cookie.
- Role-based authorization is implemented for `admin`, `dispatcher`, `driver`, `warehouse_staff`, and `customer`.
- Warehouse-scoped roles require an active warehouse profile.

## Database Design

MongoDB is the system of record. Mongoose models use MongoDB `ObjectId` references to connect related documents, and most models enable `createdAt` and `updatedAt` timestamps.

The main data domains include:

- **Identity and access:** users and refresh tokens.
- **Customer accounts:** customer profiles, wallet balances, spending totals, and loyalty points.
- **Operations:** orders, order tracking logs, routes, trips, trip assignments, and trip tracking logs.
- **Resources:** warehouses, staff, dispatchers, drivers, vehicles, vehicle types, and vehicle usage logs.
- **Warehouse workflows:** inventory, receipts, issues, and goods categories.
- **Finance:** payments, invoices, wallet transactions, and COD settlements.
- **Supporting records:** addresses, maintenance schedules/logs, feedback, notifications, and failure reasons.

Unique constraints and indexes are defined on selected fields and query patterns, including user email/phone, generated order/trip codes, and frequently filtered order/trip status and relationship fields. Some records use a `deletedAt` field for soft deletion. Database transactions are used in workflows that need coordinated updates; use a MongoDB deployment that supports transactions when running those workflows.

## Prerequisites

- Node.js compatible with the installed dependencies.
- Yarn.
- A reachable MongoDB instance. Set `MONGODB_CONNECTION_STR` to its connection string.

## Installation & Setup

From the repository root, install backend dependencies and create a local environment file:

```powershell
cd backend
yarn install --frozen-lockfile
Copy-Item .env.example .env
```

Edit `.env` and replace the example JWT secrets with strong, unique values. See `.env.example` for the available settings, and configure the MongoDB connection and frontend origin for your environment before starting the API.

## Running the Application

Start the development server with automatic restarts:

```powershell
yarn dev
```

Start the server without the development watcher:

```powershell
yarn start
```

By default, the API is available at `http://localhost:5000`. The server connects to MongoDB before it begins listening. The frontend origin defaults to `http://localhost:5173`.

## API Documentation

All routes are mounted under `/api/v1`. The route modules currently serve as the API reference; a generated OpenAPI/Swagger specification is not included.

| Resource                           | Base path                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Authentication                     | `/auth`                                                                          |
| Users and administration           | `/users`, `/admin`, `/staffs`                                                    |
| Customers and addresses            | `/customers`, `/addresses`                                                       |
| Orders and dispatch                | `/orders`, `/dispatchers`                                                        |
| Drivers, vehicles, and maintenance | `/drivers`, `/vehicles`, `/maintenance`                                          |
| Routes and trips                   | `/routes`, `/trips`                                                              |
| Warehouses and goods operations    | `/warehouses`, `/inventories`, `/receipts`, `/issues`, `/goods-categories`       |
| Billing and settlement             | `/pricing`, `/payments`, `/invoices`, `/wallet-transactions`, `/cod-settlements` |
| Reporting and support              | `/dashboard`, `/notifications`, `/feedbacks`, `/failure-reasons`                 |

## Error Handling

- Request validation is performed by middleware using the module's validation schema. Invalid input returns HTTP `400` with validation details in `errors`.
- `ApiError` carries an explicit HTTP status and message for expected application errors, such as unauthorized requests, forbidden access, missing resources, and conflicts.
- A centralized Express error middleware logs failed requests and formats API errors. Unexpected errors return HTTP `500` with a generic server-error message; server-side logs include diagnostic details.
- Successful API responses use shared response helpers, including `200`, `201`, and `204` responses where appropriate.

## Testing

Run the unit and integration test suites:

```powershell
yarn test
```

Run Vitest in watch mode during development:

```powershell
yarn test:watch
```

Tests are under `tests/units/` and `tests/integrations/`.

## Security

- Store secrets in an untracked `.env` file or a deployment secret manager. Do not use the example JWT values outside local development.
- Use HTTPS in production, especially when `REFRESH_TOKEN_COOKIE_SAME_SITE=none`; the refresh-token cookie is HTTP-only and secure in production.
- Set `CLIENT_ORIGIN` to the exact trusted frontend origin rather than using a permissive wildcard.
- Keep dependencies updated and restrict access to the MongoDB instance using network controls and database credentials.
- Configure production logging and protect log files, as server-side error logs may contain diagnostic information.
- The current upload flow validates allowed image MIME types and file signatures and limits file size. Keep upload storage private and persistent as appropriate for the deployment.

## Deployment

No Dockerfile, Compose configuration, or deployment manifest is included in this backend folder. A deployment must provide Node.js, install the locked dependencies, supply the environment variables, and make MongoDB reachable.

For production deployments:

1. Set `NODE_ENV=production`, a production `PORT`, the MongoDB connection string, strong JWT secrets, and the correct `CLIENT_ORIGIN`.
2. Run `yarn install --frozen-lockfile` and start the API with `yarn start` under an appropriate process manager or hosting platform.
3. Terminate HTTPS at the platform or a trusted reverse proxy and configure the refresh-token cookie settings for the frontend/API domain arrangement.
4. Provide persistent storage for locally uploaded files in `uploads/` and for application logs, or integrate and verify a managed storage provider before relying on one.
5. Use a MongoDB deployment that supports transactions for the multi-document workflows that depend on them.

## Known Limitations & Future Improvements

- The API has no generated OpenAPI/Swagger specification; endpoint details currently live in the route modules and validators.
- The active proof-of-delivery upload middleware uses local disk storage. Although `.env.example` lists Cloudinary and S3 settings and the URL helper recognizes those storage types, an external upload provider is not wired into the current upload middleware.
- No Docker or deployment configuration is included in this folder.
- Add production-oriented deployment automation, API schema documentation, and integration tests against a transaction-capable MongoDB environment as needed.

## License

No license file is included in this backend folder. Check the repository's root-level license or contact the project owner before using or redistributing this code.
