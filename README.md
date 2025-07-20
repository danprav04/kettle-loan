# Kettle - Shared Expense Tracker

Kettle is a modern, intuitive web application designed to simplify expense tracking for groups. Whether you're splitting bills with roommates, managing vacation costs, or tracking shared project expenses, Kettle provides a clear and collaborative platform to see who paid for what and who owes whom.

The application is built with a focus on simplicity and user experience, featuring real-time balance calculations, multi-language support, and a clean, responsive interface that works beautifully on all devices.

---

### ✨ Features

*   **🔐 Secure User Authentication**: Sign up and log in securely with JWT-based authentication.
*   **🚪 Room Management**: Create private rooms with unique 6-digit codes or join existing ones.
*   **💸 Expense & Loan Tracking**: Log two types of entries:
    *   **Expenses**: I paid for something and can split the cost with selected members.
    *   **Loans**: I borrowed money from the entire group.
*   **📊 Real-time Balances**: Instantly view your personal balance (what you're owed vs. what you owe).
*   **📈 Detailed Breakdown**: Get a detailed view of your balance against every other member in the room.
*   **🌍 Multi-Language Support**: Fully internationalized with support for English, Hebrew (עברית), and Russian (Русский), including RTL layout for Hebrew.
*   **🎨 Dual Themes**: Switch between a sleek Light mode and a cool Dark mode.
*   **☕ Kettle Mode**: A special simplified UI for quickly logging loans, inspired by the simplicity of a shared "kettle" or pot.
*   **📱 Fully Responsive**: A mobile-first design ensures a seamless experience on any device.
*   **🔒 Privacy Focused**: Leave a room at any time. Empty rooms are automatically deleted from the database.

---

### 🛠️ Tech Stack

This project is built with a modern, full-stack TypeScript architecture.

*   **Framework**: [Next.js](https://nextjs.org/) 15 (App Router)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/)
*   **Authentication**: [JWT](https://jwt.io/) & [bcryptjs](https://www.npmjs.com/package/bcryptjs)
*   **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/)
*   **Icons**: [React Icons](https://react-icons.github.io/react-icons/)

---

### 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

#### Prerequisites

*   Node.js (v20 or later)
*   npm or yarn
*   A running PostgreSQL instance

#### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd loan-calculator-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

#### Environment Variables

Create a `.env.local` file in the root of the project and add the following environment variables.

```env
# .env.local

# Your PostgreSQL connection string
POSTGRES_URL="postgres://USERNAME:PASSWORD@HOST:PORT/DATABASE"

# A long, secret key for signing JWTs
JWT_SECRET="your-super-secret-and-long-jwt-key"
```

#### Database Setup

Connect to your PostgreSQL database and run the schema script to create the necessary tables.

```sql
-- dstabse-tables.sql

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    last_ip VARCHAR(255)
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,
    creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE room_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE(user_id, room_id)
);

CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    split_with_user_ids JSONB, -- Stores an array of user IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Running the Application

1.  **Run the development server:**
    ```bash
    npm run dev
    ```

2.  Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

#### Building for Production

To create a production-ready build, run:

```bash
npm run build
```

This will create an optimized build in the `.next` directory. The `output: 'standalone'` configuration in `next.config.ts` ensures all necessary files are collected for deployment. To run the production server:

```bash
npm run start
```

---

### 📁 Project Structure

The project follows the standard Next.js App Router structure.

```
/
├── public/               # Static assets
├── src/
│   ├── app/              # Main application routes
│   │   ├── api/          # API endpoint routes
│   │   ├── (auth)/       # Authentication pages (layout)
│   │   ├── (main)/       # Main app pages with sidebar
│   │   └── layout.tsx    # Root layout
│   │   └── page.tsx      # Main auth page
│   ├── components/       # Reusable React components
│   ├── lib/              # Helper functions (DB, Auth)
│   └── messages/         # Internationalization (i18n) JSON files
├── .env.local            # Environment variables (untracked)
├── next.config.ts        # Next.js configuration
├── package.json          # Project dependencies and scripts
└── tailwind.config.ts    # Tailwind CSS configuration
```

---

### 🔌 API Documentation

The backend is handled by Next.js API Routes. All endpoints require a `Bearer <token>` in the `Authorization` header, except for `/login` and `/signup`.

| Method | Endpoint                       | Description                                                                                                                                      |
| :----- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/auth/signup`             | Creates a new user account.                                                                                                                      |
| `POST` | `/api/auth/login`              | Authenticates a user and returns a JWT.                                                                                                          |
| `POST` | `/api/rooms`                   | **Create a room** (with empty body) or **Join a room** (with `{"roomCode": "ABCDE"}` in body).                                                    |
| `GET`  | `/api/user/rooms`              | Retrieves all rooms the authenticated user is a member of.                                                                                       |
| `GET`  | `/api/rooms/{roomId}`          | Fetches all data for a specific room, including entries, members, and calculated balances.                                                       |
| `POST` | `/api/entries`                 | Adds a new financial entry (expense or loan) to a room.                                                                                          |
| `DELETE`| `/api/rooms/{roomId}/members` | Removes the authenticated user from a room. If the room becomes empty, it is automatically deleted.                                                |

---

### 🌐 Internationalization (i18n)

Adding a new language is straightforward:

1.  Create a new JSON file in the `src/messages/` directory (e.g., `fr.json`).
2.  Copy the contents of `en.json` and translate all the values.
3.  Import the new message file in `src/components/IntlProvider.tsx` and add it to the `messages` object.
4.  Add the new language option to the `languages` array in `src/components/RoomsSidebar.tsx` to make it available in the language switcher.
