import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

const quickSuggestions = [
  "How do I fix a failed build?",
  "Explain CI/CD best practices",
  "Help with Docker configuration",
  "Debug build timeout issues",
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  suggestions = quickSuggestions,
}) => {
  const [message, setMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(adjustTextareaHeight, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    
    if (trimmedMessage && !isLoading) {
      onSendMessage(trimmedMessage);
      setMessage('');
      setShowSuggestions(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter, new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const toggleSuggestions = () => {
    setShowSuggestions(!showSuggestions);
  };

  return (
    <div className="p-3">
      {/* Quick Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-3" role="region" aria-label="Quick suggestions">
          <div className="small text-muted mb-2 fw-medium">
            <i className="bi bi-lightbulb me-1" aria-hidden="true"></i>
            Quick suggestions:
          </div>
          <div className="d-flex flex-wrap gap-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => handleSuggestionClick(suggestion)}
                aria-label={`Use suggestion: ${suggestion}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="d-flex flex-column gap-2">
        <div className="input-group">
          {/* Suggestions Toggle */}
          <button
            type="button"
            className={`btn ${showSuggestions ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={toggleSuggestions}
            title={showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
            aria-label={showSuggestions ? 'Hide quick suggestions' : 'Show quick suggestions'}
            aria-expanded={showSuggestions}
            aria-controls="chat-suggestions"
          >
            <i className="bi bi-lightbulb" aria-hidden="true"></i>
          </button>

          {/* Message Input */}
          <textarea
            ref={textareaRef}
            className="form-control"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            style={{ 
              resize: 'none',
              minHeight: '38px',
              maxHeight: '120px',
            }}
            aria-label="Type your message"
            aria-describedby="send-help"
          />

          {/* Send Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!message.trim() || isLoading}
            aria-label="Send message"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Sending...</span>
              </div>
            ) : (
              <i className="bi bi-send" aria-hidden="true"></i>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div id="send-help" className="form-text small">
          <kbd>Enter</kbd> to send, <kbd>Shift</kbd>+<kbd>Enter</kbd> for new line
        </div>
      </form>
    </div>
  );
};