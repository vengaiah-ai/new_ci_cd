import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Terminal, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Download, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Types
type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

interface Stage {
  id: string;
  name: string;
  status: StageStatus;
  logs: string[];
  startTime?: string;
  endTime?: string;
  duration?: number;
  errorMessage?: string;
}

interface FailureAnalysis {
  rootCause: string;
  suggestedSolution: string;
  stage: string;
}

interface PipelineExecutionData {
  id: string;
  status: 'running' | 'success' | 'failed' | 'pending';
  stages: Stage[];
  createdAt: string;
  finishedAt?: string;
  repository: string;
  branch: string;
  commit: string;
  failureAnalysis?: FailureAnalysis;
}

// Enhanced mock data matching the provided images
const createMockPipelineData = (): PipelineExecutionData => {
  const now = Date.now();
  return {
    id: 'pipeline-123',
    status: 'failed',
    repository: 'pipelinepilot',
    branch: 'main',
    commit: 'a1b2c3d',
    createdAt: new Date(now - 60000).toISOString(),
    stages: [
      {
        id: 'checkout',
        name: 'Checkout',
        status: 'success',
        logs: [
          '6:50:25 PM [MCE Orchestrator] Dispatching job to Checkout Agent.',
          '6:50:30 PM [Checkout Agent] Cloning repository git@github.com/user/project-heroes.git...',
          '6:50:40 PM [Checkout Agent] Checking out branch "main"...',
          '6:50:45 PM [Checkout Agent] HEAD is now at a1b2c3d',
          '6:50:45 PM [MCE Orchestrator] Dispatching job to Scan Agent.'
        ],
        startTime: new Date(now - 50000).toISOString(),
        endTime: new Date(now - 45000).toISOString(),
        duration: 5
      },
      {
        id: 'scan',
        name: 'Scan',
        status: 'success',
        logs: [
          '6:50:45 PM [Scan Agent] Starting SonarQube scanner...',
          '6:50:48 PM [Scan Agent] Analyzing 1,456 files...',
          '6:50:50 PM [Scan Agent] Code scan complete. 0 vulnerabilities found.',
          '6:50:50 PM [MCE Orchestrator] Dispatching job to Test Agent.'
        ],
        startTime: new Date(now - 44000).toISOString(),
        endTime: new Date(now - 40000).toISOString(),
        duration: 4
      },
      {
        id: 'test',
        name: 'Test',
        status: 'success',
        logs: [
          '6:50:47 PM [Test Agent] Executing "npm test"...',
          '6:50:48 PM [Test Agent] PASS: ./tests/auth.test.js',
          '6:50:48 PM [Test Agent] PASS: ./tests/api.test.js',
          '6:50:50 PM [Test Agent] Test suite finished successfully.',
          '6:50:50 PM [MCE Orchestrator] Dispatching job to Test Agent.'
        ],
        startTime: new Date(now - 39000).toISOString(),
        endTime: new Date(now - 35000).toISOString(),
        duration: 4
      },
      {
        id: 'build',
        name: 'Build',
        status: 'failed',
        logs: [
          '6:50:50 PM [Build Agent] [Error] npm exited with code 1: undefined',
          '6:50:55 PM [Initiating Intelligent Failure Analysis...]',
          '6:50:55 PM [Error] npm exited with code 1: undefined'
        ],
        startTime: new Date(now - 34000).toISOString(),
        endTime: new Date(now - 30000).toISOString(),
        duration: 4,
        errorMessage: 'npm exited with code 1: undefined'
      },
      {
        id: 'push',
        name: 'Push',
        status: 'pending',
        logs: []
      },
      {
        id: 'deploy',
        name: 'Deploy',
        status: 'pending',
        logs: []
      }
    ],
    failureAnalysis: {
      rootCause: "The build failed during the 'npm install' step. The logs indicate a '404 Not Found' error when trying to fetch the 'left-pad' package from your private NPM repository. This typically means the package does not exist at the specified version, or there's a network configuration issue preventing access.",
      suggestedSolution: "1. Verify that the package 'left-pad@1.3.0' exists in your private Artifactory/Nexus.\n2. Check the '.npmrc' file in the repository to ensure the registry URL is correct.\n3. Confirm that the build agent has network access to the artifact repository.",
      stage: 'build'
    }
  };
};

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-yellow-100 text-yellow-800',
};

