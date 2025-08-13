import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useSidebar } from '../../hooks/useSidebar';
import { BreadcrumbItem, ActionButton, BaseComponentProps } from '../../types';

interface LayoutProps extends BaseComponentProps {
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ActionButton[];
  fullHeight?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  breadcrumbs,
  actions,
  fullHeight = false,
  className = '',
  ...props
}) => {
  const {
    isCollapsed,
    isMobile,
    showMobileSidebar,
    activeRoute,
    toggleSidebar,
    closeMobileSidebar,
  } = useSidebar();

  const mainMarginLeft = isMobile ? '0' : isCollapsed ? '4rem' : '16rem';
  const mainMinHeight = fullHeight ? '100vh' : 'calc(100vh - 60px)';

  return (
    <div className="d-flex min-vh-100" {...props}>
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        isMobile={isMobile}
        showMobileSidebar={showMobileSidebar}
        activeRoute={activeRoute}
        onToggle={toggleSidebar}
        onMobileClose={closeMobileSidebar}
      />

      {/* Main Content */}
      <main 
        className={`main-content flex-grow-1 ${className}`}
        style={{ 
          marginLeft: mainMarginLeft,
          minHeight: mainMinHeight,
          transition: 'margin-left 0.3s ease-in-out',
        }}
        role="main"
      >
        {/* Header */}
        {(title || breadcrumbs || actions) && (
          <Header
            title={title}
            breadcrumbs={breadcrumbs}
            actions={actions}
            onSidebarToggle={toggleSidebar}
          />
        )}

        {/* Page Content */}
        <div className={fullHeight ? 'h-100' : 'p-4'}>
          {children}
        </div>
      </main>
    </div>
  );
};