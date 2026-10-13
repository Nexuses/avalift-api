AVALIFT BACKEND API — TECHNICAL DOCUMENT
================================================

Product: Avalift (codebase name: zeizzu_api / zeizzu_rewrite_api)
Type: REST backend for chauffeur / ride-hailing operations
Document version: 1.0
Audience: Engineering, product, operations, and onboarding

How to paste into Google Docs
- Open this file, Select All, Copy
- In Google Docs: Edit → Paste (or Paste from Markdown if shown)
- For diagrams: set the diagram block to a monospace font (Courier New / Consolas) so boxes stay aligned
- Optional: paste Mermaid blocks into https://mermaid.live to export PNG/SVG, then insert images into the Doc


------------------------------------------------
1. WHAT THIS APPLICATION IS
------------------------------------------------

Avalift is a chauffeur-driven mobility platform for the UAE (currency AED).

This repository is the backend API that powers:

1. Customer mobile app (iOS / Android)
2. Chauffeur mobile app
3. Pickup-Drop (PD) driver app
4. Admin / operator web panel
5. Corporate / organization admin users

The API handles authentication, ride lifecycle, live location, payments, wallets, coupons, invoices, notifications, vehicle management, referrals, commissions, and ERP invoice sync.

Staging API base (from environment): https://api.stage.avalift.ae
Local API base: http://localhost:{PORT}/api
Swagger UI: http://localhost:{PORT}/api-docs
Default local port: 3000 (from .env) or 5050 if PORT is unset


------------------------------------------------
2. WHO USES THE SYSTEM (ACTORS)
------------------------------------------------

Customer (individual)
- Books on-demand or scheduled rides
- Pays by card, Apple Pay, wallet, or cash
- Can tip chauffeur, apply coupons, save locations, review rides

Corporate customer / organization user
- Books rides against an organization
- Uses corporate wallet / credit invoicing

Chauffeur
- Receives ride requests
- Goes on-the-way, reaches customer, starts and completes ride
- Handles cash, uploads before/after ride photos
- Can request PD pickup/drop to/from customer locations

PD driver (Pickup-Drop)
- Picks chauffeurs from a point and drops them at customer locations (and reverse)
- Has its own wallet and cash-handover flow

Admin / Super Admin / Operator
- Manages users, vehicles, pricing, coupons, regions, banks
- Assigns / reassigns chauffeurs and PD drivers
- Runs rides on behalf of customers
- Revenue reports, Excel exports, invoices, bulk notifications

Organization admin
- Manages org users, org vehicles, org scheduled rides, pending payments


------------------------------------------------
3. HIGH-LEVEL SYSTEM DIAGRAM
------------------------------------------------

Copy the block below into Google Docs and apply Courier New.

+------------------+  +------------------+  +------------------+  +------------------+
|  Customer App    |  |  Chauffeur App   |  |  PD Driver App   |  |  Admin / Org Web |
|  iOS / Android   |  |  iOS / Android   |  |  iOS / Android   |  |  Panel           |
+--------+---------+  +--------+---------+  +--------+---------+  +--------+---------+
         |                     |                     |                     |
         +---------------------+----------+----------+---------------------+
                                          |
                                          v
                              +-----------------------+
                              |   Avalift API         |
                              |   Express + Node.js   |
                              |   /api  +  /api-docs  |
                              +-----------+-----------+
                                          |
        +---------------+-----------------+------------------+------------------+
        |               |                 |                  |                  |
        v               v                 v                  v                  v
 +------------+  +------------+   +--------------+   +--------------+   +---------------+
 | PostgreSQL |  | DynamoDB   |   | Redis        |   | AWS S3       |   | Firebase FCM  |
 | (Sequelize)|  | (rides,    |   | sessions,    |   | images,      |   | push notify   |
 | users,     |  |  locations,|   | queues,      |   | documents    |   +---------------+
 | wallets,   |  |  notifs)   |   | scheduled    |   +--------------+
 | coupons,   |  +------------+   | rides        |          |
 | vehicles,  |                   +--------------+          v
 | orgs       |                                      +--------------+
 +------------+                                      | Telr Gateway |
                                                     | cards/Apple  |
                                                     | Pay          |
                                                     +------+-------+
                                                            |
                     +------------------+     +-------------+-------------+
                     | SMS Country      |     | Nymbl ERP                 |
                     | OTP / SMS        |     | invoice create            |
                     +------------------+     +---------------------------+
                     | Gmail SMTP       |
                     | Nodemailer       |
                     +------------------+


