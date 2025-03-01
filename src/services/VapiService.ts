import axios from 'axios';

// Get API credentials from environment variables
const API_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || 'eda08098-2253-4393-bbec-c2aeefb87582';
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID || '1ec0bb05-5e47-4f1d-9857-03e1c5d793ec';
const API_BASE_URL = 'https://api.vapi.ai/v1';  // Base URL for Vapi.ai API v1

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  message: string;
  audioUrl?: string;
}

class VapiService {
  private headers: Record<string, string>;
  private phoneNumber: string;
  private conversationId: string | null;
  private isInitializing: boolean;
  private initPromise: Promise<string> | null;
  private initRetries: number;
  private maxRetries: number;

  constructor() {
    console.log('Initializing VapiService with:', {
      apiBaseUrl: API_BASE_URL,
      apiKeyLength: API_KEY?.length || 0,
      assistantIdLength: ASSISTANT_ID?.length || 0
    });

    this.headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    this.phoneNumber = '+15555555555'; // Placeholder phone number
    this.conversationId = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.initRetries = 0;
    this.maxRetries = 2;
  }

  async initializeCall(): Promise<string> {
    console.log('Initializing web call...');
    
    // If already initialized, return the call ID
    if (this.conversationId) {
      console.log('Using existing call ID:', this.conversationId);
      return this.conversationId;
    }
    
    // If initialization is in progress, return the existing promise
    if (this.isInitializing && this.initPromise) {
      console.log('Initialization already in progress');
      return this.initPromise;
    }
    
    // Start initialization
    this.isInitializing = true;
    console.log('Starting new call initialization');
    
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        if (!this.isConfigured()) {
          throw new Error('VapiService is not properly configured');
        }
        
        // Generate a unique user ID that persists across page refreshes
        const userId = this.getUserId();
        console.log('Using user ID:', userId);
        
        const response = await axios.post(
          `${API_BASE_URL}/call`,
          {
            type: 'webCall',
            assistantId: ASSISTANT_ID,
            customerId: userId
          },
          { headers: this.headers }
        );
        
        if (!response.data || !response.data.id) {
          throw new Error('Failed to get call ID from response');
        }
        this.conversationId = response.data.id;
        console.log('Call initialized successfully:', this.conversationId);
        this.isInitializing = false;
        this.initRetries = 0;
        resolve(this.conversationId!);
      } catch (error: any) {
        this.isInitializing = false;
        this.initPromise = null;
        console.error('Error initializing call:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        
        // Retry initialization if we haven't exceeded max retries
        if (this.initRetries < this.maxRetries) {
          this.initRetries++;
          // Wait a bit before retrying
          setTimeout(async () => {
            try {
              const conversationId = await this.initializeCall();
              resolve(conversationId);
            } catch (retryError) {
              reject(retryError);
            }
          }, 1000 * this.initRetries);
        } else {
          reject(new Error('Failed to initialize conversation after multiple attempts'));
        }
      }
    });
    
    return this.initPromise;
  }

  // Generate or retrieve a persistent user ID
  private getUserId(): string {
    let userId = localStorage.getItem('vapi_user_id');
    if (!userId) {
      userId = `web_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('vapi_user_id', userId);
    }
    return userId;
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      // Make sure we have a conversation ID
      if (!this.conversationId) {
        await this.initializeCall();
      }
      
      // Send the message to the conversation
      const response = await axios.post(
        `${API_BASE_URL}/call/${this.conversationId}/chat`,
        {
          message: message,
          type: 'text',
          stream: false
        },
        { headers: this.headers }
      );
      
      // If we get a successful response
      if (response.data && response.data.messages && response.data.messages.length > 0) {
        // Get the last message from the assistant
        const assistantMessages = response.data.messages.filter(
          (msg: any) => msg.role === 'assistant'
        );
        
        if (assistantMessages.length > 0) {
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          return {
            message: lastMessage.content,
            audioUrl: lastMessage.audio_url
          };
        }
      }
      
      // Fallback response if we can't parse the API response
      return {
        message: "I received your message, but I'm having trouble formulating a response."
      };
    } catch (error: any) {
      // If the error is related to the conversation ID, try to reinitialize
      if (error.response && error.response.status === 404 && this.conversationId) {
        this.conversationId = null;
        try {
          await this.initializeCall();
          return this.sendMessage(message); // Retry with new conversation
        } catch (retryError) {
          // If reinitialization fails, return a fallback response
        }
      }
      
      return {
        message: "I'm sorry, I encountered an error while processing your request. Please try again later."
      };
    }
  }

  async sendAudioMessage(audioBase64: string): Promise<ChatResponse> {
    console.log('Starting audio message send process...');
    try {
      if (!this.isConfigured()) {
        console.error('VapiService is not properly configured');
        throw new Error('VapiService is not properly configured');
      }

      // Make sure we have a conversation ID
      if (!this.conversationId) {
        console.log('No conversation ID found, initializing conversation...');
        await this.initializeCall();
      }
      
      console.log('Sending audio to conversation:', this.conversationId);
      
      // Send the audio to the conversation
      const response = await axios.post(
        `${API_BASE_URL}/call/${this.conversationId}/chat/audio`,
        {
          audio: audioBase64,
          type: 'audio',
          mime_type: "audio/webm",
          sample_rate: 48000,
          stream: false
        },
        { headers: this.headers }
      );
      
      console.log('Audio message sent, processing response...');
      
      // If we get a successful response
      if (response.data && response.data.messages && response.data.messages.length > 0) {
        console.log('Received messages:', response.data.messages.length);
        
        // Get the last message from the assistant
        const assistantMessages = response.data.messages.filter(
          (msg: any) => msg.role === 'assistant'
        );
        
        console.log('Assistant messages found:', assistantMessages.length);
        
        if (assistantMessages.length > 0) {
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          console.log('Processing last message:', {
            hasContent: Boolean(lastMessage.content),
            hasAudioUrl: Boolean(lastMessage.audio_url)
          });
          
          return {
            message: lastMessage.content,
            audioUrl: lastMessage.audio_url
          };
        }
      }
      
      // Fallback response if we can't parse the API response
      return {
        message: "I received your audio, but I'm having trouble formulating a response."
      };
    } catch (error: any) {
      console.error('Error in sendAudioMessage:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      // If the error is related to the conversation ID, try to reinitialize
      if (error.response && error.response.status === 404 && this.conversationId) {
        console.log('Conversation not found, attempting to reinitialize...');
        this.conversationId = null;
        try {
          await this.initializeCall();
          console.log('Reinitialization successful, retrying audio message...');
          return this.sendAudioMessage(audioBase64); // Retry with new conversation
        } catch (retryError: any) {
          console.error('Reinitialization failed:', retryError.message);
        }
      }
      
      const errorMessage = error.response?.data?.message || error.message;
      console.error('Final error message:', errorMessage);
      
      return {
        message: `I'm sorry, I encountered an error: ${errorMessage}`
      };
    }
  }

  // Method to check if API credentials are configured
  isConfigured(): boolean {
    const configured = Boolean(API_KEY && ASSISTANT_ID &&
      API_KEY !== 'your_vapi_api_key_here' &&
      ASSISTANT_ID !== 'your_assistant_id_here');
    console.log('VapiService configuration status:', {
      hasApiKey: Boolean(API_KEY),
      hasAssistantId: Boolean(ASSISTANT_ID),
      isConfigured: configured,
      apiKey: API_KEY,
      assistantId: ASSISTANT_ID
    });
    return configured;
  }
}

export const vapiService = new VapiService();