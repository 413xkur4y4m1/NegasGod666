# LaSalle Gestiona

This is a Next.js application for managing material loans at LaSalle Neza, built with Firebase and Genkit AI.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

### Prerequisites

You need to create a `.env.local` file in the root of the project and add your Firebase configuration:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Admin Access

The administrator account provides access to the admin dashboard for managing users, materials, loans, and viewing AI-powered reports.

- **Username:** `admin@lasalle.edu.mx`
- **Password:** `admin123`

You can log in as the admin through the standard login page.

## Data Simulation

A hidden page is available to simulate data in the system for development and testing purposes.

- **URL:** `/dev/simulate`
- **Access Token:** `SIMULATE-LASALLE-NEZA-2024`

Append the token as a query parameter to access the page: `/dev/simulate?token=SIMULATE-LASALLE-NEZA-2024`