Mermaid (optional — render at mermaid.live):

flowchart TB
  subgraph Clients
    C[Customer App]
    D[Chauffeur App]
    P[PD App]
    A[Admin / Org Panel]
  end

  API[Avalift Express API]

  C --> API
  D --> API
  P --> API
  A --> API

  API --> PG[(PostgreSQL RDS)]
  API --> DDB[(DynamoDB)]
  API --> REDIS[(Redis / ElastiCache)]
  API --> S3[(AWS S3)]
  API --> FCM[Firebase Cloud Messaging]
  API --> TELR[Telr Payments]
  API --> SMS[SMS Country]
  API --> MAIL[Gmail SMTP]
  API --> ERP[Nymbl ERP]


------------------------------------------------
4. COMPLETE TECH STACK
------------------------------------------------

4.1 Runtime and language
- Language: JavaScript (Node.js CommonJS)
- Runtime: Node.js >= 18 (production start script uses Node 18 via nvm; local may differ)
- Process manager (production): PM2
- Package manager: npm (lockfile present); production install script also uses pnpm

4.2 Web framework
- Express 4 — HTTP API
- body-parser — JSON request bodies
- cors — Cross-Origin Resource Sharing (all origins enabled)
- helmet — HTTP security headers
- express-rate-limit — present but currently commented out
- multer / busboy / multiparty — file uploads
- swagger-jsdoc + swagger-ui-express — OpenAPI docs at /api-docs

4.3 Architecture pattern
Layered backend:

  Route  →  Middleware (auth / authorize)  →  Controller  →  Service  →  DAO / DTO  →  Database

- routes: URL mapping
- middlewares: JWT session + RBAC permissions
- controllers: HTTP in/out
- services: business logic
- dao: DynamoDB access
- dto: Sequelize models (Postgres)
- validators: Joi request validation
- helpers / utils: shared utilities
- adaptors: notification adapter over Firebase
- queues + workers: background jobs

4.4 Databases and cache
- PostgreSQL (AWS RDS) via Sequelize + pg
- Amazon DynamoDB via AWS SDK v3 (@aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb)
- Redis via ioredis
- Bull queues on Redis (notification, ERP, tips)

Why two databases?
- Postgres: relational master data (users, roles, wallets, coupons, vehicles, orgs, payments metadata)
- DynamoDB: high-write operational data (rides, live locations, notifications, logs, pricing snapshots)
- Redis: login sessions (single active token), scheduled-ride timers, Bull job queues

4.5 Authentication and security
- JWT (jsonwebtoken)
- Redis session store (key session:{userId}) so only one active token per user
- bcryptjs for password hashing
- Passport Google OAuth (web + app SSO handler)
- OTP login for mobile users
- Email/password for admin
- RBAC: Role → Policies[] → Permissions (string keys like orders.create, drivers.manage)
- authorize(permission) middleware on most routes

4.6 Cloud / AWS
- AWS region (staging .env): ap-southeast-1
- Production CI region: me-central-1 (UAE)
- S3: profile images, vehicle media, ride photos, invoices, org logos
- DynamoDB: operational tables
- STS: identity checks
- ElastiCache Redis (staging hostname exists as queue fallback)
- CodeDeploy (appspec.yml) to EC2 path /var/www/zeizzu_rewrite_api
- CodeCommit sync from GitLab branch prod-zeizzu
- S3 buckets observed in this project context include staging-zeizzu, zeizzu-live-s3, zeizzu-public, zeizzu-private

4.7 Payments
- Telr (UAE payment gateway)
  - Card checkout
  - Apple Pay
  - Quick Link payments (admin-generated payment links)
  - Sale / refund
  - Wallet top-up
