import React, { useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { BuildHistory } from '../components/Builds/BuildHistory';
import { Build, BuildFilters } from '../types';

// Mock data
const mockBuilds: Build[] = [
  {
    id: '1',
    repository: 'my-app',
    branch: 'main',
    commitSha: 'abc123def',
    status: 'success',
    startTime: new Date(2024, 0, 15, 10, 30),
    endTime: new Date(2024, 0, 15, 10, 35),
    duration: 300,
    author: 'john.doe',
    message: 'Fix authentication bug',
  },
  {
    id: '2',
    repository: 'api-service',
    branch: 'develop',
    commitSha: 'def456ghi',
    status: 'running',
    startTime: new Date(2024, 0, 15, 11, 0),
    author: 'jane.smith',
    message: 'Add new endpoints',
  },
];

const Builds: React.FC = () => {
  const [builds] = useState<Build[]>(mockBuilds);
  const [filters, setFilters] = useState<BuildFilters>({});

  const handleViewBuild = (buildId: string) => {
    console.log('View build:', buildId);
  };

  const handleRetryBuild = (buildId: string) => {
    console.log('Retry build:', buildId);
  };

  const handleCancelBuild = (buildId: string) => {
    console.log('Cancel build:', buildId);
  };

  return (
    <Layout title="Build History">
      <BuildHistory
        builds={builds}
        filters={filters}
        onFilterChange={setFilters}
        onViewBuild={handleViewBuild}
        onRetryBuild={handleRetryBuild}
        onCancelBuild={handleCancelBuild}
      />
    </Layout>
  );
};

export default Builds;