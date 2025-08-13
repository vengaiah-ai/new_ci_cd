import { useState, useEffect, useCallback } from 'react';
import { ChatMessage, ChatState } from '../types';

const CHAT_HISTORY_KEY = 'chat-history';

export const useChat = ({ selectedCredential }: { selectedCredential?: string }) => {
  const [state, setState] = useState<ChatState>(() => {
    const savedHistory = localStorage.getItem(CHAT_HISTORY_KEY);
    
    return {
      isOpen: false,
      isMinimized: false,
      messages: savedHistory ? JSON.parse(savedHistory) : [],
      isLoading: false,
    };
  });

  // Save chat history to localStorage
  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(state.messages));
  }, [state.messages]);

  const updateState = useCallback((updates: Partial<ChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleChat = useCallback(() => {
    if (state.isOpen) {
      updateState({ isOpen: false, isMinimized: false });
    } else {
      updateState({ isOpen: true, isMinimized: false });
    }
  }, [state.isOpen, updateState]);

  const minimizeChat = useCallback(() => {
    updateState({ isMinimized: true, isOpen: false });
  }, [updateState]);

  const clearHistory = useCallback(() => {
    updateState({ messages: [] });
    localStorage.removeItem(CHAT_HISTORY_KEY);
  }, [updateState]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
    }));

    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) {
      return;
    }

    addMessage({
      role: 'user',
      content: content.trim(),
    });

    updateState({ isLoading: true });

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: content.trim(), aws_credential_name: selectedCredential }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'API request failed');
      }

      const result = await response.json();
      const assistantResponse = result.response;

      if (assistantResponse) {
        addMessage({
          role: 'assistant',
          content: assistantResponse,
          markdown: true, // Assuming the backend might send markdown
        });
      } else {
        throw new Error('No response received from the backend');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

      addMessage({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}`,
        error: true,
      });
    } finally {
      updateState({ isLoading: false });
    }
  }, [addMessage, updateState, selectedCredential]);

  const retryMessage = useCallback(async (messageId: string) => {
    const messageIndex = state.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = state.messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== 'user') return;

    // Remove the failed message and retry
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== messageId),
    }));

    await sendMessage(userMessage.content);
  }, [state.messages, sendMessage]);

  return {
    ...state,
    toggleChat,
    minimizeChat,
    clearHistory,
    sendMessage,
    retryMessage,
    addMessage,
    updateMessage,
  };
};