- Saved cards stored in Postgres (SavedCards)
- TelrPaymentLogs for gateway audit
- Cash payment flows for chauffeur / PD / admin
- Corporate wallet and invoicing

4.8 Notifications and messaging
- Firebase Admin SDK → FCM push (Android + iOS APNs)
- Bull notification queue + notificationProcessor worker
- SMS Country (OTP and transactional SMS)
- Twilio env vars exist; Twilio send helper is currently a stub (console log)
- Nodemailer + Gmail for emails (forgot password, etc.)

4.9 Files, documents, reports
- AWS S3 uploads
- PDF: pdfkit, pdf-lib, Puppeteer (invoices)
- Excel: exceljs, xlsx (ride export, wallet logs, vehicle audit)
- Static assets under /img and /uploads

4.10 Scheduling and background work
- node-cron workers
- Bull + Redis queues
- PM2 starts API + multiple workers in production

4.11 Integrations
- Google auth (Passport)
- Telr payments
- SMS Country
- Firebase Cloud Messaging
- Nymbl ERP (invoice create at avalift.benymbl.co)
- AWS S3 / DynamoDB / STS

4.12 Observability
- Winston console logger
- DynamoDB ServerLogs and AppLogs tables
- Request logging middleware on every HTTP call

4.13 Testing / DX
- Jest + Supertest
- Nodemon for local reload
- sequelize-cli for migrations/seeds
- Serverless + serverless-offline present as deps (main runtime is Express on EC2, not Lambda)

4.14 Tech stack summary table

Layer                 | Technology
--------------------- | ------------------------------------------
Language              | JavaScript (Node.js)
API                   | Express 4
Auth                  | JWT + Redis session + OTP + Google SSO
Authorization         | Roles / Policies / Permissions
Relational DB         | PostgreSQL + Sequelize
Operational DB        | Amazon DynamoDB
Cache / jobs          | Redis + Bull
Files                 | AWS S3
Push                  | Firebase Cloud Messaging
SMS                   | SMS Country
Email                 | Nodemailer (Gmail)
Payments              | Telr (card, Apple Pay, quick link)
ERP                   | Nymbl Suite invoice API
PDF / Excel           | pdfkit, pdf-lib, puppeteer, exceljs, xlsx
Validation            | Joi
Security headers      | Helmet
Docs                  | Swagger / OpenAPI
Process manager       | PM2
CI                    | GitLab CI → AWS CodeCommit
CD                    | AWS CodeDeploy (appspec.yml)
Hosting               | AWS EC2 (Linux, ubuntu user)


------------------------------------------------
5. FOLDER / CODE STRUCTURE
------------------------------------------------

avalift_api/
  index.js                 HTTP server entry (DB connect, then listen)
  package.json             Scripts and dependencies
  .env                     Environment configuration
  appspec.yml              AWS CodeDeploy mapping
  .gitlab-ci.yml           Sync prod-zeizzu branch to CodeCommit
  scripts/
    install.sh             AfterInstall hook
    start.sh               PM2 start of API + workers
    cleanup.sh             BeforeInstall hook
  src/
    routes/                REST route modules mounted under /api
    controllers/           HTTP handlers
    services/              Business logic
    dao/                   DynamoDB data access
    dto/                   Sequelize Postgres models
    middlewares/           auth, authorize, errorHandler
    validators/            Joi schemas
    helpers/               logger, SMS, email, OTP, pricing helpers
    utils/                 S3 uploader, invoice PDF, coupons, ERP client
    config/                database, redis, s3, passport, SMS provider
    queues/                Bull: notification, ERP, tips
    workers/               Background processors and crons
    adaptors/              notificationService (FCM)
    assets/                HTML pages, Firebase service account, images
    invoices/              generated PDFs
    sample-entries/        example DynamoDB ride/PD documents


------------------------------------------------
6. REQUEST FLOW (INSIDE THE API)
------------------------------------------------

ASCII:

Client
  |
  |  Authorization: Bearer <jwt>
  v
Express (helmet, cors, body-parser, winston request log)
  |
  v
