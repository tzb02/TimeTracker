import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type AuthMode = 'login' | 'register';

interface AuthPageProps {
  initialMode?: AuthMode;
  className?: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  className = '',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${className}`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {mode === 'login' ? (
            <LoginForm
              onSwitchToRegister={() => setMode('register')}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={() => setMode('login')}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Web Time Tracker - Secure time tracking for teams
        </p>
      </div>
    </div>
  );
};