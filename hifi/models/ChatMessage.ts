import mongoose from 'mongoose';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface IChatMessage {
  _id?: string;
  sessionId: string;
  userId: string;
  role: MessageRole;
  content: string;
  metadata?: {
    planId?: string;
    action?: 'create_plan' | 'modify_plan' | 'approve_plan' | 'cancel_plan' | 'explain_plan';
    step?: number;
    collectedData?: {
      amount?: number;
      riskPreference?: string;
      lockupComfort?: string;
      executionMode?: string;
    };
  };
  createdAt: Date;
}

const ChatMessageSchema = new mongoose.Schema<IChatMessage>({
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  metadata: {
    planId: String,
    action: {
      type: String,
      enum: ['create_plan', 'modify_plan', 'approve_plan', 'cancel_plan', 'explain_plan'],
    },
    step: Number,
    collectedData: {
      amount: Number,
      riskPreference: String,
      lockupComfort: String,
      executionMode: String,
    },
  },
}, {
  timestamps: true,
});

// Indexes for efficient querying
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
ChatMessageSchema.index({ userId: 1, createdAt: -1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
