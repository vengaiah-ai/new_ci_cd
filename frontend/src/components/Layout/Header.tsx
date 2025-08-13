import React from 'react';
import { BreadcrumbItem, ActionButton } from '../../types';

interface HeaderProps {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ActionButton[];
  onSidebarToggle: () => void;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  breadcrumbs,
  actions,
  onSidebarToggle,
  className = '',
}) => {
  return (
    <header className={`bg-white border-bottom py-3 px-4 ${className}`}>
      <div className="d-flex align-items-center justify-content-between">
        {/* Left Section */}
        <div className="d-flex align-items-center">
          {/* Sidebar Toggle */}
          <button
            type="button"
            className="sidebar-toggle me-3"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar navigation"
          >
            <i className="bi bi-list" aria-hidden="true"></i>
          </button>

          {/* Breadcrumbs or Title */}
          <div>
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-0">
                  {breadcrumbs.map((crumb, index) => (
                    <li 
                      key={index}
                      className={`breadcrumb-item ${crumb.active ? 'active' : ''}`}
                      {...(crumb.active && { 'aria-current': 'page' })}
                    >
                      {crumb.href && !crumb.active ? (
                        <a 
                          href={crumb.href} 
                          className="text-decoration-none"
                        >
                          {crumb.label}
                        </a>
                      ) : (
                        crumb.label
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : title ? (
              <h1 className="h4 mb-0 fw-semibold">{title}</h1>
            ) : null}
          </div>
        </div>

        {/* Right Section - Actions */}
        {actions && actions.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            {actions.map((action, index) => (
              <button
                key={index}
                type="button"
                className={`btn btn-${action.variant || 'primary'} ${action.disabled ? 'disabled' : ''}`}
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.ariaLabel || action.label}
              >
                {action.icon && (
                  <i className={`${action.icon} me-1`} aria-hidden="true"></i>
                )}
                <span className="d-none d-sm-inline">{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};