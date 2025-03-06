# Hales AI Website

## Project Overview
This is the main repository for the Hales AI website, featuring advanced AI telephony, workflow automation, and digital cloning technology.

## Important Note
The `examplecode` directory contains reference implementations and backup code. This is not part of the main application - all active development should be done in the root-level `src` directory. Do not modify the `examplecode` directory unless specifically instructed to do so.

## Development Setup

1. **Clone the Project:**
   ```bash
   git clone https://github.com/notsoround/HalesGlobal.git
   ```

2. **Navigate to project folder:**
   ```bash
   cd HalesGlobal
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Environment Variables:**
   Create a `.env` file in the root directory with:
   ```
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=
   ```

5. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:5174` (or another port if 5173 is in use)

## Project Structure

```
/
├── src/                # Main application code
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components and routes
│   ├── services/      # External service integrations
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions and helpers
│   └── assets/        # Static assets
│
└── examplecode/       # Reference implementations and backups (DO NOT MODIFY)
```

### Protected Routes
- `/elite-ops`: Password protected page for team contacts (password: "halesai")

### Key Components
- `VoiceButton`: Handles voice interactions using Vapi
- `MatrixBackground`: Animated background effect
- `PasswordProtection`: Handles route protection
- `HamburgerMenu`: Mobile navigation menu
- `ProjectShowcase`: Displays project cards
- `BackButton`: Navigation component for returning to home page from other routes
  - Appears on all non-home pages
  - Positioned in top-left corner
  - Features gradient background with hover effects

## Deployment

The site is deployed at https://hales.ai using the following setup:

### GitHub Credentials
- Username: notsoround
- Personal Access Token: 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

### Server Configuration
- Server IP: 143.198.69.38
- Docker container running on port 3000
- Nginx reverse proxy handling SSL and domain routing
- SSL certificates managed by Let's Encrypt

### Deployment Steps

1. **Push changes to main branch:**
   ```bash
   git add .
   git commit -m "your commit message"
   git push origin main
   # When prompted:
   # Username: notsoround
   # Password: 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
   ```

2. **SSH into server:**
   ```bash
   ssh root@143.198.69.38
   ```

3. **Update and restart container:**
   ```bash
   cd HalesGlobal
   git pull origin main
   docker stop $(docker ps -a -q --filter "publish=3000")
   docker build -t halesglobal .
   docker run -d -p 3000:3000 halesglobal
   ```

### Architecture Notes
- The application runs in a Docker container on port 3000
- Nginx handles SSL termination and proxies requests to the container
- Domain hales.ai points to 143.198.69.38
- SSL certificates are stored in /etc/letsencrypt/live/hales.ai/

## Technical Stack
- **Frontend Framework**: React with Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Voice Integration**: Vapi service
- **Container**: Docker
- **Server**: Nginx on Ubuntu 24.04
- **SSL**: Let's Encrypt
- **State Management**: React hooks
- **Build Tool**: Vite

## Maintenance
- Regular updates to dependencies via `npm update`
- SSL certificate auto-renewal through Let's Encrypt
- Docker container logs available via `docker logs [container-id]`
- Nginx logs at `/var/log/nginx/`

## Code Organization
- All active development should be done in the root-level `src` directory
- The `examplecode` directory contains reference implementations and should not be modified
- Changes should only be made to files outside of `examplecode`