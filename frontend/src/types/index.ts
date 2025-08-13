// Core Types for CI/CD Build Service

export interface EnvironmentVariable {
  id?: string;
  key: string;
  value: string;
  type: 'system' | 'custom';
  description?: string;
  lastModified?: string;
  environment?: string;
  isSecret?: boolean;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface PipelineFormData {
  repositoryUrl: string;
  branch: string;
  commitSha?: string;
  configurationPath?: string;
  environment?: string;
  buildType?: 'standard' | 'custom';
}

export interface Build {
  id: string;
  repository: string;
  branch: string;
  commitSha: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  author: string;
  message?: string;
  logs?: string[];
}

export interface BuildFilters {
  status?: Build['status'];
  repository?: string;
  branch?: string;
  author?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface Secret {
  id: string;
  name: string;
  value: string;
  environment: string;
  isEncrypted: boolean;
  lastModified: Date;
  createdBy: string;
  description?: string;
}

export interface NotificationSettings {
  buildSuccess: boolean;
  buildFailure: boolean;
  buildStarted: boolean;
  emailNotifications: boolean;
  slackNotifications: boolean;
  webhookUrl?: string;
}

export interface BuildPreferences {
  defaultBranch: string;
  autoTriggerBuilds: boolean;
  parallelBuilds: number;
  buildTimeout: number; // minutes
  retainLogs: number; // days
}

export interface IntegrationSettings {
  githubConnected: boolean;
  gitlabConnected: boolean;
  bitbucketConnected: boolean;
  slackWebhook?: string;
  discordWebhook?: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  apiKeyRotationDays: number;
  ipWhitelist: string[];
  ssoEnabled: boolean;
}

export interface UserSettings {
  notifications: NotificationSettings;
  buildPreferences: BuildPreferences;
  integrations: IntegrationSettings;
  security: SecuritySettings;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  loading?: boolean;
  error?: boolean;
  markdown?: boolean;
}

export interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
}

export interface AppState {
  sidebar: {
    isCollapsed: boolean;
    activeRoute: string;
    isMobile: boolean;
  };
  chat: ChatState;
  builds: {
    builds: Build[];
    filters: BuildFilters;
    isLoading: boolean;
    error?: string;
  };
  settings: {
    userSettings: UserSettings;
    isLoading: boolean;
    error?: string;
  };
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

import { ReactNode } from 'react';

export interface ActionButton {
  label: string;
  icon?: string | ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
  onClick: () => void | Promise<void>;
  ariaLabel?: string;
  disabled?: boolean;
}

export interface AWSCredentialSet {
  id?: string;
  name: string;
  aws_access_key_id: string;
  aws_secret_access_key?: string; // Optional on read, required on write
  region: string;
  iam_role_arn?: string;
  description?: string;
  lastModified?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form Validation Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isValid: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Accessibility Types
export interface A11yProps {
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean;
  role?: string;
  tabIndex?: number;
}

// Component Props Base Types
export interface BaseComponentProps extends A11yProps {
  className?: string;
  id?: string;
  children?: React.ReactNode;
}