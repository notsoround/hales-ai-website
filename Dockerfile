# Build stage
FROM node:22-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Vite build-time public vars (passed via --build-arg from the droplet .env,
# since .env is intentionally excluded from the build context via .dockerignore)
ARG VITE_CUPCAKE_PASSWORD
ARG VITE_VAPI_API_KEY
ARG VITE_VAPI_ASSISTANT_ID
ENV VITE_CUPCAKE_PASSWORD=$VITE_CUPCAKE_PASSWORD
ENV VITE_VAPI_API_KEY=$VITE_VAPI_API_KEY
ENV VITE_VAPI_ASSISTANT_ID=$VITE_VAPI_ASSISTANT_ID

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]