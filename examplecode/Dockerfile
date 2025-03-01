FROM node:current-alpine

WORKDIR /app

ENV NEXT_PUBLIC_VAPI_PUBLIC_KEY=e73916ba-515a-4a6e-85ff-dc208385eb9e
ENV NEXT_PUBLIC_VAPI_ASSISTANT_ID=1ec0bb05-5e47-4f1d-9857-03e1c5d793ec

COPY package*.json ./

RUN npm install --frozen-lockfile

COPY . .

RUN npm run build

# Verify sound files exist
RUN ls -la public/Hales-Ai_Quantum_Code/sounds/ || echo "Warning: Sound files not found"

# Ensure proper permissions
RUN chmod -R 755 public/

EXPOSE 3000

CMD ["npm", "start"]