const PipelineExecution = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Simulate real-time data fetching with enhanced mock data
  const { data: pipeline, isLoading, refetch } = useQuery<PipelineExecutionData>({
    queryKey: ['pipeline', pipelineId],
    queryFn: async () => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/builds/${pipelineId}`);
      // if (!response.ok) throw new Error('Failed to fetch pipeline');
      // return response.json();
      return createMockPipelineData();
    },
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  // Initialize expanded stages
  useEffect(() => {
    if (pipeline) {
      const initialExpanded: Record<string, boolean> = {};
      pipeline.stages.forEach(stage => {
        initialExpanded[stage.id] = stage.status === 'running' || stage.status === 'failed';
      });
      setExpandedStages(initialExpanded);

      // Auto-select the first running or failed stage, or the first stage if none
      const runningOrFailedStage = pipeline.stages.find(s => 
        s.status === 'running' || s.status === 'failed'
      );
      setSelectedStage(runningOrFailedStage?.id || pipeline.stages[0]?.id || null);
    }
  }, [pipeline?.id]);

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const selectedStageData = pipeline?.stages.find(s => s.id === selectedStage);

  if (isLoading || !pipeline) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Logs</h1>
              <p className="text-gray-600 text-sm mt-1">
                {pipeline.repository} • {pipeline.branch} • {pipeline.commit}
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">



        {/* Pipeline Progress - Horizontal Stage Layout */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <div className="flex items-center justify-between space-x-4">
              {pipeline.stages.map((stage, index) => (
                <div key={stage.id} className="flex flex-col items-center space-y-2 flex-1">
                  <div 
                    className={cn(
                      'w-16 h-16 rounded-lg border-2 flex items-center justify-center text-white font-semibold text-sm cursor-pointer transition-all hover:scale-105',
                      stage.status === 'success' && 'bg-green-100 border-green-500 text-green-700',
                      stage.status === 'running' && 'bg-blue-100 border-blue-500 text-blue-700 animate-pulse',
                      stage.status === 'failed' && 'bg-red-100 border-red-500 text-red-700',
                      stage.status === 'pending' && 'bg-gray-100 border-gray-300 text-gray-500',
                      stage.status === 'skipped' && 'bg-yellow-100 border-yellow-500 text-yellow-700',
                      selectedStage === stage.id && 'ring-2 ring-blue-400 ring-offset-2'
                    )}
                    onClick={() => setSelectedStage(stage.id)}
                  >
                    {stage.status === 'success' && <CheckCircle2 className="h-6 w-6" />}
                    {stage.status === 'failed' && <XCircle className="h-6 w-6" />}
                    {stage.status === 'running' && <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />}
                    {stage.status === 'pending' && <Clock className="h-6 w-6" />}
                    {stage.status === 'skipped' && <AlertCircle className="h-6 w-6" />}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-sm text-gray-900">{stage.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stage.status === 'success' && 'Success'}
                      {stage.status === 'running' && 'Pending'}
                      {stage.status === 'failed' && 'Stopped'}
                      {stage.status === 'pending' && 'Pending'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Failure Analysis */}
        {pipeline.failureAnalysis && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Intelligent Failure Analysis</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-red-800">Root Cause Analysis</h4>
                  <p className="text-sm mt-1">
                    {pipeline.failureAnalysis.rootCause}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-red-800">Suggested Solution</h4>
                  <div className="text-sm mt-1">
                    {pipeline.failureAnalysis.suggestedSolution.split('\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-2">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Acknowledge
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Logs Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedStageData ? selectedStageData.name : 'Pipeline Logs'}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Terminal className="h-4 w-4 mr-2" />
                  Open in Terminal
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Logs
                </Button>
              </div>
            </div>
          </div>
          <div className="p-0">
            <ScrollArea className="h-96 p-4">
              <div className="font-mono text-sm space-y-1">
                {selectedStageData?.logs.length ? (
                  selectedStageData.logs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">
                      <span>{log}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    No logs available for this stage yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PipelineExecution;
