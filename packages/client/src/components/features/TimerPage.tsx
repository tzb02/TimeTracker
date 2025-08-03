import React, { useState } from 'react';
import { TimerWidget } from './TimerWidget';
import { ProjectSelector } from './ProjectSelector';
import { TimerDescription } from './TimerDescription';
import { ProjectManagement } from './ProjectManagement';

interface TimerPageProps {
  className?: string;
}

export const TimerPage: React.FC<TimerPageProps> = ({ className = '' }) => {
  const [showProjectManagement, setShowProjectManagement] = useState(false);

  return (
    <div className={`max-w-md mx-auto space-y-4 ${className}`}>
      {/* Project Selection */}
      <ProjectSelector 
        onManageProjects={() => setShowProjectManagement(true)}
      />
      
      {/* Description Input */}
      <TimerDescription />
      
      {/* Main Timer Widget */}
      <TimerWidget />
      
      {/* Instructions for iframe usage */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>Optimized for iframe embedding in GoHighLevel</p>
        <p>Minimum recommended size: 400px × 300px</p>
      </div>

      {/* Project Management Modal */}
      <ProjectManagement
        isOpen={showProjectManagement}
        onClose={() => setShowProjectManagement(false)}
      />
    </div>
  );
};