import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout/Layout';
import { AWSCredentialSet } from '../types';

// --- API Fetcher Functions ---
const fetchCredentials = async (): Promise<AWSCredentialSet[]> => {
  const response = await fetch('http://localhost:3001/api/aws-credentials');
  if (!response.ok) throw new Error('Failed to fetch credentials');
  return response.json();
};

const createCredential = async (credential: AWSCredentialSet): Promise<AWSCredentialSet> => {
  const response = await fetch('http://localhost:3001/api/aws-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credential),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create credential');
  }
  return response.json();
};

const deleteCredential = async (name: string): Promise<void> => {
  const response = await fetch(`http://localhost:3001/api/aws-credentials/${name}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete credential');
  }
};

// --- Zod Validation Schema ---
const credentialSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  aws_access_key_id: z.string().min(16, 'Access Key ID seems too short'),
  aws_secret_access_key: z.string().min(30, 'Secret Access Key seems too short'),
  region: z.string().min(2, 'Region is required'),
  iam_role_arn: z.string().optional(),
  description: z.string().optional(),
});

// --- Component ---
interface SecretsProps {
  selectedCredential: string | null;
  setSelectedCredential: (name: string) => void;
}

const Secrets: React.FC<SecretsProps> = ({ selectedCredential, setSelectedCredential }) => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: credentials, isLoading, error } = useQuery<AWSCredentialSet[]>({
    queryKey: ['awsCredentials'],
    queryFn: fetchCredentials,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AWSCredentialSet>({
    resolver: zodResolver(credentialSchema),
  });

  const createMutation = useMutation({
    mutationFn: createCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awsCredentials'] });
      reset();
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awsCredentials'] });
    },
  });

  const onSubmit = (data: AWSCredentialSet) => {
    createMutation.mutate(data);
  };

  const handleDelete = (name: string) => {
    if (window.confirm(`Are you sure you want to delete the credential set '${name}'?`)) {
      deleteMutation.mutate(name);
    }
  };

  return (
    <Layout title="Secrets Management">
      <div className="container-fluid">
        {!showForm && (
          <button className="btn btn-primary mb-3" onClick={() => setShowForm(true)}>
            <i className="bi bi-plus-circle me-2"></i>Add Credential
          </button>
        )}

        {showForm && (
          <div className="card mb-4">
            <div className="card-header">Add New AWS Credential Set</div>
            <div className="card-body">
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Form fields ... */}
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label htmlFor="name" className="form-label">Credential Name</label>
                    <input {...register('name')} id="name" className={`form-control ${errors.name ? 'is-invalid' : ''}`} />
                    {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label htmlFor="region" className="form-label">AWS Region</label>
                    <input {...register('region')} id="region" className={`form-control ${errors.region ? 'is-invalid' : ''}`} />
                    {errors.region && <div className="invalid-feedback">{errors.region.message}</div>}
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="aws_access_key_id" className="form-label">AWS Access Key ID</label>
                  <input {...register('aws_access_key_id')} id="aws_access_key_id" className={`form-control ${errors.aws_access_key_id ? 'is-invalid' : ''}`} />
                  {errors.aws_access_key_id && <div className="invalid-feedback">{errors.aws_access_key_id.message}</div>}
                </div>
                <div className="mb-3">
                  <label htmlFor="aws_secret_access_key" className="form-label">AWS Secret Access Key</label>
                  <input type="password" {...register('aws_secret_access_key')} id="aws_secret_access_key" className={`form-control ${errors.aws_secret_access_key ? 'is-invalid' : ''}`} />
                  {errors.aws_secret_access_key && <div className="invalid-feedback">{errors.aws_secret_access_key.message}</div>}
                </div>
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">Description (Optional)</label>
                  <textarea {...register('description')} id="description" className="form-control" rows={2}></textarea>
                </div>
                <div className="d-flex justify-content-end">
                  <button type="button" className="btn btn-secondary me-2" onClick={() => { setShowForm(false); reset(); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}> {createMutation.isPending ? 'Saving...' : 'Save Credential'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">Stored AWS Credentials</div>
          <div className="card-body">
            {isLoading && <p>Loading credentials...</p>}
            {error && <div className="alert alert-danger">Error: {error.message}</div>}
            
            {credentials && credentials.length > 0 ? (
              <>
                <div className="mb-4">
                    <label htmlFor="aws-credential-select" className="form-label fw-bold">Select Active AWS Credential Set</label>
                    <select 
                      id="aws-credential-select" 
                      className="form-select"
                      value={selectedCredential || ''}
                      onChange={(e) => setSelectedCredential(e.target.value)}
                    >
                      <option value="">Select a credential...</option>
                      {credentials.map(cred => (
                        <option key={cred.name} value={cred.name}>
                          {cred.name} ({cred.region})
                        </option>
                      ))}
                    </select>
                    <div className="form-text">This credential will be used for all pipeline operations.</div>
                </div>

                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Region</th>
                      <th>Description</th>
                      <th>Last Modified</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(cred => (
                      <tr key={cred.id}>
                        <td>{cred.name}</td>
                        <td>{cred.region}</td>
                        <td>{cred.description || '-' }</td>
                        <td>{new Date(cred.lastModified!).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cred.name)} disabled={deleteMutation.isPending}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              !isLoading && <p>No AWS credentials have been configured.</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Secrets;
