import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert } from '../../ui/Alert';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useAuth } from '../../../contexts/AuthContext';

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
  organizationId: z
    .string()
    .optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
  className?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchToLogin,
  className = '',
}) => {
  const { register: registerUser, isLoading, error, clearError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationId: '',
    },
  });

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      const { confirmPassword, ...registerData } = data;
      await registerUser({
        ...registerData,
        organizationId: registerData.organizationId || undefined,
      });
      reset();
    } catch (error) {
      // Error is handled by the auth context
      console.error('Registration error:', error);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    return { strength, label: labels[strength - 1] || '' };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Start tracking your time today
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('name')}
          type="text"
          label="Full name"
          placeholder="Enter your full name"
          error={errors.name?.message}
          disabled={isLoading || isSubmitting}
          autoComplete="name"
          autoFocus
        />

        <Input
          {...register('email')}
          type="email"
          label="Email address"
          placeholder="Enter your email"
          error={errors.email?.message}
          disabled={isLoading || isSubmitting}
          autoComplete="email"
        />

        <div>
          <Input
            {...register('password')}
            type="password"
            label="Password"
            placeholder="Create a password"
            error={errors.password?.message}
            disabled={isLoading || isSubmitting}
            autoComplete="new-password"
          />
          {password && (
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      passwordStrength.strength <= 1
                        ? 'bg-red-500'
                        : passwordStrength.strength <= 2
                        ? 'bg-yellow-500'
                        : passwordStrength.strength <= 3
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600">
                  {passwordStrength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        <Input
          {...register('confirmPassword')}
          type="password"
          label="Confirm password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          disabled={isLoading || isSubmitting}
          autoComplete="new-password"
        />

        <Input
          {...register('organizationId')}
          type="text"
          label="Organization ID (optional)"
          placeholder="Enter organization ID if applicable"
          error={errors.organizationId?.message}
          disabled={isLoading || isSubmitting}
          helperText="Leave blank if you're creating a personal account"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isLoading || isSubmitting}
          loading={isLoading || isSubmitting}
        >
          {isLoading || isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      {onSwitchToLogin && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
              disabled={isLoading || isSubmitting}
            >
              Sign in
            </button>
          </p>
        </div>
      )}
    </div>
  );
};