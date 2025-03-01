import axios from 'axios';

// Get API credentials from environment variables
const API_KEY = import.meta.env.VITE_VAPI_API_KEY || 'e73916ba-515a-4a6e-85ff-dc208385eb9e';
const ASSISTANT_ID = import.meta.env.VITE_VAPI_ASSISTANT_ID || '1ec0bb05-5e47-4f1d-9857-03e1c5d793ec';
const API_BASE_URL = 'https://api.vapi.ai';

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

  constructor() {
    this.headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
    this.phoneNumber = '+15555555555'; // Placeholder phone number
    this.conversationId = null;
  }

  async initializeConversation(): Promise<string> {
    if (this.conversationId) return this.conversationId;
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/v1/conversation`,
        {
          assistant_id: ASSISTANT_ID,
          phone_number: this.phoneNumber,
          metadata: {
            source: "web_chat",
            user_id: "web_user_" + Date.now()
          }
        },
        { headers: this.headers }
      );
      
      this.conversationId = response.data.conversation_id;
      return this.conversationId;
    } catch (error) {
      console.error('Error initializing conversation:', error);
      throw new Error('Failed to initialize conversation');
    }
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      // Make sure we have a conversation ID
      if (!this.conversationId) {
        await this.initializeConversation();
      }
      
      // Send the message to the conversation
      const response = await axios.post(
        `${API_BASE_URL}/v1/chat`,
        {
          conversation_id: this.conversationId,
          message: message,
          should_stream: false
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
      console.error('Error sending message to Vapi.ai:', error);
      
      // Check if we have a response with error details
      if (error.response && error.response.data) {
        console.error('API error details:', error.response.data);
      }
      
      // If the error is related to the conversation ID, try to reinitialize
      if (error.response && error.response.status === 404 && this.conversationId) {
        this.conversationId = null;
        try {
          await this.initializeConversation();
          return this.sendMessage(message); // Retry with new conversation
        } catch (retryError) {
          console.error('Failed to recover from error:', retryError);
        }
      }
      
      return {
        message: "I'm sorry, I encountered an error while processing your request. Please try again later."
      };
    }
  }

  // Method to check if API credentials are configured
  isConfigured(): boolean {
    return Boolean(API_KEY && ASSISTANT_ID && 
      API_KEY !== 'your_vapi_api_key_here' && 
      ASSISTANT_ID !== 'your_assistant_id_here');
  }
}

export const vapiService = new VapiService();