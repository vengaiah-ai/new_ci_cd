import React, { useEffect } from 'react';

interface ApiKeySetupProps {
  onApiKeySet: (apiKey: string) => void;
}

const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onApiKeySet }) => {
  useEffect(() => {
    // The API key is now handled by the backend via a .env file.
    // We can immediately "set" the key on the frontend to unlock the chat UI.
    // A dummy value is used as the key itself is not needed in the frontend.
    onApiKeySet('backend-configured-key');
  }, [onApiKeySet]);

  // This component no longer needs to render anything, as it just enables the parent component.
  return null;
};