# Realtime Voice Chat GPT App

This project is a real-time voice chat application integrating OpenAI’s GPT for chat responses, Whisper for speech-to-text, and TTS for text-to-speech. It uses Node.js, Express.js, WebSockets, and ffmpeg on the backend, plus the Web Audio API and MediaRecorder API on the frontend.

Currently, it's not that great However, I will continue to update it as I have time to dabble. Here's a joke for you. How many people does it take to screw in a lightbulb? A Minimum of 2!.... Ha I'll just I need I need something to cover upWe're still trying to figure out how they got in the lightbulb! 
---

## Project Overview

- **Backend** (`server.js`):
  - **Express.js** for HTTP and WebSocket communication
  - **OpenAI** for GPT, Whisper, TTS
  - **ffmpeg** for audio processing (WebM → WAV → TTS output, etc.)
  - **Environment variables** in `.env` (like `OPENAI_API_KEY`)

- **Frontend** (`public/index.html`):
  - **WebSocket** client for real-time audio send/receive
  - **MediaRecorder API** for capturing user’s microphone
  - **Silence detection** (2 seconds of silence triggers sending the audio)
  - **UI** with a start button and status text

- **Flow**:
  1. User clicks **Start Chat**
  2. Microphone audio recorded and streamed
  3. After silence detection, audio sent via WebSocket
  4. Server transcribes via Whisper, processes with GPT-4
  5. GPT response is converted to audio (TTS) and sent back
  6. Frontend plays the reply
  7. Loop continues until user stops or a timeout occurs

---

## Local Development

1. **Install Dependencies**  
   Make sure you have:
   - **Node.js** (v18.x)
   - **npm**  
   Then in your local project folder:
   ```bash
   npm install

	2.	Set Environment Variables
Create a file named .env (which is not committed to Git, thanks to .gitignore). For example:

OPENAI_API_KEY=YOUR_OPENAI_KEY


	3.	Run the Server

node server.js

This starts the app locally on http://localhost:3000.

Deploying to a DigitalOcean Droplet
	1.	Push Code to GitHub
	•	Make changes in your local project.
	•	In a terminal:

git add .
git commit -m "Your commit message"
git push origin main


	2.	SSH into Your Droplet

ssh root@YOUR_DROPLET_IP


	3.	Pull the Latest Changes

cd ~
cd -realtime-voice-chat-jan25  # or whatever your folder is called
git pull


	4.	Install Dependencies (If New Ones Added)

npm install


	5.	Manage the App with PM2
	•	Start (or Restart) the app:

pm2 restart server.js


	•	Check logs:

pm2 logs


	•	Ensure PM2 autostarts on reboot:

pm2 save
pm2 startup

(Follow any instructions printed to the console.)

	6.	Nginx Reverse Proxy
We use Nginx to point traffic from http://YOUR_DOMAIN_OR_IP to localhost:3000.
	•	Config File: /etc/nginx/sites-available/voice-app
	•	Important lines (example):

server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}


	•	Enable & Restart:

sudo ln -s /etc/nginx/sites-available/voice-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx


	7.	Update WebSocket URL
In public/index.html (or corresponding front-end script), update:

const socket = new WebSocket("ws://YOUR_DOMAIN_OR_IP");

If using HTTPS, use wss://YOUR_DOMAIN_OR_IP.

Common Troubleshooting
	1.	WebSocket Connection Fails
	•	Check the WebSocket URL in your front-end.
	•	Make sure the port or domain matches your Nginx config.
	2.	Audio or Microphone Issues
	•	Ensure the user has granted microphone permissions in the browser.
	•	Check console logs for “getUserMedia” errors.
	3.	OpenAI Errors
	•	Make sure OPENAI_API_KEY is valid and your .env is loaded via require('dotenv').config().
	4.	PM2 Not Starting on Reboot
	•	Run pm2 save && pm2 startup.
	•	Follow any instructions from the terminal output.
	5.	Nginx Errors
	•	Run sudo nginx -t to validate your config.
	•	Check if you have any conflicting configs in /etc/nginx/sites-enabled.

Summary
	•	Edit code locally, commit, push to GitHub.
	•	SSH into droplet, pull changes, pm2 restart server.js.
	•	Check logs for errors or success messages.
	•	Keep .env out of version control.
	•	Update server_name and WebSocket URLs for production use.

Enjoy building and expanding this real-time voice chat app with GPT!

you can reach me  at Matt@Hales.Ai