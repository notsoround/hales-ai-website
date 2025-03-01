# Project Setup Guide

## Installation Steps

1. **Clone the Project:**

   ```bash
   git clone https://github.com/notsoround/HalesGlobal.git
   ```

2. **Navigate to project folder**

   ```bash
   cd HalesGlobal
   ```

3. **Install Dependencies:**

   Run the following command to install the required Node.js packages:

   ```bash
   npm install
   ```

4. **Create a `.env` File:**

   In the root directory of the project, create a `.env` file and add the following environment variables:

   ```bash
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=
   ```

   Make sure to replace the empty values with your actual keys and URLs.

5. **Run the Project:**

   Start the development server with:

   ```bash
   npm run dev
   ```

   - Go to `http://localhost:3000`


**Steps to upload it to server**

1. Make changes in the code and then run these commands
   a. git add .
   b. git commit -m "matt is messing around"
   c. git push origin main

2. Connect to the server by typing the command below shown

   ssh root@143.198.69.38
   
3. Go to HalesGlobal Folder by typing `cd HalesGlobal` and then type `git pull origin main`

4. Make sure to ensure there is no previous container is running, just type `docker container ls` 
and stop the container which has port 3000 by this command `docker stop ${container-id}`

5. Type this command `docker build -t halesglobal .` to build the image and then run this command `docker run -d -p 3000:3000 halesglobal` to start the server and wohooo you have uploaded it to the server.