Route  /api/<module>/<action>
  |
  +--> authenticate middleware
  |      1. Verify JWT signature
  |      2. Load Redis key session:{userId}
  |      3. Token must match stored session (single login)
  |
  +--> authorize('permission.key')
  |      Load user role → policies → permission strings
  |      403 if missing
  |
  v
Controller
  |
  v
Service  (ride rules, payments, wallets, coupons, ERP enqueue)
  |
  +--> dto / Sequelize  -->  PostgreSQL
  +--> dao              -->  DynamoDB
  +--> redis / bull     -->  queues, schedules, sessions
  +--> S3 / Telr / FCM / SMS / ERP
  |
  v
JSON response  { success, status, message, data }


Mermaid:

sequenceDiagram
  participant App as Mobile / Admin
  participant API as Express API
  participant Redis as Redis
  participant PG as PostgreSQL
  participant DDB as DynamoDB
  participant Ext as Telr / FCM / S3 / ERP

  App->>API: HTTP + Bearer JWT
  API->>API: Verify JWT
  API->>Redis: GET session:{userId}
  alt Token mismatch or missing
    API-->>App: 401 Session expired
  else OK
    API->>PG: Load role permissions
    API->>API: Business logic
    API->>DDB: Read/write ride / location / notif
    API->>PG: Read/write user / wallet / coupon
    API->>Ext: Side effects
    API-->>App: JSON result
  end


------------------------------------------------
7. DATA ARCHITECTURE
------------------------------------------------

7.1 PostgreSQL (Sequelize models in src/dto)

Identity and access
- User, Role, Permission, Policy, Type, Status, Otp

People and orgs
- Organization, OrganizationInvoice
- UserGroup, UserGroupMembership, UserPlate, UserCommission

Vehicles
- Vehicle, VehicleDetail

Locations
- CurrentLocation (chauffeur/PD live position used for nearby matching)

Payments and wallets
- Payments, PaymentType, SavedCards, TelrPaymentLogs, BankDetail
- CustomerWallet, CustomerWalletLog
- ChauffeurWallet, ChauffeurWalletLog
- ChauffeurTipWallet, ChauffeurTipWalletLog
- PDWallet, PDWalletLog
- AdminWallet, AdminWalletLog

Growth / pricing rules
- CouponMaster, CouponRule, CouponUsage, CouponUserGroup
- RateType
- Referral, TemporaryReferral

ERP
- ErpSku, ErpMappingCode, ErpSync

7.2 DynamoDB tables (from DAO usage)

Table                        | Purpose
---------------------------- | ------------------------------------------
Rides                        | Customer ride documents (status, fare, points, logs)
ChauffeurRides               | Chauffeur-side PD / pickup-drop jobs
PDPickupDrop                 | PD trip with chauffeur pickup/drop lists
Pricings                     | Fare configuration by org / rate type
Notifications                | In-app / push notification records
UserLocations                | Location snapshots
LocationsHistory             | Historical location trail
UserProfiles                 | Profile documents / images metadata
SavedLocations               | Customer saved places
VehicleMaster                | Brands and models catalog
VehicleAudit                 | Pre/post ride vehicle photo audit
Reviews                      | Customer ↔ chauffeur reviews
UserStatusLogs               | Online / offline / busy logs
UserStatusDailyAggregates    | Daily status summaries
CounterTable                 | Auto-increment IDs for Dynamo items
AppLogs                      | Mobile app logs
ServerLogs                   | Backend error/info logs
RideTable                    | Alternate/legacy ride table reference

Ride document pattern (example):
- PK: CUSTOMER#{userId}
- SK: ride id
- Fields: chauffeur_id, status, rate_type, estimates, geo points, status_log[], organisation_id

7.3 Redis keys / uses
- session:{userId} — active JWT
- Scheduled rides store (scheduleHelper)
- Hourly-end warning sorted set + sent flags
- Bull queues: notificationQueue, erpQueue, tipQueue
- Distributed lock for hourly warn cron: lock:cron:hourly_end_warn

