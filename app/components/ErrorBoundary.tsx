/**
 * React Error Boundary
 * Catches UI crashes and displays fallback UI
 * Feature: F1288 (Error boundary in UI)
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  async logErrorToService(error: Error, errorInfo: ErrorInfo) {
    try {
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          errorInfo: {
            componentStack: errorInfo.componentStack,
          },
          section: this.props.section,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
    } catch (logError) {
      console.error('Failed to log error to service:', logError);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Something went wrong
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  {this.props.section
                    ? `An error occurred in the ${this.props.section} section.`
                    : 'An unexpected error occurred.'}
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mb-4">
                    <summary className="text-sm font-medium text-red-800 cursor-pointer hover:text-red-900">
                      Error details
                    </summary>
                    <div className="mt-2 p-3 bg-red-100 rounded text-xs font-mono overflow-auto max-h-40">
                      <div className="font-semibold mb-1">{this.state.error.message}</div>
                      <pre className="whitespace-pre-wrap text-red-800">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 text-sm font-medium"
                  >
                    Reload page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Section-specific error boundaries with custom fallbacks
 */
export function DashboardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      section="dashboard"
      fallback={
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Dashboard Error
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't load the dashboard. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Dashboard
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function CampaignErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      section="campaign"
      fallback={
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Campaign Error
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't load the campaign details. Please try again.
          </p>
          <button
            onClick={() => window.location.href = '/campaigns'}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Campaigns
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function AnalyticsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      section="analytics"
      fallback={
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Analytics Error
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't load the analytics data. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Analytics
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
