import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout/Layout';

// Define the types for our build data
interface Stage {
  name: string;
  status: 'running' | 'success' | 'failed' | 'pending';
  startTime: string;
  endTime?: string;
  logs: string;
}

interface Build {
  id: string;
  status: 'running' | 'success' | 'failed';
  stages: Stage[];
  message?: string;
}

// API function to fetch build details
const fetchBuild = async (buildId: string): Promise<Build> => {
  const response = await fetch(`http://localhost:3001/api/builds/${buildId}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const getStatusColor = (status: Stage['status']) => {
  switch (status) {
    case 'success':
      return 'bg-success';
    case 'failed':
      return 'bg-danger';
    case 'running':
      return 'bg-primary';
    default:
      return 'bg-secondary';
  }
};

const getStatusIcon = (status: Stage['status']) => {
  switch (status) {
    case 'success':
      return 'bi-check-circle-fill';
    case 'failed':
      return 'bi-x-circle-fill';
    case 'running':
      return 'bi-arrow-clockwise';
    default:
      return 'bi-circle';
  }
};

const PipelineExecution: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();

  const { data: build, error, isLoading } = useQuery<Build, Error>({
    queryKey: ['build', pipelineId],
    queryFn: () => fetchBuild(pipelineId!),
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: !!pipelineId, // Only run query if pipelineId is present
  });

  if (isLoading) {
    return (
      <Layout title="Pipeline Execution">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p>Loading pipeline status...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Pipeline Execution">
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Error loading pipeline: {error.message}
        </div>
      </Layout>
    );
  }

  if (!build) {
    return (
      <Layout title="Pipeline Execution">
        <div className="alert alert-warning" role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          No build data found for pipeline ID: {pipelineId}
        </div>
      </Layout>
    );
  }

  const llmAnalysisStage = build.stages.find(stage => stage.name === 'Failure Analysis');

  return (
    <Layout title={`Pipeline: ${build.id}`}>
      <div className="container-fluid">
        {/* Pipeline Header */}
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h4 className="mb-0">
              <i className="bi bi-gear-fill me-2"></i>
              Pipeline Run: {build.id}
            </h4>
            <span className={`badge ${getStatusColor(build.status)} text-white px-3 py-2`}>
              <i className={`bi ${getStatusIcon(build.status)} me-1`}></i>
              {build.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {build.status === 'failed' && build.message && (
          <div className="alert alert-danger mb-4" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Pipeline Failed:</strong> {build.message}
          </div>
        )}

        {/* LLM Failure Analysis */}
        {llmAnalysisStage && llmAnalysisStage.status === 'success' && (
          <div className="alert alert-info mb-4" role="alert">
            <i className="bi bi-robot me-2"></i>
            <strong>🤖 Intelligent Failure Analysis</strong>
            <hr />
            <div className="mt-2">
              <pre className="bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {llmAnalysisStage.logs}
              </pre>
            </div>
          </div>
        )}

        {/* Pipeline Stages */}
        <div className="row">
          <div className="col-12">
            <h5 className="mb-3">
              <i className="bi bi-list-task me-2"></i>
              Pipeline Stages
            </h5>
            <div className="d-flex overflow-auto pb-3" style={{ gap: '1rem' }}>
              {build.stages.filter(s => s.name !== 'Failure Analysis').map((stage, index) => (
                <div key={index} className="card flex-shrink-0" style={{ minWidth: '300px', maxWidth: '400px' }}>
                  <div className="card-header">
                    <h6 className="card-title mb-0 d-flex align-items-center">
                      <span className={`badge ${getStatusColor(stage.status)} me-2`} style={{ width: '12px', height: '12px', borderRadius: '50%' }}></span>
                      <i className={`bi ${getStatusIcon(stage.status)} me-2`}></i>
                      {stage.name}
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="bg-dark text-light p-2 rounded" style={{ height: '200px', overflow: 'auto', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      <pre className="mb-0 text-light">{stage.logs || 'No logs yet...'}</pre>
                    </div>
                    {stage.startTime && (
                      <small className="text-muted mt-2 d-block">
                        Started: {new Date(stage.startTime).toLocaleString()}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PipelineExecution;