7.4 Data ownership diagram

                    +---------------------------+
                    |        PostgreSQL         |
                    |  Who is the user?         |
                    |  What can they do?        |
                    |  How do they get paid?    |
                    |  Coupons, orgs, vehicles  |
                    +-------------+-------------+
                                  |
                                  | user_id / org_id / vehicle_id
                                  v
                    +---------------------------+
                    |        DynamoDB           |
                    |  What is happening now?   |
                    |  Rides, GPS, notifs,      |
                    |  pricing snapshots, logs  |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    |          Redis            |
                    |  Is this session valid?   |
                    |  What job runs next?      |
                    +---------------------------+


------------------------------------------------
8. CORE BUSINESS FLOWS
------------------------------------------------

8.1 Customer authentication (OTP)

1. App calls POST /api/auth/request-otp with mobile number
2. API creates/finds User in Postgres, stores OTP, sends SMS via SMS Country
3. App calls POST /api/auth/verify-otp
4. On success, JWT is issued and saved in Redis as the only active session
5. New users complete profile via /api/auth/complete-registration

Chauffeur/PD use dedicated OTP endpoints:
- /api/auth/request-otp-chauffeur-pd
- /api/auth/verify-otp-chauffeur-pd

Admin:
- POST /api/auth/admin-login (email/password)
- Forgot password + OTP verify
- Google SSO for apps/web

Logout deletes the Redis session.

8.2 Customer ride lifecycle

Requested
  -> Accepted (chauffeur or admin assigns)
  -> On-The-Way
  -> Reached Customer
  -> Started
  -> Completed  (then Review-Pending / payment / tip / ERP)
  -> or Cancelled at allowed stages

ASCII:

Customer                 API                    Chauffeur              PD (optional)
   |                      |                         |                      |
   | request ride         |                         |                      |
   |--------------------->| estimate fare           |                      |
   |                      | save Ride in DynamoDB   |                      |
   |                      | FCM nearby chauffeurs   |                      |
   |                      |------------------------>|                      |
   |                      |                         | respond / accept     |
   |                      |<------------------------|                      |
   |                      | status = Accepted       |                      |
   |                      |                         | on-the-way           |
   |                      |                         | reached              |
   |                      |                         | start                |
   |                      |                         | upload photos        |
   |                      |                         | complete             |
   | pay (Telr/wallet/cash)|<------------------------|                      |
   | tip (optional)       | enqueue ERP if completed|                      |
   | review               |                         |                      |

If chauffeur needs transport to the customer:
- Chauffeur requests PD pickup
- Admin/PD accepts
- PD picked chauffeur → drop at customer → later pickup chauffeur after ride

8.3 Fare / rate types
- RateType in Postgres (category, name, duration_hours)
- Pricings in DynamoDB
- Endpoints to calculate estimate, change/extend rate type, other charges
- Hourly rides get a warning cron ~10 minutes before end (configurable)

8.4 Payments

Methods
- Card via Telr hosted/checkout
- Apple Pay via Telr
- Customer wallet top-up then wallet ride payment
- Corporate wallet / credit
- Cash (chauffeur collects; handover to PD then admin)
- Admin quick-link payment (SMS/email payment URL)
- Refunds and top-up refund lookup

Wallet graph:

Customer Wallet ---- ride fare / top-up / refund ---- Telr
Chauffeur Wallet --- cash collected / commission
Chauffeur Tip Wallet --- customer tips / payout
PD Wallet ---------- cash collected from chauffeurs
Admin Wallet ------- cash received from PD / org settlement
Org invoices ------- credit rides billed later

Cash handover chain:

Chauffeur cash  -->  PD cash handling  -->  Admin cash handling  -->  Admin wallet

8.5 Coupons and referrals
- CouponMaster + rules + user groups + usage tracking
- Applicable-coupon query for a user/ride
- Welcome coupon env (example: wel-50)
- Referral code generate/get; reward amount from env (example: 20 AED)

8.6 Notifications
1. Service builds payload (customer / chauffeur / admin builders)
2. Job pushed to Bull notificationQueue
3. notificationProcessor sends FCM
4. Record stored in DynamoDB Notifications
5. Apps fetch paginated notification lists

Also: bulk admin notifications, silent notification processor, scheduled-ride reminder cron.

8.7 ERP sync
When a ride is Completed:
- Job on erpQueue
- erpWorker loads ride
- erpService posts invoice to Nymbl (ERP_INVOICE_API)
- ErpSync / mapping codes / SKUs stored in Postgres


