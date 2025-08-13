import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatWidget } from "./components/Chat/ChatWidget";
import Pipeline from "./pages/Pipeline";
import Builds from "./pages/Builds";
import Secrets from "./pages/Secrets";
import Variables from "./pages/Variables";
import PipelineExecution from "./pages/PipelineExecution";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import { AWSCredentialSet } from './types';

const App = () => {
  const [selectedCredential, setSelectedCredential] = React.useState<string>('');

  React.useEffect(() => {
    const fetchAndSetDefaultCredential = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/aws-credentials');
        if (res.ok) {
          const creds: AWSCredentialSet[] = await res.json();
          if (creds && creds.length > 0 && !selectedCredential) {
            setSelectedCredential(creds[0].name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch initial credentials:", error);
      }
    };

    fetchAndSetDefaultCredential();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route 
              path="/" 
              element={
                <Pipeline 
                  selectedCredential={selectedCredential} 
                  setSelectedCredential={setSelectedCredential} 
                />
              } 
            />
            <Route path="/builds" element={<Builds />} />
            <Route path="/secrets" element={<Secrets selectedCredential={selectedCredential} setSelectedCredential={setSelectedCredential} />} />
            <Route path="/variables" element={<Variables />} />
            <Route path="/pipelines/:pipelineId" element={<PipelineExecution />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatWidget selectedCredential={selectedCredential} />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
