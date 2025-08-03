import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Input } from '../ui/Input';

interface TimerDescriptionProps {
  className?: string;
}

export const TimerDescription: React.FC<TimerDescriptionProps> = ({ className = '' }) => {
  const { timer } = useAppStore();
  const [description, setDescription] = useState(timer.description || '');

  // Update local state when store changes
  useEffect(() => {
    setDescription(timer.description || '');
  }, [timer.description]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    
    // Update the timer state with the new description
    if (!timer.isRunning) {
      useAppStore.setState(state => ({
        timer: {
          ...state.timer,
          description: newDescription,
        }
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // This will trigger the timer start via the keyboard shortcut in TimerWidget
    }
  };

  return (
    <div className={className}>
      <Input
        label="Description (optional)"
        value={description}
        onChange={handleDescriptionChange}
        onKeyDown={handleKeyPress}
        disabled={timer.isRunning}
        placeholder="What are you working on?"
        className="text-sm"
      />
    </div>
  );
};