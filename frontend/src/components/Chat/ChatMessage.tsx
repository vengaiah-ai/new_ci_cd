import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from '../../types';

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: () => void;
}

// Utility function to format time, robustly handling both Date objects and strings.
const formatTime = (dateInput: Date | string) => {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    // Return a fallback or empty string if the date is invalid
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry }) => {
  const isUser = message.role === 'user';
  const isError = message.error;

  // Create a single Date object from the timestamp to ensure type consistency.
  const timestampDate = new Date(message.timestamp);

  return (
    <div 
      className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}
      role="group"
      aria-label={`${isUser ? 'Your' : 'Assistant'} message at ${formatTime(timestampDate)}`}
    >
      <div 
        className={`d-flex gap-2 max-w-75 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
        style={{ maxWidth: '85%' }}
      >
        {/* Avatar */}
        <div 
          className={`d-flex align-items-end flex-shrink-0`}
          style={{ width: '32px', height: '32px' }}
        >
          <div 
            className={`rounded-circle d-flex align-items-center justify-content-center text-white ${
              isUser ? 'bg-primary' : 'bg-success'
            }`}
            style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}
            aria-hidden="true"
          >
            <i className={isUser ? 'bi-person' : 'bi-robot'}></i>
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex-grow-1`}>
          {/* Message Bubble */}
          <div 
            className={`px-3 py-2 rounded-3 ${
              isUser 
                ? 'bg-primary text-white' 
                : isError 
                ? 'bg-danger text-white'
                : 'bg-light text-dark border'
            }`}
            style={{ wordBreak: 'break-word' }}
          >
            {message.loading ? (
              <div className="d-flex align-items-center">
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <span>Generating response...</span>
              </div>
            ) : message.markdown && !isUser ? (
              <div className="markdown-content">
                <ReactMarkdown
                  components={{
                    // Custom components for better styling
                    code: ({ inline, ...props }: any) => (
                      inline ? (
                        <code 
                          className="bg-secondary bg-opacity-25 px-1 rounded"
                          style={{ fontSize: '0.875em' }}
                          {...props} 
                        />
                      ) : (
                        <pre className="bg-dark text-light p-2 rounded mt-2 mb-2 overflow-auto">
                          <code {...props} />
                        </pre>
                      )
                    ),
                    p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                    ul: ({ ...props }) => <ul className="mb-2 ps-3" {...props} />,
                    ol: ({ ...props }) => <ol className="mb-2 ps-3" {...props} />,
                    li: ({ ...props }) => <li className="mb-1" {...props} />,
                    h1: ({ ...props }) => <h1 className="h5 fw-bold mb-2" {...props} />,
                    h2: ({ ...props }) => <h2 className="h6 fw-bold mb-2" {...props} />,
                    h3: ({ ...props }) => <h3 className="fw-bold mb-2" {...props} />,
                    blockquote: ({ ...props }) => (
                      <blockquote className="border-start border-3 border-secondary ps-3 mb-2 fst-italic" {...props} />
                    ),
                    a: ({ ...props }) => (
                      <a 
                        className="text-decoration-none fw-medium" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        {...props} 
                      />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
            )}

            {/* Error Actions */}
            {isError && onRetry && (
              <div className="mt-2 pt-2 border-top border-light border-opacity-25">
                <button
                  type="button"
                  className="btn btn-link text-white p-0 small text-decoration-none"
                  onClick={onRetry}
                  aria-label="Retry sending this message"
                >
                  <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div 
            className={`small text-muted mt-1 ${isUser ? 'text-end' : 'text-start'}`}
            style={{ fontSize: '0.7rem' }}
          >
            <time dateTime={timestampDate.toISOString()}>
              {formatTime(timestampDate)}
            </time>
            {isError && (
              <span className="ms-1 text-danger" aria-label="Message failed">
                <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};