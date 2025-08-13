import React, { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '../../hooks/useChat';
import { BaseComponentProps } from '../../types';

interface ChatWidgetProps extends BaseComponentProps {
  selectedCredential?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ className = '', selectedCredential, ...props }) => {
  const {
    isOpen,
    isMinimized,
    messages,
    isLoading,
    toggleChat,
    minimizeChat,
    sendMessage,
    retryMessage,
    clearHistory,
  } = useChat({ selectedCredential });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle click outside to close chat on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target as Node) &&
        window.innerWidth < 768
      ) {
        minimizeChat();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, minimizeChat]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const getToggleButtonTitle = () => {
    if (isOpen) return 'Minimize AI Assistant';
    if (isMinimized) return 'Open AI Assistant';
    return 'Open AI Assistant';
  };

  const getToggleButtonIcon = () => {
    if (isOpen) return 'bi-chevron-down';
    if (isMinimized) return 'bi-chevron-up';
    return 'bi-chat-dots';
  };

  return (
    <div className={`chat-widget ${className}`} {...props}>
      {/* Chat Window */}
      {isOpen && (
        <div 
          ref={chatWindowRef}
          className="chat-window"
          role="dialog"
          aria-label="AI Assistant Chat"
          aria-modal="true"
        >
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between p-3 border-bottom bg-primary text-white">
            <div className="d-flex align-items-center">
              <i className="bi bi-robot me-2" aria-hidden="true"></i>
              <h3 className="h6 mb-0 fw-semibold">AI Assistant</h3>
              <span className="badge bg-success ms-2 small">
                <i className="bi bi-circle-fill" style={{ fontSize: '0.5rem' }} aria-hidden="true"></i>
                Online
              </span>
            </div>
            
            <div className="d-flex align-items-center gap-2">
              {messages.length > 0 && (
                <button
                  type="button"
                  className="btn btn-link text-white p-1"
                  onClick={clearHistory}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                >
                  <i className="bi bi-trash3" aria-hidden="true"></i>
                </button>
              )}
              
              <button
                type="button"
                className="btn btn-link text-white p-1"
                onClick={minimizeChat}
                title="Minimize chat"
                aria-label="Minimize chat window"
              >
                <i className="bi bi-dash-lg" aria-hidden="true"></i>
              </button>
              
              <button
                type="button"
                className="btn btn-link text-white p-1"
                onClick={toggleChat}
                title="Close chat"
                aria-label="Close chat window"
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div 
            className="flex-grow-1 overflow-auto p-3"
            style={{ height: '300px' }}
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-chat-heart display-4 mb-3"></i>
                <h4 className="h6">Welcome to your CI/CD Assistant!</h4>
                <p className="small mb-0">
                  I can help you with pipelines, builds, debugging, and DevOps best practices.
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {messages.map((message) => (
                  <ChatMessageComponent
                    key={message.id}
                    message={message}
                    onRetry={() => retryMessage(message.id)}
                  />
                ))}
                {isLoading && (
                  <div className="d-flex align-items-center text-muted">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">AI is typing...</span>
                    </div>
                    <span className="small">AI is thinking...</span>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-top">
            <ChatInput
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              placeholder="Ask about CI/CD, builds, or DevOps..."
            />
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        type="button"
        className="chat-toggle"
        onClick={toggleChat}
        title={getToggleButtonTitle()}
        aria-label={getToggleButtonTitle()}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'chat-window' : undefined}
      >
        <i className={getToggleButtonIcon()} aria-hidden="true"></i>
        
        {/* Notification Badge */}
        {isMinimized && (
          <span 
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style={{ fontSize: '0.6rem' }}
          >
            1
            <span className="visually-hidden">unread message</span>
          </span>
        )}
      </button>
    </div>
  );
};