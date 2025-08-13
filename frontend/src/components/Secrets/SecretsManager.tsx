import React, { useState } from 'react';
import { Secret, BaseComponentProps } from '../../types';

interface SecretsManagerProps extends BaseComponentProps {
  secrets: Secret[];
  onAddSecret: (secret: Omit<Secret, 'id' | 'lastModified' | 'createdBy'>) => Promise<void>;
  onUpdateSecret: (id: string, secret: Partial<Secret>) => Promise<void>;
  onDeleteSecret: (id: string) => Promise<void>;
  isLoading?: boolean;
}

interface SecretFormData {
  name: string;
  value: string;
  environment: string;
  description: string;
}

const environments = ['development', 'staging', 'production', 'testing'];

export const SecretsManager: React.FC<SecretsManagerProps> = ({
  secrets,
  onAddSecret,
  onUpdateSecret,
  onDeleteSecret,
  isLoading = false,
  className = '',
  ...props
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<SecretFormData>({
    name: '',
    value: '',
    environment: 'development',
    description: '',
  });

  const filteredSecrets = secrets.filter(secret => {
    const matchesEnvironment = selectedEnvironment === 'all' || secret.environment === selectedEnvironment;
    const matchesSearch = secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         secret.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesEnvironment && matchesSearch;
  });

  const groupedSecrets = filteredSecrets.reduce((acc, secret) => {
    if (!acc[secret.environment]) {
      acc[secret.environment] = [];
    }
    acc[secret.environment].push(secret);
    return acc;
  }, {} as Record<string, Secret[]>);

  const toggleSecretVisibility = (secretId: string) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(secretId)) {
      newVisible.delete(secretId);
    } else {
      newVisible.add(secretId);
    }
    setVisibleSecrets(newVisible);
  };

  const handleAddSecret = async () => {
    try {
      await onAddSecret({
        name: formData.name,
        value: formData.value,
        environment: formData.environment,
        description: formData.description,
        isEncrypted: true,
      });
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to add secret:', error);
    }
  };

  const handleEditSecret = async () => {
    if (!editingSecret) return;
    
    try {
      await onUpdateSecret(editingSecret.id, {
        name: formData.name,
        value: formData.value,
        environment: formData.environment,
        description: formData.description,
      });
      setEditingSecret(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update secret:', error);
    }
  };

  const handleDeleteSecret = async (secretId: string) => {
    if (window.confirm('Are you sure you want to delete this secret? This action cannot be undone.')) {
      try {
        await onDeleteSecret(secretId);
      } catch (error) {
        console.error('Failed to delete secret:', error);
      }
    }
  };

  const startEdit = (secret: Secret) => {
    setEditingSecret(secret);
    setFormData({
      name: secret.name,
      value: secret.value,
      environment: secret.environment,
      description: secret.description || '',
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      value: '',
      environment: 'development',
      description: '',
    });
  };

  const maskSecret = (value: string) => {
    if (value.length <= 8) return '••••••••';
    return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
  };

  return (
    <div className={`card shadow-sm ${className}`} {...props}>
      <div className="card-header bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="card-title h5 mb-0">
            <i className="bi bi-shield-lock me-2" aria-hidden="true"></i>
            Environment Secrets
          </h2>
          
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            disabled={isLoading}
          >
            <i className="bi bi-plus me-2" aria-hidden="true"></i>
            Add Secret
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Filters */}
        <div className="row mb-4">
          <div className="col-md-6">
            <label htmlFor="environment-filter" className="form-label">Filter by Environment</label>
            <select
              id="environment-filter"
              className="form-select"
              value={selectedEnvironment}
              onChange={(e) => setSelectedEnvironment(e.target.value)}
            >
              <option value="all">All Environments</option>
              {environments.map(env => (
                <option key={env} value={env}>{env.charAt(0).toUpperCase() + env.slice(1)}</option>
              ))}
            </select>
          </div>
          
          <div className="col-md-6">
            <label htmlFor="search-secrets" className="form-label">Search Secrets</label>
            <input
              type="search"
              id="search-secrets"
              className="form-control"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Secrets List */}
        {isLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading secrets...</span>
            </div>
          </div>
        ) : Object.keys(groupedSecrets).length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-shield-x display-4 text-muted mb-3"></i>
            <h3 className="h5 text-muted">No secrets found</h3>
            <p className="text-muted">Add your first environment secret to get started.</p>
          </div>
        ) : (
          Object.entries(groupedSecrets).map(([environment, envSecrets]) => (
            <div key={environment} className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <h3 className="h6 mb-0 me-2">{environment.charAt(0).toUpperCase() + environment.slice(1)}</h3>
                <span className="badge bg-secondary">{envSecrets.length}</span>
              </div>
              
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Value</th>
                      <th scope="col">Description</th>
                      <th scope="col">Last Modified</th>
                      <th scope="col" style={{ width: '120px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envSecrets.map((secret) => (
                      <tr key={secret.id}>
                        <td>
                          <code className="text-primary">{secret.name}</code>
                          {secret.isEncrypted && (
                            <i className="bi bi-shield-check text-success ms-2" title="Encrypted" aria-label="Encrypted"></i>
                          )}
                        </td>
                        
                        <td>
                          <div className="d-flex align-items-center">
                            <code className="text-muted">
                              {visibleSecrets.has(secret.id) ? secret.value : maskSecret(secret.value)}
                            </code>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-1 ms-2"
                              onClick={() => toggleSecretVisibility(secret.id)}
                              title={visibleSecrets.has(secret.id) ? 'Hide value' : 'Show value'}
                              aria-label={visibleSecrets.has(secret.id) ? 'Hide secret value' : 'Show secret value'}
                            >
                              <i className={`bi ${visibleSecrets.has(secret.id) ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true"></i>
                            </button>
                          </div>
                        </td>
                        
                        <td>
                          <span className="text-muted">{secret.description || '—'}</span>
                        </td>
                        
                        <td>
                          <div className="small text-muted">
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(secret.lastModified)}
                            <div className="smaller">by {secret.createdBy}</div>
                          </div>
                        </td>
                        
                        <td>
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => startEdit(secret)}
                              title="Edit secret"
                              aria-label={`Edit secret ${secret.name}`}
                            >
                              <i className="bi bi-pencil" aria-hidden="true"></i>
                            </button>
                            
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => handleDeleteSecret(secret.id)}
                              title="Delete secret"
                              aria-label={`Delete secret ${secret.name}`}
                            >
                              <i className="bi bi-trash" aria-hidden="true"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingSecret) && (
        <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-labelledby="secret-modal-title">
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title" id="secret-modal-title">
                  {editingSecret ? 'Edit Secret' : 'Add New Secret'}
                </h4>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSecret(null);
                    resetForm();
                  }}
                  aria-label="Close"
                ></button>
              </div>
              
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label htmlFor="secret-name" className="form-label">Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      id="secret-name"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="SECRET_NAME"
                      required
                    />
                    <div className="form-text">Use uppercase with underscores (e.g., API_KEY, DATABASE_URL)</div>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="secret-value" className="form-label">Value <span className="text-danger">*</span></label>
                    <textarea
                      id="secret-value"
                      className="form-control"
                      rows={3}
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="Enter the secret value"
                      required
                    />
                    <div className="form-text">This value will be encrypted and stored securely</div>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="secret-environment" className="form-label">Environment <span className="text-danger">*</span></label>
                    <select
                      id="secret-environment"
                      className="form-select"
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      required
                    >
                      {environments.map(env => (
                        <option key={env} value={env}>{env.charAt(0).toUpperCase() + env.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="secret-description" className="form-label">Description</label>
                    <input
                      type="text"
                      id="secret-description"
                      className="form-control"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this secret"
                    />
                  </div>
                </form>
              </div>
              
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSecret(null);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={editingSecret ? handleEditSecret : handleAddSecret}
                  disabled={!formData.name || !formData.value}
                >
                  <i className="bi bi-check me-2" aria-hidden="true"></i>
                  {editingSecret ? 'Update Secret' : 'Add Secret'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Backdrop */}
      {(showAddModal || editingSecret) && (
        <div className="modal-backdrop fade show"></div>
      )}
    </div>
  );
};