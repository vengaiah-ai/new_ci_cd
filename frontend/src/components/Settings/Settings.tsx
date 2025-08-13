import React, { useState } from 'react';
import { UserSettings, BaseComponentProps } from '../../types';

interface SettingsProps extends BaseComponentProps {
  settings: UserSettings;
  onUpdateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  onResetSettings: () => void;
  isLoading?: boolean;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  isLoading = false,
  className = '',
  ...props
}) => {
  const [activeTab, setActiveTab] = useState('notifications');
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (category: keyof UserSettings, key: string, value: any) => {
    const newSettings = {
      ...localSettings,
      [category]: {
        ...localSettings[category],
        [key]: value,
      },
    };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await onUpdateSettings(localSettings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default values?')) {
      onResetSettings();
      setHasChanges(false);
    }
  };

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: 'bi-bell' },
    { id: 'builds', label: 'Build Preferences', icon: 'bi-gear' },
    { id: 'integrations', label: 'Integrations', icon: 'bi-plugin' },
    { id: 'security', label: 'Security', icon: 'bi-shield-check' },
  ];

  return (
    <div className={`card shadow-sm ${className}`} {...props}>
      <div className="card-header bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="card-title h5 mb-0">
            <i className="bi bi-gear me-2" aria-hidden="true"></i>
            Settings
          </h2>
          
          {hasChanges && (
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setLocalSettings(settings);
                  setHasChanges(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check me-2" aria-hidden="true"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card-body p-0">
        <div className="row g-0">
          {/* Sidebar Tabs */}
          <div className="col-md-3 border-end">
            <nav className="nav nav-pills flex-column p-3" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-link text-start ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                >
                  <i className={`${tab.icon} me-2`} aria-hidden="true"></i>
                  {tab.label}
                </button>
              ))}
              
              <hr className="my-3" />
              
              <button
                type="button"
                className="nav-link text-start text-danger"
                onClick={handleReset}
                disabled={isLoading}
              >
                <i className="bi bi-arrow-clockwise me-2" aria-hidden="true"></i>
                Reset to Defaults
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="col-md-9">
            <div className="p-4">
              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div id="notifications-panel" role="tabpanel" aria-labelledby="notifications-tab">
                  <h3 className="h5 mb-4">Notification Preferences</h3>
                  
                  <div className="mb-4">
                    <h4 className="h6 mb-3">Build Events</h4>
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        id="build-success"
                        className="form-check-input"
                        checked={localSettings.notifications.buildSuccess}
                        onChange={(e) => handleSettingChange('notifications', 'buildSuccess', e.target.checked)}
                      />
                      <label htmlFor="build-success" className="form-check-label">
                        Notify when builds succeed
                      </label>
                    </div>
                    
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        id="build-failure"
                        className="form-check-input"
                        checked={localSettings.notifications.buildFailure}
                        onChange={(e) => handleSettingChange('notifications', 'buildFailure', e.target.checked)}
                      />
                      <label htmlFor="build-failure" className="form-check-label">
                        Notify when builds fail
                      </label>
                    </div>
                    
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        id="build-started"
                        className="form-check-input"
                        checked={localSettings.notifications.buildStarted}
                        onChange={(e) => handleSettingChange('notifications', 'buildStarted', e.target.checked)}
                      />
                      <label htmlFor="build-started" className="form-check-label">
                        Notify when builds start
                      </label>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="h6 mb-3">Delivery Methods</h4>
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        id="email-notifications"
                        className="form-check-input"
                        checked={localSettings.notifications.emailNotifications}
                        onChange={(e) => handleSettingChange('notifications', 'emailNotifications', e.target.checked)}
                      />
                      <label htmlFor="email-notifications" className="form-check-label">
                        Email notifications
                      </label>
                    </div>
                    
                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        id="slack-notifications"
                        className="form-check-input"
                        checked={localSettings.notifications.slackNotifications}
                        onChange={(e) => handleSettingChange('notifications', 'slackNotifications', e.target.checked)}
                      />
                      <label htmlFor="slack-notifications" className="form-check-label">
                        Slack notifications
                      </label>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="webhook-url" className="form-label">Webhook URL (optional)</label>
                    <input
                      type="url"
                      id="webhook-url"
                      className="form-control"
                      value={localSettings.notifications.webhookUrl || ''}
                      onChange={(e) => handleSettingChange('notifications', 'webhookUrl', e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                    />
                    <div className="form-text">Webhook URL for custom notification delivery</div>
                  </div>
                </div>
              )}

              {/* Build Preferences Tab */}
              {activeTab === 'builds' && (
                <div id="builds-panel" role="tabpanel" aria-labelledby="builds-tab">
                  <h3 className="h5 mb-4">Build Preferences</h3>
                  
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="default-branch" className="form-label">Default Branch</label>
                      <input
                        type="text"
                        id="default-branch"
                        className="form-control"
                        value={localSettings.buildPreferences.defaultBranch}
                        onChange={(e) => handleSettingChange('buildPreferences', 'defaultBranch', e.target.value)}
                        placeholder="main"
                      />
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <label htmlFor="parallel-builds" className="form-label">Parallel Builds</label>
                      <select
                        id="parallel-builds"
                        className="form-select"
                        value={localSettings.buildPreferences.parallelBuilds}
                        onChange={(e) => handleSettingChange('buildPreferences', 'parallelBuilds', Number(e.target.value))}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                      </select>
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <label htmlFor="build-timeout" className="form-label">Build Timeout (minutes)</label>
                      <input
                        type="number"
                        id="build-timeout"
                        className="form-control"
                        min="5"
                        max="120"
                        value={localSettings.buildPreferences.buildTimeout}
                        onChange={(e) => handleSettingChange('buildPreferences', 'buildTimeout', Number(e.target.value))}
                      />
                    </div>
                    
                    <div className="col-md-6 mb-3">
                      <label htmlFor="retain-logs" className="form-label">Retain Logs (days)</label>
                      <select
                        id="retain-logs"
                        className="form-select"
                        value={localSettings.buildPreferences.retainLogs}
                        onChange={(e) => handleSettingChange('buildPreferences', 'retainLogs', Number(e.target.value))}
                      >
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                        <option value={365}>1 year</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="auto-trigger"
                      className="form-check-input"
                      checked={localSettings.buildPreferences.autoTriggerBuilds}
                      onChange={(e) => handleSettingChange('buildPreferences', 'autoTriggerBuilds', e.target.checked)}
                    />
                    <label htmlFor="auto-trigger" className="form-check-label">
                      Auto-trigger builds on push
                    </label>
                    <div className="form-text">Automatically start builds when code is pushed to the repository</div>
                  </div>
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === 'integrations' && (
                <div id="integrations-panel" role="tabpanel" aria-labelledby="integrations-tab">
                  <h3 className="h5 mb-4">Connected Integrations</h3>
                  
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <h4 className="h6 mb-1">
                                <i className="bi bi-github me-2" aria-hidden="true"></i>
                                GitHub
                              </h4>
                              <small className="text-muted">Source code repository</small>
                            </div>
                            <div className="form-check form-switch">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id="github-toggle"
                                checked={localSettings.integrations.githubConnected}
                                onChange={(e) => handleSettingChange('integrations', 'githubConnected', e.target.checked)}
                              />
                              <label htmlFor="github-toggle" className="form-check-label">
                                <span className={`badge ${localSettings.integrations.githubConnected ? 'bg-success' : 'bg-secondary'}`}>
                                  {localSettings.integrations.githubConnected ? 'Connected' : 'Disconnected'}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <h4 className="h6 mb-1">
                                <i className="bi bi-gitlab me-2" aria-hidden="true"></i>
                                GitLab
                              </h4>
                              <small className="text-muted">Source code repository</small>
                            </div>
                            <div className="form-check form-switch">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id="gitlab-toggle"
                                checked={localSettings.integrations.gitlabConnected}
                                onChange={(e) => handleSettingChange('integrations', 'gitlabConnected', e.target.checked)}
                              />
                              <label htmlFor="gitlab-toggle" className="form-check-label">
                                <span className={`badge ${localSettings.integrations.gitlabConnected ? 'bg-success' : 'bg-secondary'}`}>
                                  {localSettings.integrations.gitlabConnected ? 'Connected' : 'Disconnected'}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <h4 className="h6 mb-1">
                                <i className="bi bi-slack me-2" aria-hidden="true"></i>
                                Slack
                              </h4>
                              <small className="text-muted">Team communication</small>
                            </div>
                            <div className="form-check form-switch">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id="slack-toggle"
                                checked={Boolean(localSettings.integrations.slackWebhook)}
                                onChange={(e) => handleSettingChange('integrations', 'slackWebhook', e.target.checked ? 'https://hooks.slack.com/services/...' : '')}
                              />
                              <label htmlFor="slack-toggle" className="form-check-label">
                                <span className={`badge ${localSettings.integrations.slackWebhook ? 'bg-success' : 'bg-secondary'}`}>
                                  {localSettings.integrations.slackWebhook ? 'Connected' : 'Disconnected'}
                                </span>
                              </label>
                            </div>
                          </div>
                          
                          {localSettings.integrations.slackWebhook && (
                            <div className="mt-3">
                              <input
                                type="url"
                                className="form-control form-control-sm"
                                placeholder="Slack webhook URL"
                                value={localSettings.integrations.slackWebhook}
                                onChange={(e) => handleSettingChange('integrations', 'slackWebhook', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div id="security-panel" role="tabpanel" aria-labelledby="security-tab">
                  <h3 className="h5 mb-4">Security Settings</h3>
                  
                  <div className="card border-warning mb-4">
                    <div className="card-body">
                      <h4 className="h6 text-warning mb-2">
                        <i className="bi bi-shield-exclamation me-2" aria-hidden="true"></i>
                        Two-Factor Authentication
                      </h4>
                      <p className="card-text mb-3">
                        Enhance your account security by enabling two-factor authentication.
                      </p>
                      <div className="form-check form-switch">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="2fa-toggle"
                          checked={localSettings.security.twoFactorEnabled}
                          onChange={(e) => handleSettingChange('security', 'twoFactorEnabled', e.target.checked)}
                        />
                        <label htmlFor="2fa-toggle" className="form-check-label fw-medium">
                          {localSettings.security.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label htmlFor="api-rotation" className="form-label">API Key Rotation (days)</label>
                      <select
                        id="api-rotation"
                        className="form-select"
                        value={localSettings.security.apiKeyRotationDays}
                        onChange={(e) => handleSettingChange('security', 'apiKeyRotationDays', Number(e.target.value))}
                      >
                        <option value={30}>30 days</option>
                        <option value={60}>60 days</option>
                        <option value={90}>90 days</option>
                        <option value={180}>180 days</option>
                        <option value={365}>1 year</option>
                      </select>
                      <div className="form-text">How often to rotate API keys automatically</div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="form-check form-switch mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="sso-toggle"
                        checked={localSettings.security.ssoEnabled}
                        onChange={(e) => handleSettingChange('security', 'ssoEnabled', e.target.checked)}
                      />
                      <label htmlFor="sso-toggle" className="form-check-label">
                        Single Sign-On (SSO)
                      </label>
                      <div className="form-text">Enable SAML/OAuth-based authentication</div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="ip-whitelist" className="form-label">IP Whitelist</label>
                    <textarea
                      id="ip-whitelist"
                      className="form-control"
                      rows={4}
                      value={localSettings.security.ipWhitelist.join('\n')}
                      onChange={(e) => handleSettingChange('security', 'ipWhitelist', e.target.value.split('\n').filter(ip => ip.trim()))}
                      placeholder="192.168.1.0/24&#10;10.0.0.0/8&#10;203.0.113.0/24"
                    />
                    <div className="form-text">Enter IP addresses or ranges (one per line) that can access your builds</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};