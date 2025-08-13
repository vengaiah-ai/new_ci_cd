import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout/Layout';
import { PipelineForm } from '@/components/Pipeline/PipelineForm';
import { Button } from '@/components/ui/button';
import { PipelineFormData, AWSCredentialSet } from '@/types';
import { PlayCircle } from 'lucide-react';

interface PipelineProps {
  selectedCredential: string;
  setSelectedCredential: (name: string) => void;
}

const Pipeline: React.FC<PipelineProps> = ({ selectedCredential, setSelectedCredential }) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<PipelineFormData>({
    repositoryUrl: '',
    branch: 'main',
    commitSha: '',
    configurationPath: '',
    environment: 'dev',
    buildType: 'standard',
  });


  const handleRunPipeline = async (): Promise<void> => {
    console.log('handleRunPipeline called!');
    console.log('Form data:', formData);
    console.log('Selected credential:', selectedCredential);
    
    if (!formData.repositoryUrl) {
      console.log('Missing repository URL');
      toast.error('Please provide a repository URL');
      return;
    }
    if (!selectedCredential) {
      console.log('Missing AWS credential');
      toast.error('You must select an AWS credential set before running the pipeline.');
      return;
    }

    console.log('Starting build request...');
    setIsSubmitting(true);

    try {
      const requestUrl = `http://localhost:3001/api/builds?aws_credential_name=${encodeURIComponent(selectedCredential)}`;
      const requestBody = {
        repositoryUrl: formData.repositoryUrl,
        branch: formData.branch,
        commitSha: formData.commitSha,
        configurationPath: formData.configurationPath,
        environment: formData.environment,
        buildType: formData.buildType,
      };
      
      console.log('Making request to:', requestUrl);
      console.log('Request body:', requestBody);
      
      // Call the new builds API endpoint directly
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || error.message || 'Failed to start pipeline');
      }

      const responseData = await response.json();
      const buildId = responseData.build_id;
      
      // Redirect to the pipeline execution page
      navigate(`/pipelines/${buildId}`);
      toast.success('Pipeline started successfully!');
    } catch (error) {
      console.error('Error starting pipeline:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start pipeline';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: PipelineFormData) => {
    setFormData(data);
    // The actual submission is handled by the Run Pipeline button
    return Promise.resolve();
  };

  const handleFormChange = (data: PipelineFormData) => {
    setFormData(data);
  };

  return (
    <Layout title="Pipeline Configuration">
      <div className="space-y-6">
        <div className="max-w-3xl mx-auto bg-card p-6 rounded-lg shadow">
          <PipelineForm 
            onSubmit={handleFormSubmit}
            onChange={handleFormChange}
            onRunPipeline={handleRunPipeline}
            isLoading={isSubmitting}
            defaultValues={formData}
            className=""
          />
        </div>
      </div>
    </Layout>
  );
};

export default Pipeline;