import React, { useState } from 'react';
import { PipelineFormData, ValidationError, BaseComponentProps } from '../../types';

interface PipelineFormProps extends BaseComponentProps {
  onSubmit: (data: PipelineFormData) => Promise<void>;
  onChange?: (data: PipelineFormData) => void;
  onRunPipeline?: () => void;
  isLoading?: boolean;
  defaultValues?: Partial<PipelineFormData>;
}

const commonBranches = ['main', 'master', 'develop', 'staging', 'production'];
const buildTypes = [
  { value: 'standard', label: 'Standard Build', description: 'Default CI/CD pipeline' },
  { value: 'custom', label: 'Custom Build', description: 'Custom configuration file' },
];

export const PipelineForm: React.FC<PipelineFormProps> = ({
  onSubmit,
  onChange,
  onRunPipeline,
  isLoading = false,
  defaultValues = {},
  className = '',
  ...props
}) => {
  const [formData, setFormData] = useState<PipelineFormData>({
    repositoryUrl: defaultValues.repositoryUrl || '',
    branch: defaultValues.branch || 'main',
    commitSha: defaultValues.commitSha || '',
    configurationPath: defaultValues.configurationPath || '',
    environment: defaultValues.environment || 'development',
    buildType: defaultValues.buildType || 'standard',
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): ValidationError[] => {
    const newErrors: ValidationError[] = [];

    // Repository URL validation
    if (!formData.repositoryUrl.trim()) {
      newErrors.push({ field: 'repositoryUrl', message: 'Repository URL is required' });
    } else {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(formData.repositoryUrl)) {
        newErrors.push({ field: 'repositoryUrl', message: 'Please enter a valid HTTP/HTTPS URL' });
      }
    }

    // Branch validation
    if (!formData.branch.trim()) {
      newErrors.push({ field: 'branch', message: 'Branch is required' });
    }

    // Commit SHA validation (optional but if provided, should be valid)
    if (formData.commitSha && !/^[a-f0-9]{6,40}$/i.test(formData.commitSha)) {
      newErrors.push({ field: 'commitSha', message: 'Invalid commit SHA format' });
    }

    // Configuration path validation for custom builds
    if (formData.buildType === 'custom' && !formData.configurationPath?.trim()) {
      newErrors.push({ field: 'configurationPath', message: 'Configuration path is required for custom builds' });
    }

    return newErrors;
  };

  const handleInputChange = (field: keyof PipelineFormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Clear field-specific errors
    setErrors(prev => prev.filter(error => error.field !== field));
    
    // Call onChange callback for real-time updates
    if (onChange) {
      onChange(newFormData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      // Focus on first error field
      const firstErrorField = document.querySelector(`[name="${validationErrors[0].field}"]`) as HTMLElement;
      firstErrorField?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Pipeline submission error:', error);
      setErrors([{ field: 'general', message: 'Failed to start pipeline. Please try again.' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (field: string) => errors.find(error => error.field === field)?.message;
  const hasFieldError = (field: string) => Boolean(getFieldError(field));

  return (
    <div className={`card shadow-sm ${className} relative`} {...props}>
      <div className="card-header bg-primary text-white relative">
        <h2 className="card-title h5 mb-0">
          <i className="bi bi-play-circle me-2" aria-hidden="true"></i>
          Create Build Pipeline
        </h2>

      </div>

      <div className="card-body">
        {/* General Error Alert */}
        {getFieldError('general') && (
          <div className="alert alert-danger" role="alert">
            <i className="bi bi-exclamation-triangle me-2" aria-hidden="true"></i>
            {getFieldError('general')}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Repository URL */}
          <div className="mb-4">
            <label htmlFor="repositoryUrl" className="form-label fw-semibold">
              Repository URL <span className="text-danger">*</span>
            </label>
            <input
              type="url"
              id="repositoryUrl"
              name="repositoryUrl"
              className={`form-control ${hasFieldError('repositoryUrl') ? 'is-invalid' : ''}`}
              value={formData.repositoryUrl}
              onChange={(e) => handleInputChange('repositoryUrl', e.target.value)}
              placeholder="https://github.com/username/repository.git"
              required
              aria-describedby={hasFieldError('repositoryUrl') ? 'repositoryUrl-error' : 'repositoryUrl-help'}
              disabled={isSubmitting || isLoading}
            />
            <div id="repositoryUrl-help" className="form-text">
              Enter the full URL to your Git repository (GitHub, GitLab, Bitbucket, etc.)
            </div>
            {hasFieldError('repositoryUrl') && (
              <div id="repositoryUrl-error" className="invalid-feedback">
                {getFieldError('repositoryUrl')}
              </div>
            )}
          </div>

          {/* Branch Selection */}
          <div className="row mb-4">
            <div className="col-md-6">
              <label htmlFor="branch" className="form-label fw-semibold">
                Branch <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <select
                  id="branch"
                  name="branch"
                  className={`form-select ${hasFieldError('branch') ? 'is-invalid' : ''}`}
                  value={formData.branch}
                  onChange={(e) => handleInputChange('branch', e.target.value)}
                  required
                  aria-describedby={hasFieldError('branch') ? 'branch-error' : 'branch-help'}
                  disabled={isSubmitting || isLoading}
                >
                  <option value="">Select a branch</option>
                  {commonBranches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                  <option value="custom">Custom branch...</option>
                </select>
                {formData.branch === 'custom' && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter custom branch name"
                    onChange={(e) => handleInputChange('branch', e.target.value)}
                    aria-label="Custom branch name"
                    disabled={isSubmitting || isLoading}
                  />
                )}
              </div>
              <div id="branch-help" className="form-text">
                Select the branch to build from
              </div>
              {hasFieldError('branch') && (
                <div id="branch-error" className="invalid-feedback">
                  {getFieldError('branch')}
                </div>
              )}
            </div>

            <div className="col-md-6">
              <label htmlFor="environment" className="form-label fw-semibold">
                Environment
              </label>
              <select
                id="environment"
                name="environment"
                className="form-select"
                value={formData.environment}
                onChange={(e) => handleInputChange('environment', e.target.value)}
                aria-describedby="environment-help"
                disabled={isSubmitting || isLoading}
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <div id="environment-help" className="form-text">
                Target deployment environment
              </div>
            </div>
          </div>

          {/* Build Type */}
          <div className="mb-4">
            <fieldset>
              <legend className="form-label fw-semibold">Build Type</legend>
              <div className="row">
                {buildTypes.map(type => (
                  <div key={type.value} className="col-md-6 mb-3">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="form-check">
                          <input
                            type="radio"
                            id={`buildType-${type.value}`}
                            name="buildType"
                            className="form-check-input"
                            value={type.value}
                            checked={formData.buildType === type.value}
                            onChange={(e) => handleInputChange('buildType', e.target.value)}
                            disabled={isSubmitting || isLoading}
                          />
                          <label htmlFor={`buildType-${type.value}`} className="form-check-label">
                            <div className="fw-semibold">{type.label}</div>
                            <div className="small text-muted">{type.description}</div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Optional Fields */}
          <div className="card bg-light mb-4">
            <div className="card-header">
              <h3 className="card-title h6 mb-0">Optional Settings</h3>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="commitSha" className="form-label fw-semibold">
                    Specific Commit SHA
                  </label>
                  <input
                    type="text"
                    id="commitSha"
                    name="commitSha"
                    className={`form-control ${hasFieldError('commitSha') ? 'is-invalid' : ''}`}
                    value={formData.commitSha}
                    onChange={(e) => handleInputChange('commitSha', e.target.value)}
                    placeholder="e.g., abc123def456"
                    pattern="[a-fA-F0-9]{6,40}"
                    aria-describedby={hasFieldError('commitSha') ? 'commitSha-error' : 'commitSha-help'}
                    disabled={isSubmitting || isLoading}
                  />
                  <div id="commitSha-help" className="form-text">
                    Leave empty to use latest commit from selected branch
                  </div>
                  {hasFieldError('commitSha') && (
                    <div id="commitSha-error" className="invalid-feedback">
                      {getFieldError('commitSha')}
                    </div>
                  )}
                </div>

                <div className="col-md-6 mb-3">
                  <label htmlFor="configurationPath" className="form-label fw-semibold">
                    Configuration File Path
                    {formData.buildType === 'custom' && <span className="text-danger"> *</span>}
                  </label>
                  <input
                    type="text"
                    id="configurationPath"
                    name="configurationPath"
                    className={`form-control ${hasFieldError('configurationPath') ? 'is-invalid' : ''}`}
                    value={formData.configurationPath}
                    onChange={(e) => handleInputChange('configurationPath', e.target.value)}
                    placeholder=".github/workflows/build.yml"
                    aria-describedby={hasFieldError('configurationPath') ? 'configurationPath-error' : 'configurationPath-help'}
                    disabled={isSubmitting || isLoading}
                    required={formData.buildType === 'custom'}
                  />
                  <div id="configurationPath-help" className="form-text">
                    Path to your custom build configuration file
                  </div>
                  {hasFieldError('configurationPath') && (
                    <div id="configurationPath-error" className="invalid-feedback">
                      {getFieldError('configurationPath')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                console.log('Run Pipeline button clicked!');
                console.log('onRunPipeline function:', onRunPipeline);
                console.log('Form data:', formData);
                if (onRunPipeline) {
                  onRunPipeline();
                } else {
                  console.error('onRunPipeline function is not defined!');
                }
              }}
              disabled={isSubmitting || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Starting...
                </>
              ) : (
                <>
                  <i className="bi bi-play-circle-fill me-2"></i>
                  Run Pipeline
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};