------------------------------------------------
9. MODULE MAP (WHAT EACH AREA DOES)
------------------------------------------------

Auth
- OTP, admin login, Google SSO, password, logout, app version check

Users / profiles
- CRUD users, profile image (S3), device token, dashboard, reviews, app logs
- List individual vs corporate customers, chauffeurs, PD users
- Active / inactive toggle, admin reset password

Roles and permissions
- Create roles and policies
- Attach/detach policies
- Permission keys gate every sensitive route

Rides (customer)
- Request, estimate, schedule, reschedule, change destination
- Cancel, complete initiation, current-ride check, history, add tip

Rides (chauffeur)
- Accept/respond, on-the-way, reached, start, complete
- Other charges, active/scheduled ride, vehicle audit images
- Nearby PD, cancel pickup request, Apple Pay indication

Rides (PD)
- Pending pickups/drops, accept ride, pick/drop chauffeur
- History, summary, notifications

Admin rides
- Create ride for customer or organisation
- Assign/reassign chauffeur and PD
- Drive ride status machine from panel
- Schedule/reschedule from admin or org user
- Cancel including chauffeur-PD rides
- Excel export, revenue reports, location metrics

Vehicles
- Customer/org/admin vehicle CRUD with media
- VehicleMaster brands/models
- Plate formats by country, plate codes/regions

Locations
- Update/get current location
- Nearby users (radius from env, e.g. 50 km)
- Saved locations

Payments / wallets / invoices
- See section 8.4
- Organization invoices, credited rides, pending org amount
- Bank account master data

Coupons / groups
- Full coupon CRUD and targeting via user groups

Organizations
- Org CRUD with logo, org admins, status, users under org

Tips
- Customer add-tip after ride
- Tip expiry worker (TIP_WINDOW_MS, default 120000 ms)
- Admin tip wallet balances, logs, payout

ERP
- Queue + worker + mapping tables

Reports
- Revenue, revenue-by-method, coupon usage, commissions
- Wallet log exports, vehicle audit export


------------------------------------------------
10. API SURFACE (MOUNTED UNDER /api)
------------------------------------------------

Prefix              | File                    | Responsibility
------------------- | ----------------------- | -----------------------------
/api/auth           | authRoutes.js           | Login, OTP, SSO, password
/api/admin          | adminRoutes.js          | Panel operations (largest module)
/api/rides          | ridesRoutes.js          | Customer, chauffeur, PD ride actions
/api/ride           | rideRoutes.js           | Rate types
/api/location       | locationRoutes.js +     | Live GPS + saved places
                    | savedLocationsRoutes.js |
/api/chauffeur      | chauffeurRoutes.js      | Chauffeur app extras
/api/user           | userRoutes.js +         | Profile, lists, reviews, status
                    | usersStatusRoutes.js    |
/api/vehicle        | vehicleRoutes.js        | Vehicles and master catalog
/api/payments       | paymentRoutes.js        | Telr, wallets, cash, refunds
/api/coupons        | couponRoutes.js         | Coupons and user groups
/api/pd             | pdRoutes.js             | PD dashboard-style APIs
/api/organization   | organizationRoutes.js   | Corporate orgs
/api/roles          | roleRoutes.js           | RBAC admin
/api/               | userProfilesRoutes.js   | Profile image upload/remove

Other HTTP pages:
- GET /                      landing HTML
- GET /delete-instructions   account-deletion instructions page
- GET /api-docs              Swagger
- GET /img, /uploads         static files

Auth header for protected routes:
  Authorization: Bearer <jwt>


------------------------------------------------
11. BACKGROUND WORKERS AND CRONS
------------------------------------------------

Started in production by scripts/start.sh via PM2:

Process                         | Role
------------------------------- | ------------------------------------------
index.js                        | HTTP API
notificationProcessor.js        | Send FCM jobs from notificationQueue
scheduleNotificationJob.js      | Cron: fire scheduled-ride notifications
scheduleStatusChangeJob.js      | Cron: scheduled status transitions
tipWorker.js                    | Expire pending tips after window
cronHourlyEndWarn.js            | Warn customer/chauffeur before hourly ride ends
erpWorker.js                    | Sync completed rides to Nymbl ERP

