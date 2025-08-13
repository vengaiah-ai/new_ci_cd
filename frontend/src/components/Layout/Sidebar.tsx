import React from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarItem } from '../../types';

interface SidebarProps {
  isCollapsed: boolean;
  isMobile: boolean;
  showMobileSidebar: boolean;
  activeRoute: string;
  onToggle: () => void;
  onMobileClose: () => void;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: 'bi-diagram-3',
    route: '/',
    ariaLabel: 'Create and manage build pipelines',
  },
  {
    id: 'build-history',
    label: 'Build History',
    icon: 'bi-clock-history',
    route: '/builds',
    ariaLabel: 'View build history and logs',
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: 'bi-shield-lock',
    route: '/secrets',
    ariaLabel: 'Manage AWS credentials and other secrets',
  },
  {
    id: 'variables',
    label: 'Variables',
    icon: 'bi-terminal',
    route: '/variables',
    ariaLabel: 'Manage environment variables for pipelines',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'bi-gear',
    route: '/settings',
    ariaLabel: 'Configure application settings',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  isMobile,
  showMobileSidebar,
  activeRoute,
  onToggle,
  onMobileClose,
}) => {
  const sidebarClasses = [
    'sidebar',
    'position-fixed position-md-sticky',
    'd-flex flex-column',
    isCollapsed && !isMobile ? 'collapsed' : '',
    isMobile && showMobileSidebar ? 'show' : '',
  ].filter(Boolean).join(' ');

  const sidebarWidth = isMobile ? '280px' : isCollapsed ? '4rem' : '16rem';

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && showMobileSidebar && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1039 }}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <nav 
        className={sidebarClasses}
        style={{ width: sidebarWidth, zIndex: 1040 }}
        aria-label="Main navigation"
        role="navigation"
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
          {(!isCollapsed || isMobile) && (
            <h1 className="h5 mb-0 fw-bold text-primary">
              <i className="bi bi-layers me-2" aria-hidden="true"></i>
              CI/CD Builder
            </h1>
          )}
          
          <button
            type="button"
            className="sidebar-toggle d-md-none"
            onClick={onMobileClose}
            aria-label="Close sidebar"
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-grow-1 py-3">
          <ul className="nav nav-pills flex-column" role="menubar">
            {sidebarItems.map((item) => (
              <li key={item.id} className="nav-item" role="none">
                <NavLink
                  to={item.route}
                  className={({ isActive }) => 
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={isMobile ? onMobileClose : undefined}
                  aria-label={item.ariaLabel}
                  role="menuitem"
                  title={isCollapsed && !isMobile ? item.label : undefined}
                >
                  <i 
                    className={`${item.icon} me-2`} 
                    aria-hidden="true"
                  ></i>
                  {(!isCollapsed || isMobile) && (
                    <span className="nav-text">{item.label}</span>
                  )}
                  {item.badge && (
                    <span 
                      className="badge bg-danger ms-auto"
                      aria-label={`${item.badge} notifications`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-top p-3">
          {(!isCollapsed || isMobile) && (
            <div className="small text-muted text-center">
              <div>Build Service v2.1.0</div>
              <div className="mt-1">
                <a 
                  href="#" 
                  className="text-decoration-none text-muted"
                  aria-label="Documentation"
                >
                  <i className="bi bi-question-circle me-1" aria-hidden="true"></i>
                  Help
                </a>
              </div>
            </div>
          )}
          
          {isCollapsed && !isMobile && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-link text-muted p-0"
                aria-label="Help and documentation"
                title="Help"
              >
                <i className="bi bi-question-circle"></i>
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};