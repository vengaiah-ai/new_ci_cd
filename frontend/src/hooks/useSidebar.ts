import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  const location = useLocation();
  const activeRoute = location.pathname;

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setShowMobileSidebar(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    if (isMobile) {
      setShowMobileSidebar(!showMobileSidebar);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeMobileSidebar = () => {
    if (isMobile) {
      setShowMobileSidebar(false);
    }
  };

  return {
    isCollapsed,
    isMobile,
    showMobileSidebar,
    activeRoute,
    toggleSidebar,
    closeMobileSidebar,
    setIsCollapsed,
  };
};