import React, { useState } from 'react';
import { Build, BuildFilters, BaseComponentProps } from '../../types';

interface BuildHistoryProps extends BaseComponentProps {
  builds: Build[];
  onViewBuild: (buildId: string) => void;
  onRetryBuild: (buildId: string) => void;
  onCancelBuild: (buildId: string) => void;
  filters?: BuildFilters;
  onFilterChange: (filters: BuildFilters) => void;
  isLoading?: boolean;
}

const getStatusIcon = (status: Build['status']) => {
  switch (status) {
    case 'pending': return 'bi-clock text-warning';
    case 'running': return 'bi-arrow-clockwise text-primary';
    case 'success': return 'bi-check-circle text-success';
    case 'failed': return 'bi-x-circle text-danger';
    case 'cancelled': return 'bi-dash-circle text-secondary';
    default: return 'bi-question-circle text-muted';
  }
};

const formatDuration = (duration?: number) => {
  if (!duration) return '-';
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const BuildHistory: React.FC<BuildHistoryProps> = ({
  builds,
  onViewBuild,
  onRetryBuild,
  onCancelBuild,
  filters = {},
  onFilterChange,
  isLoading = false,
  className = '',
  ...props
}) => {
  const [selectedBuilds, setSelectedBuilds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<keyof Build>('startTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: keyof Build) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const handleSelectBuild = (buildId: string) => {
    const newSelected = new Set(selectedBuilds);
    if (newSelected.has(buildId)) {
      newSelected.delete(buildId);
    } else {
      newSelected.add(buildId);
    }
    setSelectedBuilds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedBuilds.size === builds.length) {
      setSelectedBuilds(new Set());
    } else {
      setSelectedBuilds(new Set(builds.map(build => build.id)));
    }
  };

  const sortedBuilds = [...builds].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (aVal === undefined || bVal === undefined) return 0;
    
    let comparison = 0;
    if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className={`card shadow-sm ${className}`} {...props}>
      <div className="card-header bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="card-title h5 mb-0">
            <i className="bi bi-clock-history me-2" aria-hidden="true"></i>
            Build History
          </h2>
          
          {/* Filters */}
          <div className="d-flex gap-2">
            <select
              className="form-select form-select-sm"
              value={filters.status || ''}
              onChange={(e) => onFilterChange({ ...filters, status: e.target.value as Build['status'] || undefined })}
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Search repository..."
              value={filters.repository || ''}
              onChange={(e) => onFilterChange({ ...filters, repository: e.target.value || undefined })}
              aria-label="Search repositories"
              style={{ minWidth: '200px' }}
            />
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading builds...</span>
            </div>
            <div className="mt-2 text-muted">Loading build history...</div>
          </div>
        ) : builds.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-inbox display-4 text-muted mb-3"></i>
            <h3 className="h5 text-muted">No builds found</h3>
            <p className="text-muted mb-4">Start your first build to see it here.</p>
            <button className="btn btn-primary">
              <i className="bi bi-plus me-2"></i>
              Create Pipeline
            </button>
          </div>
        ) : (
          <>
            {/* Bulk Actions */}
            {selectedBuilds.size > 0 && (
              <div className="bg-light border-bottom px-3 py-2">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="small text-muted">
                    {selectedBuilds.size} build{selectedBuilds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="btn-group btn-group-sm">
                    <button className="btn btn-outline-danger" title="Cancel selected builds">
                      <i className="bi bi-stop"></i> Cancel
                    </button>
                    <button className="btn btn-outline-primary" title="Retry selected builds">
                      <i className="bi bi-arrow-clockwise"></i> Retry
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="table-responsive">
              <table className="table table-hover mb-0" role="table">
                <thead className="table-light">
                  <tr role="row">
                    <th scope="col" className="ps-3" style={{ width: '50px' }}>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="select-all"
                          checked={selectedBuilds.size === builds.length && builds.length > 0}
                          onChange={handleSelectAll}
                          aria-label="Select all builds"
                        />
                      </div>
                    </th>
                    
                    <th scope="col" style={{ width: '120px' }}>
                      <button
                        className="btn btn-link p-0 text-decoration-none fw-semibold"
                        onClick={() => handleSort('status')}
                        aria-label={`Sort by status ${sortColumn === 'status' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                      >
                        Status
                        {sortColumn === 'status' && (
                          <i className={`bi bi-chevron-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`} aria-hidden="true"></i>
                        )}
                      </button>
                    </th>
                    
                    <th scope="col">
                      <button
                        className="btn btn-link p-0 text-decoration-none fw-semibold"
                        onClick={() => handleSort('repository')}
                        aria-label={`Sort by repository ${sortColumn === 'repository' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                      >
                        Repository
                        {sortColumn === 'repository' && (
                          <i className={`bi bi-chevron-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`} aria-hidden="true"></i>
                        )}
                      </button>
                    </th>
                    
                    <th scope="col" style={{ width: '120px' }}>Branch</th>
                    
                    <th scope="col" style={{ width: '120px' }}>
                      <button
                        className="btn btn-link p-0 text-decoration-none fw-semibold"
                        onClick={() => handleSort('author')}
                        aria-label={`Sort by author ${sortColumn === 'author' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                      >
                        Author
                        {sortColumn === 'author' && (
                          <i className={`bi bi-chevron-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`} aria-hidden="true"></i>
                        )}
                      </button>
                    </th>
                    
                    <th scope="col" style={{ width: '140px' }}>
                      <button
                        className="btn btn-link p-0 text-decoration-none fw-semibold"
                        onClick={() => handleSort('startTime')}
                        aria-label={`Sort by start time ${sortColumn === 'startTime' ? (sortDirection === 'asc' ? 'descending' : 'ascending') : ''}`}
                      >
                        Started
                        {sortColumn === 'startTime' && (
                          <i className={`bi bi-chevron-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`} aria-hidden="true"></i>
                        )}
                      </button>
                    </th>
                    
                    <th scope="col" style={{ width: '100px' }}>Duration</th>
                    
                    <th scope="col" style={{ width: '120px' }} className="pe-3">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                
                <tbody>
                  {sortedBuilds.map((build) => (
                    <tr key={build.id} role="row">
                      <td className="ps-3">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`select-${build.id}`}
                            checked={selectedBuilds.has(build.id)}
                            onChange={() => handleSelectBuild(build.id)}
                            aria-label={`Select build ${build.id}`}
                          />
                        </div>
                      </td>
                      
                      <td>
                        <span className={`status-badge status-${build.status}`}>
                          <i className={getStatusIcon(build.status)} aria-hidden="true"></i>
                          <span className="ms-1 text-capitalize">{build.status}</span>
                        </span>
                      </td>
                      
                      <td>
                        <div>
                          <div className="fw-medium">{build.repository}</div>
                          {build.message && (
                            <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                              {build.message}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td>
                        <span className="badge bg-secondary">{build.branch}</span>
                      </td>
                      
                      <td>
                        <div className="small">{build.author}</div>
                      </td>
                      
                      <td>
                        <div className="small text-muted">
                          {formatDate(build.startTime)}
                        </div>
                      </td>
                      
                      <td>
                        <div className="small text-muted">
                          {formatDuration(build.duration)}
                        </div>
                      </td>
                      
                      <td className="pe-3">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => onViewBuild(build.id)}
                            title="View build details"
                            aria-label={`View details for build ${build.id}`}
                          >
                            <i className="bi bi-eye" aria-hidden="true"></i>
                          </button>
                          
                          {(build.status === 'failed' || build.status === 'cancelled') && (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => onRetryBuild(build.id)}
                              title="Retry build"
                              aria-label={`Retry build ${build.id}`}
                            >
                              <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                            </button>
                          )}
                          
                          {(build.status === 'pending' || build.status === 'running') && (
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => onCancelBuild(build.id)}
                              title="Cancel build"
                              aria-label={`Cancel build ${build.id}`}
                            >
                              <i className="bi bi-stop" aria-hidden="true"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="card-footer bg-white border-top">
              <div className="d-flex justify-content-between align-items-center">
                <div className="small text-muted">
                  Showing {builds.length} of {builds.length} builds
                </div>
                
                <nav aria-label="Build history pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className="page-item disabled">
                      <a className="page-link" href="#" tabIndex={-1} aria-disabled="true">
                        <i className="bi bi-chevron-left" aria-hidden="true"></i>
                        <span className="visually-hidden">Previous</span>
                      </a>
                    </li>
                    <li className="page-item active" aria-current="page">
                      <a className="page-link" href="#">1</a>
                    </li>
                    <li className="page-item disabled">
                      <a className="page-link" href="#" tabIndex={-1} aria-disabled="true">
                        <i className="bi bi-chevron-right" aria-hidden="true"></i>
                        <span className="visually-hidden">Next</span>
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};