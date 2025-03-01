require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const { OpenAI } = require('openai/index.mjs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// Add middleware to parse JSON bodies
app.use(express.json());

const port = 3000; // Changed port number
app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Add endpoint for /api/chat with proper body parsing
app.post('/api/chat', async (req, res) => {
    try {
        const { message, isInitialization } = req.body;
        
        if (isInitialization) {
            res.json({
                message: "Hello! I'm here to help. Please send your first message.",
                isInitialization: true
            });
            return;
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a helpful AI assistant that responds in English." },
                { role: "user", content: message }
            ]
        });

        res.json({
            message: response.choices[0].message.content,
            isInitialization: false
        });
    } catch (error) {
        console.error("Error handling API request:", error);
        res.status(500).json({
            message: "Failed to process your request. Please try again.",
            error: error.message
        });
    }
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
const wss = new WebSocketServer({ server });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

wss.on("connection", (ws) => {
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    console.log("Client connected");

    ws.on("message", async (message) => {
        try {
            console.log("Received audio data from client, size:", message.length);

            // Save the audio as a temporary file in webm format
            const tempFilePath = path.join(__dirname, "temp_audio.webm");
            fs.writeFileSync(tempFilePath, Buffer.from(new Uint8Array(message)));
            console.log("Audio saved. Converting to WAV for OpenAI processing...");

            // Convert WebM to WAV before sending to OpenAI
            const wavFilePath = path.join(__dirname, "temp_audio.wav");
            
            // Use fluent-ffmpeg for optimized audio conversion
            await new Promise((resolve, reject) => {
                const ffmpeg = require('fluent-ffmpeg');
                ffmpeg()
                    .input(tempFilePath)
                    .outputFormat('wav')
                    .audioChannels(1)
                    .audioFrequency(16000)
                    .audioCodec('pcm_s16le')
                    .addOutputOption('-ar', '16000')
                    .addOutputOption('-ac', '1')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(wavFilePath);
            });

            // Transcribe audio with OpenAI
            const response = await openai.audio.transcriptions.create({
                file: fs.createReadStream(wavFilePath),
                model: "whisper-1"
            });
            console.log("🔍 Transcription (What AI Heard):", response.text);

            // Generate AI Response (text)
            const aiResponse = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a helpful AI assistant that responds in English." },
                    { role: "user", content: response.text }
                ]
            });
            console.log("AI Response:", aiResponse.choices[0].message.content);

            // Convert AI response to speech
            const speechResponse = await openai.audio.speech.create({
                model: "tts-1",
                input: aiResponse.choices[0].message.content,
                voice: "alloy",
                speed: 1.2, // Slightly faster speech
                language: "en",
                response_format: "mp3" // More efficient format
            });
            console.log("Speech generated. Sending back to client...");

            // Send back the generated speech
            const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
            ws.send(audioBuffer);
            console.log("Audio response sent to client.");

            // Cleanup temp files
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(wavFilePath);
        } catch (error) {
            console.error("Error processing audio:", error);
            ws.send(`Error processing request: ${error.message}`);
        }
    });

    ws.on("close", () => console.log("Client disconnected"));
});