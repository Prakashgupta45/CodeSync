#                                       💻 CodeSync AI

### AI-Powered Real-Time Pair Programming & Coding Interview Platform

CodeSync AI is a full-stack collaborative development platform that enables developers to code together in real time, communicate through live chat and video calling, execute code in isolated environments, and receive AI-powered programming and interview assistance.

Built with Next.js, TypeScript, Express.js, PostgreSQL, Prisma, Socket.IO, Yjs, and Docker, CodeSync brings collaborative coding and AI-assisted development into one unified workspace.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![Docker](https://img.shields.io/badge/Docker-Containerization-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📌 Project Summary

CodeSync AI is designed to make pair programming, collaborative development, and technical interviews easier and more efficient.

Users can create or join coding rooms, collaborate through a shared Monaco editor, communicate in real time, and use AI-powered assistance while solving programming problems.

The platform follows a modular monorepo architecture with separate frontend, backend, database, shared packages, and an admin application.

## 🎯 Problem Statement

Developers and students often depend on multiple disconnected applications for collaborative coding, communication, debugging, and technical interviews.

This creates several challenges:

- Difficulty collaborating on the same code in real time.
- Delayed communication during pair programming.
- Switching between coding and video conferencing applications.
- Limited access to contextual programming assistance.
- Difficulty managing structured online coding interviews.

CodeSync AI aims to address these challenges by combining collaborative coding, real-time communication, AI assistance, and coding interview capabilities in one platform.

## ✨ Key Features

### 👥 Collaborative Coding

- Create and join coding rooms.
- Real-time collaborative code editing.
- Shared Monaco code editor.
- Collaborative synchronization using Yjs.
- Socket.IO-based real-time communication.
- Live participant presence.

### 💬 Real-Time Communication

- Room-based communication.
- Real-time chat.
- Participant presence indicators.
- WebRTC-based video calling.

### 🤖 AI Pair Programmer

- AI-powered programming assistance.
- Code understanding and explanations.
- Debugging assistance.
- Programming problem-solving guidance.
- AI-generated coding suggestions.

### 🎤 AI Interviewer

- AI-assisted technical interview experience.
- Programming and interview assistance.
- Coding interview interaction.
- Interview-focused guidance.

### ⚙️ Code Execution

- Docker-based isolated code execution architecture.
- Controlled execution environments.
- Execution output and error handling.

### 🔐 Authentication & Security

- JWT-based authentication.
- Password hashing using bcryptjs.
- Cookie-based authentication support.
- Request validation using Zod.
- Security middleware using Helmet.
- CORS configuration and rate limiting.

### 🛠 Admin Application

- Dedicated Next.js admin application.
- Separate development server.
- Shared TypeScript contracts and validation schemas.

---

## 🏗 System Architecture

CodeSync AI follows a modular monorepo architecture using npm workspaces.

```text
                         CodeSync AI
                              |
             +----------------+----------------+
             |                |                |
             ▼                ▼                ▼
        Frontend App     Backend API      Admin App
          Next.js         Express.js        Next.js
             |                |
             ▼                ▼
        Monaco Editor      Socket.IO
             |                |
             |                ▼
             |          Real-Time Rooms
             |                |
             +----------------+
                              |
                  +-----------+-----------+
                  |                       |
                  ▼                       ▼
             Shared Package        Database Package
             TypeScript                  Prisma
             + Zod                        |
                                          ▼
                                      PostgreSQL

                           Docker Compose
                                |
                         +------+------+
                         |             |
                         ▼             ▼
                     PostgreSQL      Redis
```

## 🛠 Tech Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Monaco Editor
- Lucide React

### Backend

- Node.js
- Express.js
- TypeScript
- REST APIs
- JWT
- bcryptjs
- Zod

### Database & ORM

- PostgreSQL 16
- Prisma ORM 6

### Real-Time Collaboration

- Socket.IO
- Socket.IO Client
- WebSockets
- Yjs
- y-protocols
- y-monaco

### Infrastructure

- Docker
- Docker Compose
- Redis 7

### Testing & Development

- Jest
- Supertest
- TypeScript
- ESLint
- Postman
- Git
- GitHub
- VS Code

---

## 📂 Project Structure

```text
CodeSync/
│
├── apps/
│   ├── frontend/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   ├── backend/
│   │   ├── src/
│   │   └── tests/
│   │
│   └── admin/
│       ├── app/
│       ├── components/
│       └── lib/
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   └── src/
│   │
│   └── shared/
│       └── src/
│
├── docker-compose.yml
├── package.json
├── package-lock.json
└── README.md
```

Note: The structure above highlights the main workspace modules. Individual subdirectories may vary in your repository.

## 🔄 Application Workflow

```text
         User Authentication
                 |
                 ▼
          CodeSync Dashboard
                 |
                 ▼
       Create / Join Coding Room
                 |
                 ▼
       Invite Other Participants
                 |
                 ▼
       Collaborative Code Editing
                 |
            +----+----+
            |         |
            ▼         ▼
         Live Chat  Video Calling
            |         |
            +----+----+
                 |
                 ▼
       AI Programming Assistance
                 |
                 ▼
            Code Execution
                 |
                 ▼
       Review Output & Continue
                 |
                 ▼
        Complete Coding Session
```

---

## 🚀 Installation & Setup

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- Docker Desktop
- Git

### 1. Clone Repository

```bash
git clone https://github.com/Prakashgupta45/CodeSync.git
```

### 2. Move into Project Directory

```bash
cd CodeSync
```

### 3. Start Database and Cache Services

```bash
docker compose up -d
```

This starts:

| Service | Version | Port |
|---|---|---|
| PostgreSQL | 16 Alpine | 5432 |
| Redis | 7 Alpine | 6379 |

### 4. Install Dependencies

```bash
npm install
```

### 5. Generate Prisma Client

```bash
npm --workspace=packages/database run db:generate
```

### 6. Configure Environment Variables

The local development environment is already configured.

For a fresh installation, create the required `.env` file or files according to the application's configuration.

The following variables are used by the application:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL database connection URL |
| `JWT_SECRET` | Secret key used for JWT authentication |
| `CLIENT_URL` | Frontend application URL |
| `PORT` | Backend server port |
| `GEMINI_API_KEY` | Google Gemini API key for AI-powered features |

Use your own configuration values and credentials when setting up the project on another machine.

Important security notes:

- Never upload `.env` files to GitHub.
- Never expose database credentials or JWT secrets.
- Never commit API keys or other sensitive configuration values.
- Keep `.env` files excluded through `.gitignore`.
- Use `.env.example` for documenting required variable names without real values.

### 7. Run Database Migrations

```bash
npm --workspace=packages/database run db:migrate
```

---

## ▶️ Running the Application

Run each application in a separate terminal from the project root.

### Frontend

```bash
npm run dev --workspace=@codesync/frontend
```

### Backend

```bash
npm run dev --workspace=@codesync/backend
```

### Admin Application

```bash
npm run dev:admin
```

The admin application is configured to run on port `3001`.

---

## 🧪 Testing & Quality Checks

### Run Backend Tests

```bash
npm run test
```

### Type Checking

```bash
npm run type-check
```

### Lint Checks

```bash
npm run lint
```

### Build All Workspaces

```bash
npm run build
```

---

## 📸 Screenshots

Add actual application screenshots here to demonstrate the interface and functionality.

| Dashboard | Coding Rooms |
|---|---|
| Add Dashboard Screenshot | Add Coding Rooms Screenshot |

| Collaborative Editor | AI Pair Programmer |
|---|---|
| Add Editor Screenshot | Add AI Screenshot |

| Video Calling | AI Interviewer |
|---|---|
| Add Video Calling Screenshot | Add Interview Screenshot |

| Admin Dashboard | Profile |
|---|---|
| Add Admin Screenshot | Add Profile Screenshot |

## 📈 Project Highlights

- Modular npm workspaces monorepo.
- Separate frontend, backend, admin, database, and shared packages.
- Real-time collaborative coding architecture.
- Monaco Editor integration.
- Socket.IO and Yjs integration.
- PostgreSQL database with Prisma ORM.
- Docker Compose-based PostgreSQL and Redis services.
- JWT and bcryptjs authentication dependencies.
- Jest and Supertest backend testing setup.
- Shared TypeScript contracts and Zod validation.

## 🚀 Future Enhancements

- Advanced AI code review.
- AI-generated coding challenges.
- Interview performance analytics.
- Session recording and playback.
- Advanced collaborative debugging.
- GitHub repository integration.
- Additional programming language support.
- Enhanced code execution monitoring.
- Cloud deployment and horizontal scaling.
- CI/CD pipeline.
- Team workspaces and organization management.

## 📚 Learning Outcomes

Through this project, I gained practical experience in:

- Full-Stack TypeScript Development.
- Next.js and React Application Development.
- Node.js and Express.js Backend Development.
- PostgreSQL Database Design.
- Prisma ORM.
- Monorepo Architecture with npm Workspaces.
- Real-Time Communication using Socket.IO.
- Collaborative Editing using Yjs.
- Monaco Editor Integration.
- Docker and Containerized Services.
- JWT Authentication and Security Middleware.
- API Validation using Zod.
- Backend Testing using Jest and Supertest.

---

## 👨‍💻 Author

### Prakash Kumar

B.Tech CSE Student | Full Stack Developer | Machine Learning Enthusiast

📧 Email: alphapkcode@gmail.com

💼 LinkedIn: https://www.linkedin.com/in/prakash-kumar-bb5264327/

🐙 GitHub: https://github.com/Prakashgupta45

## ⭐ Support

If you find CodeSync AI useful, consider giving this repository a ⭐ on GitHub.

Suggestions, feedback, and contributions are always welcome!

---

<p align="center">
  Made with ❤️ by Prakash Kumar
</p>