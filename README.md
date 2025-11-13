# CCA Ticketing System – Backend (Server)

This repository contains the **backend API server** for the **Saint Louis University Center for Culture and the Arts (CCA) Ticket Monitoring System**.  
It is built with **Node.js**, **Express.js**, and **Prisma ORM**, serving as the central system for data handling, authentication, and communication with the frontend.

---

## Features

- RESTful API for managing users, shows, schedules, tickets, and remittances
- Secure role-based access control (CCA Head, Trainer, Distributor, Audience)
- Real-time notifications and updates using **Pusher**
- File and image storage integration using **Appwrite**
- MySQL database hosted via **Aiven**
- Continuous deployment and hosting through **Vercel**

---

## Prerequisites

Before running the backend locally, make sure you have:

- [Node.js](https://nodejs.org/en/download) (v18 or newer)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)
- Access credentials for:
  - **Appwrite** – file and image storage
  - **Pusher** – real-time communication
  - **Aiven** – MySQL database hosting

---

## Installation

1.  **Clone the repository**

    ```bash
    git clone <server_repository_url>
    cd server
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Create a `.env` file in the project root directory and add the following variables:**

    ```env
    PORT=3000
    NODE_ENV=development
    TOKEN_KEY=your_secret_token_key
    FRONTEND_URL=http://localhost:5173

    DATABASE_URL=mysql://user:password@hostname:port/dbname?sslmode=require

    APP_WRITE_ENDPOINT=https://cloud.appwrite.io/v1
    APP_WRITE_PROJECT_ID=your_appwrite_project_id
    APP_WRITE_API_KEY=your_appwrite_api_key
    APP_WRITE_BUCKET_ID=your_appwrite_bucket_id

    PUSHER_APP_ID=your_pusher_app_id
    PUSHER_KEY=your_pusher_key
    PUSHER_SECRET=your_pusher_secret
    PUSHER_CLUSTER=ap1
    ```

4.  **Set up Prisma (Database ORM)**
    After configuring your `.env` file, initialize the database and generate the Prisma client by running the following commands in your terminal:

    ```bash
    # Push the Prisma schema to your database
    npx prisma db push

    # Generate the Prisma client
    npx prisma generate
    ```

## Running the Server

To start the development server, run:

```bash
npm run dev
```

The API will be accessible at:
http://localhost:3000

## Integration Notes

The frontend connects to this backend via the `VITE_API_BASE_URL` in its `.env` file.

Ensure both backend and frontend are running simultaneously for full system functionality.

Real-time events are managed through Pusher, and media storage is handled by Appwrite.

## Deployment

This project is preconfigured for Vercel deployment with environment variables.
Once pushed to GitHub and imported into Vercel, it will automatically build and deploy using continuous integration.

## Additional Notes

The backend and frontend source codes are hosted in private GitHub repositories.
Access must be requested from the development team to clone and deploy the projects.

The backend is fully optimized to work seamlessly with Vercel’s deployment environment, ensuring smooth integration of environment variables, build scripts, and real-time services.