Also in repo (not all in start.sh):
- silentNotificationProcessor.js
- bulkNotification.js
- oneTimeStatusChangeJob.js
- scheduleErpJob.js (npm run cron:erp)

npm scripts:
- npm start          node index.js
- npm run dev        nodemon index.js
- npm run worker     notification processor
- npm run cron:minute  scheduled notification cron
- npm run migrate / seed
- npm test           Jest


------------------------------------------------
12. SECURITY MODEL
------------------------------------------------

1. Transport: HTTPS in deployed environments; Helmet headers on all responses
2. Authentication: JWT signed with JWT_SECRET
3. Session binding: Redis stores the current token; a new login invalidates the old one
4. Authorization: permission strings on Role policies, checked per route
5. Passwords: bcryptjs
6. OTP expiry: OTP_EXPIRATION (ms)
7. File uploads: multer memory storage then S3 (not long-term local disk for media)
8. DB SSL: DB_SSL=true enables pg SSL with rejectUnauthorized false (typical for RDS)
9. Secrets: .env (never commit real keys)

Important permission examples
- orders.create / orders.update / orders.view
- drivers.view / drivers.manage
- users.create / users.update / users.view / users.delete
- vehicles.*
- coupons.*
- organizations.*
- reports.generate / reports.view
- roles.*
- locations.create / locations.view / locations.save
- regions.create / regions.update


------------------------------------------------
13. DEPLOYMENT AND ENVIRONMENTS
------------------------------------------------

Source
- GitLab: git+https://gitlab.com/binu.joseph/zeizzu_rewrite_api.git

Production pipeline
1. Push to branch prod-zeizzu
2. GitLab CI job sync-to-aws clones and force-with-lease pushes to AWS CodeCommit (me-central-1)
3. AWS CodeDeploy uses appspec.yml
   - BeforeInstall: scripts/cleanup.sh
   - AfterInstall: scripts/install.sh
   - ApplicationStart: scripts/start.sh
4. App directory on server: /var/www/zeizzu_rewrite_api
5. Node 18 via nvm, processes under PM2

Environments (typical)
- Local development: Node + local Redis + .env pointing at staging/local Postgres
- Staging: RDS, ElastiCache/Redis, DynamoDB, S3 bucket staging-zeizzu, API api.stage.avalift.ae
- Production: me-central-1, live S3, production RDS/Dynamo/Redis

Required local services
- Node.js 18 or 22 LTS recommended
- Redis on 127.0.0.1:6379 (REDIS_HOST, REDIS_PORT)
- PostgreSQL reachable with DB_* vars
- AWS credentials for DynamoDB + S3
- Firebase service account JSON path in FIREBASE_CONFIG_FILE


------------------------------------------------
14. KEY ENVIRONMENT VARIABLE GROUPS
------------------------------------------------

Do not paste real secrets into shared docs. Group names only:

Database: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DIALECT, DB_SSL
Server: NODE_ENV, PORT
Auth: JWT_SECRET, OTP_EXPIRATION
AWS: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
Redis: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
Firebase: FIREBASE_CONFIG_FILE
SMS: DEFAULT_SMS_PROVIDER, SMS_COUNTRY_*
Email: EMAIL_USER, EMAIL_PASS
Telr: TELR_MERCHANT_ID, TELR_SECRET_KEY, TELR_API_URL, APPLE_PAY_SECRET_KEY, TEST_MODE
ERP: ERP_INVOICE_API, ERP_SECRET_KEY, ERP_CLIENT_ID, ERP_QUEUE_NAME, ...
Product: CURRENCY_CODE, COMMISSION_PERCENTAGE, REFERRAL_REWARD_AMOUNT, NOTIFICATION_RADIUS, AUTO_NOTIFICATION_TIME, app version keys
Queues: NOTIFICATION_QUEUE_NAME, TIP_QUEUE_NAME, TIP_WINDOW_MS
Cron: CRON_SCHEDULE, HOURLY_END_WARN_* , CRON_SCHEDULE_STATUS_CHANGE


