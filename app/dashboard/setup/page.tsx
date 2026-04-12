'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Phone, Calendar, Phone as CallIcon, Zap } from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
  action?: () => void;
}

export default function SetupPage() {
  const [steps, setSteps] = useState<SetupStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSetupStatus() {
      try {
        setLoading(true);

        // Check Vapi health
        const healthRes = await fetch('/api/health');
        const vapiConnected = healthRes.ok;

        // Check if phone number is assigned
        const configRes = await fetch('/api/agent/config');
        let phoneAssigned = false;
        let googleCalendarConnected = false;

        if (configRes.ok) {
          const config = await configRes.json();
          phoneAssigned = !!config.phone_number;
          googleCalendarConnected = !!config.google_calendar_token;
        }

        // Check if test call was made (at least 1 call in history)
        const callsRes = await fetch('/api/calls?limit=1');
        let testCallMade = false;

        if (callsRes.ok) {
          const calls = await callsRes.json();
          testCallMade = Array.isArray(calls) ? calls.length > 0 : (calls.calls?.length || 0) > 0;
        }

        setSteps([
          {
            id: 'vapi',
            title: 'Connect Vapi Assistant',
            description: 'Your AI voice agent is connected and ready to make calls.',
            completed: vapiConnected,
            icon: <Zap className="w-5 h-5" />,
          },
          {
            id: 'phone',
            title: 'Assign Phone Number',
            description: 'Configure the phone number that your agent will use.',
            completed: phoneAssigned,
            icon: <Phone className="w-5 h-5" />,
          },
          {
            id: 'calendar',
            title: 'Connect Google Calendar',
            description: 'Link your Google Calendar for scheduling bookings.',
            completed: googleCalendarConnected,
            icon: <Calendar className="w-5 h-5" />,
            action: () => {
              window.location.href = '/api/auth/google-calendar';
            },
          },
          {
            id: 'test',
            title: 'Make a Test Call',
            description: 'Complete your first call to verify everything is working.',
            completed: testCallMade,
            icon: <CallIcon className="w-5 h-5" />,
          },
        ]);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup status');
      } finally {
        setLoading(false);
      }
    }

    fetchSetupStatus();
  }, []);

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Agent Setup</h1>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Agent Setup</h1>
        <p className="text-muted-foreground mt-2">
          Complete these steps to get your AI voice agent up and running.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Setup Progress</h3>
          <span className="text-sm font-medium">{completedCount} of {steps.length} complete</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 mb-8">
          <p className="text-sm text-yellow-700">
            Note: Some setup information could not be verified. Status might be outdated.
          </p>
        </div>
      )}

      {/* Setup Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-lg border transition-colors ${
              step.completed
                ? 'bg-green-50 border-green-200'
                : 'bg-card hover:bg-muted'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  {step.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Step {index + 1}
                    </span>
                    {step.completed && (
                      <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                        Completed
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
                    <span className="text-blue-600">{step.icon}</span>
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">{step.description}</p>

                  {step.action && !step.completed && (
                    <button
                      onClick={step.action}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      {step.id === 'calendar' ? 'Connect Google Calendar' : 'Configure'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Completion Message */}
      {completedCount === steps.length && (
        <div className="mt-8 rounded-lg border border-green-200 bg-green-50 p-6">
          <h3 className="font-semibold text-green-900 mb-2">✓ Setup Complete!</h3>
          <p className="text-sm text-green-700">
            Your AI voice agent is fully configured and ready to start making calls. Visit the{' '}
            <a href="/dashboard" className="underline hover:no-underline">
              dashboard
            </a>{' '}
            to see your call analytics.
          </p>
        </div>
      )}
    </div>
  );
}
