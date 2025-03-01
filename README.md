# Hales AI Website

## Project Setup Guide

### Installation Steps

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

4. **Create a `.env` File:**
   In the root directory, create a `.env` file with:
   ```bash
   VITE_VAPI_PUBLIC_KEY=
   VITE_VAPI_ASSISTANT_ID=
   ```
   Replace empty values with your actual keys.

5. **Development:**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5173` (or the port shown in terminal)

### Deployment Steps

1. **Push Changes:**
   ```bash
   git add .
   git commit -m "your commit message"
   git push origin main
   ```

2. **SSH to Server:**
   ```bash
   ssh root@143.198.69.38
   ```

3. **Update Server Code:**
   ```bash
   cd HalesGlobal
   git pull origin main
   ```

4. **Docker Operations:**
   ```bash
   # List running containers
   docker container ls
   
   # Stop existing container (if any)
   docker stop $(docker ps -q --filter publish=3000)
   
   # Build new image
   docker build -t halesglobal .
   
   # Run new container
   docker run -d -p 3000:3000 halesglobal
   ```

The site should now be live with your latest changes!

## Tech Stack
- Vite + React
- TypeScript
- Tailwind CSS
- Docker
- Nginx