------------------------------------------------
15. RIDE + PD DOMAIN MODEL (SIMPLE)
------------------------------------------------

Customer Ride (DynamoDB Rides)
- One customer, optional chauffeur, optional organization
- Status log is an append-only history
- Fare estimate vs actual, rate type, extras, payment method

Chauffeur Ride (DynamoDB ChauffeurRides)
- Chauffeur being transported by a PD driver
- Statuses such as pickup requested / picked up / dropped

PD Trip (DynamoDB PDPickupDrop)
- PD driver id, date
- arrays of pickups[] and drops[] with chauffeur_id, lat/long, sequence
- capacity vs current_count

Nearby matching
- CurrentLocation in Postgres
- NOTIFICATION_RADIUS / NEARBY_PD_RADIUS (meters, e.g. 50000)


------------------------------------------------
16. END-TO-END EXAMPLE: BOOK AND COMPLETE A RIDE
------------------------------------------------

1. Customer logs in with OTP → JWT stored in Redis
2. Customer updates GPS → /api/location/updatelocation
3. Customer asks estimate → /api/rides/customers/calculate-estimate
4. Customer requests ride → /api/rides/customers/request
   - Ride row written to DynamoDB status Requested
   - Nearby chauffeurs notified via FCM queue
5. Chauffeur responds → /api/rides/chauffeurs/respond  (Accepted)
6. Chauffeur on-the-way → reached → start
7. Photos uploaded to S3, VehicleAudit in DynamoDB
8. Complete ride → payment (Telr or wallet or cash)
9. Optional tip → tip wallet + expiry job
10. Optional review → Reviews table
11. If Completed, ERP job creates accounting invoice
12. Admin can see revenue, wallet history, and export Excel


------------------------------------------------
17. NON-GOALS / CURRENT CHARACTERISTICS
------------------------------------------------

- Not a serverless-first app (serverless packages exist; production is PM2 on EC2)
- mongoose is in package.json but primary data layers are Sequelize + DynamoDB
- Rate limiting middleware is present but disabled
- Twilio helper is stubbed; live SMS is SMS Country
- Swagger title is generic (“Your API”); source of truth is the route files
- sequelize.sync({ alter: true }) runs on startup (dev convenience; be careful in production)


------------------------------------------------
18. QUICK START (LOCAL)
------------------------------------------------

1. Install Node 18 or 22 LTS
2. npm install
3. Fill .env (DB_*, REDIS_HOST=127.0.0.1, AWS_*, JWT_SECRET, Firebase file path)
4. Start Redis (brew services start redis)
5. npm run dev
6. Wait for: Database connected... / Database synchronized... / Server is running on port 3000
7. Open http://localhost:3000/api-docs

Workers (optional locally):
- npm run worker
- npm run cron:minute
- node src/workers/erpWorker.js
- node src/workers/tipWorker.js


------------------------------------------------
19. GLOSSARY
------------------------------------------------

Avalift     Product name (UAE chauffeur service)
Zeizzu      Original/codebase name of this API
PD          Pickup-Drop driver who ferries chauffeurs
Telr        Payment gateway used for cards and Apple Pay
FCM         Firebase Cloud Messaging (push)
RBAC        Role-based access control
ERP         Nymbl accounting invoice integration
Quick Link  Telr payment URL created by admin for a customer
Rate type   Pricing mode (e.g. hourly vs point-to-point)
OTP         One-time password over SMS


------------------------------------------------
20. DIAGRAM INDEX (FOR GOOGLE DOCS)
------------------------------------------------

Include these visuals in the Doc (sections above):
1. High-level system diagram (section 3)
2. Request flow / sequence (section 6)
3. Data ownership Postgres vs DynamoDB vs Redis (section 7.4)
4. Ride lifecycle (section 8.2)
5. Wallet and cash handover (section 8.4)

Suggested Doc outline after paste:
- Title + 1-page overview
- Actors
- Architecture diagram
- Tech stack table
- Data stores
- Ride / payment / notification flows
- API module list
- Workers and deploy
- Local setup

END OF DOCUMENT
