/**
 * Error Rate Alerting System
 * Monitors error rates and sends alerts when thresholds are exceeded
 * Feature: F1291 (Error rate alerting)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface ErrorRateConfig {
  enabled: boolean;
  timeWindowMinutes: number;
  errorThreshold: number;
  alertCooldownMinutes: number;
  categories: string[];
}

export interface ErrorRateStats {
  category: string;
  count: number;
  rate: number;
  threshold: number;
  exceeded: boolean;
}

const DEFAULT_CONFIG: ErrorRateConfig = {
  enabled: true,
  timeWindowMinutes: 15,
  errorThreshold: 10,
  alertCooldownMinutes: 60,
  categories: ['api', 'webhook', 'campaign', 'ui', 'external_service'],
};

/**
 * Check error rates and send alerts if thresholds exceeded
 */
export async function monitorErrorRates(
  config: Partial<ErrorRateConfig> = {}
): Promise<ErrorRateStats[]> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return [];
  }

  const stats: ErrorRateStats[] = [];

  // Check each error category
  for (const category of fullConfig.categories) {
    const categoryStats = await checkCategoryErrorRate(category, fullConfig);
    stats.push(categoryStats);

    if (categoryStats.exceeded) {
      await handleErrorRateExceeded(category, categoryStats, fullConfig);
    }
  }

  return stats;
}

/**
 * Check error rate for a specific category
 */
async function checkCategoryErrorRate(
  category: string,
  config: ErrorRateConfig
): Promise<ErrorRateStats> {
  const since = new Date();
  since.setMinutes(since.getMinutes() - config.timeWindowMinutes);

  let count = 0;

  // Query different tables based on category
  switch (category) {
    case 'api':
      const { count: apiCount } = await supabase
        .from('api_errors')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since.toISOString());
      count = apiCount || 0;
      break;

    case 'webhook':
      const { count: webhookCount } = await supabase
        .from('webhook_delivery_log')
        .select('*', { count: 'exact', head: true })
        .eq('success', false)
        .gte('created_at', since.toISOString());
      count = webhookCount || 0;
      break;

    case 'campaign':
      const { count: campaignCount } = await supabase
        .from('campaign_errors')
        .select('*', { count: 'exact', head: true })
        .gte('occurred_at', since.toISOString());
      count = campaignCount || 0;
      break;

    case 'ui':
      const { count: uiCount } = await supabase
        .from('ui_errors')
        .select('*', { count: 'exact', head: true })
        .gte('occurred_at', since.toISOString());
      count = uiCount || 0;
      break;

    case 'external_service':
      const { count: serviceCount } = await supabase
        .from('provider_failures')
        .select('*', { count: 'exact', head: true })
        .gte('failed_at', since.toISOString());
      count = serviceCount || 0;
      break;

    default:
      console.warn(`Unknown error category: ${category}`);
  }

  const rate = count / config.timeWindowMinutes; // errors per minute
  const exceeded = count >= config.errorThreshold;

  return {
    category,
    count,
    rate,
    threshold: config.errorThreshold,
    exceeded,
  };
}

/**
 * Handle error rate threshold exceeded
 */
async function handleErrorRateExceeded(
  category: string,
  stats: ErrorRateStats,
  config: ErrorRateConfig
): Promise<void> {
  // Check if we're in cooldown period
  const inCooldown = await isInCooldownPeriod(category, config.alertCooldownMinutes);

  if (inCooldown) {
    console.log(`Error rate alert for ${category} suppressed (cooldown period)`);
    return;
  }

  // Send alert
  await sendErrorRateAlert(category, stats, config);

  // Record alert sent
  await recordAlertSent(category, stats);
}

/**
 * Check if we're in cooldown period for a category
 */
async function isInCooldownPeriod(
  category: string,
  cooldownMinutes: number
): Promise<boolean> {
  const since = new Date();
  since.setMinutes(since.getMinutes() - cooldownMinutes);

  const { data } = await supabase
    .from('error_rate_alerts')
    .select('id')
    .eq('category', category)
    .gte('sent_at', since.toISOString())
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Send error rate alert
 */
async function sendErrorRateAlert(
  category: string,
  stats: ErrorRateStats,
  config: ErrorRateConfig
): Promise<void> {
  const subject = `Error Rate Alert: ${category.toUpperCase()}`;
  const body = `
Error rate threshold exceeded for category: ${category}

Time Window: ${config.timeWindowMinutes} minutes
Error Count: ${stats.count}
Error Rate: ${stats.rate.toFixed(2)} errors/minute
Threshold: ${config.errorThreshold} errors

This alert indicates a potential issue that requires investigation.

Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/monitoring/errors
  `.trim();

  // Get admin emails
  const { data: admins } = await supabase
    .from('users')
    .select('email, name')
    .eq('role', 'admin');

  if (!admins || admins.length === 0) {
    console.warn('No admin users found for error rate alerting');
    return;
  }

  // Queue alert emails
  const emailPayloads = admins.map((admin) => ({
    to: admin.email,
    to_name: admin.name,
    subject,
    body,
    alert_type: 'error_rate',
    category,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('email_queue').insert(emailPayloads);

  if (error) {
    console.error('Failed to queue error rate alert emails:', error);
  }
}

/**
 * Record that an alert was sent
 */
async function recordAlertSent(category: string, stats: ErrorRateStats): Promise<void> {
  const { error } = await supabase.from('error_rate_alerts').insert({
    category,
    error_count: stats.count,
    error_rate: stats.rate,
    threshold: stats.threshold,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to record error rate alert:', error);
  }
}

/**
 * Get error rate alert history
 */
export async function getErrorRateAlertHistory(
  hours: number = 24
): Promise<Array<{
  category: string;
  errorCount: number;
  errorRate: number;
  sentAt: string;
}>> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data, error } = await supabase
    .from('error_rate_alerts')
    .select('category, error_count, error_rate, sent_at')
    .gte('sent_at', since.toISOString())
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch error rate alert history:', error);
    return [];
  }

  return (data || []).map((row) => ({
    category: row.category,
    errorCount: row.error_count,
    errorRate: row.error_rate,
    sentAt: row.sent_at,
  }));
}

/**
 * Get current error rates (for dashboard display)
 */
export async function getCurrentErrorRates(
  config: Partial<ErrorRateConfig> = {}
): Promise<Record<string, ErrorRateStats>> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const stats: Record<string, ErrorRateStats> = {};

  for (const category of fullConfig.categories) {
    stats[category] = await checkCategoryErrorRate(category, fullConfig);
  }

  return stats;
}
