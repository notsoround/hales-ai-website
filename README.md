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

### Server Configuration
- Server IP: 143.198.69.38
- Docker container running on port 3000
- Nginx reverse proxy handling SSL and domain routing
- SSL certificates managed by Let's Encrypt

### Deployment Prerequisites
1. **Environment Variables:**
   Make sure your `.env` file contains the GitHub credentials:
   ```
   GITHUB_USERNAME=your_github_username
   GITHUB_TOKEN=your_github_personal_access_token
   ```
   These credentials are used for authentication when pushing to and pulling from GitHub.

### Deployment Steps

1. **Push changes to main branch:**
   ```bash
   git add .
   git commit -m "your commit message"
   git push origin main
   # If prompted for credentials, use the values from your .env file
   ```

2. **SSH into server:**
   ```bash
   ssh root@143.198.69.38
   ```

3. **Clean Deployment (Recommended):**
   This approach avoids merge conflicts and ensures a clean deployment:
   ```bash
   # Backup existing code
   cd ~
   mv HalesGlobal HalesGlobal_backup_$(date +%Y%m%d)
   
   # Clone fresh copy
   git clone https://github.com/notsoround/HalesGlobal.git
   
   # Deploy
   cd HalesGlobal
   docker stop $(docker ps -a -q --filter "publish=3000")
   docker build -t halesglobal .
   docker run -d -p 3000:3000 halesglobal
   ```

4. **Alternative: Update Existing Repository:**
   Only use this if you need to preserve local changes on the server:
   ```bash
   cd HalesGlobal
   git stash  # Save any local changes
   git pull origin main
   docker stop $(docker ps -a -q --filter "publish=3000")
   docker build -t halesglobal .
   docker run -d -p 3000:3000 halesglobal
   ```

### Troubleshooting Deployment Issues

1. **Merge Conflicts:**
   If you encounter merge conflicts during `git pull`, use the clean deployment method above.

2. **Authentication Issues:**
   - Ensure your GitHub token is valid and has the necessary permissions
   - If your token has expired, generate a new one at GitHub → Settings → Developer settings → Personal access tokens

3. **Docker Issues:**
   - If the container fails to start, check logs: `docker logs $(docker ps -a -q -l)`
   - If the build fails, try rebuilding with no cache: `docker build --no-cache -t halesglobal .`

4. **Nginx Issues:**
   - Check Nginx logs: `tail -50 /var/log/nginx/error.log`
   - Verify Nginx is running: `systemctl status nginx`

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