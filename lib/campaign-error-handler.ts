/**
 * Campaign Error Handler
 * Handles campaign errors with alerting and state management
 * Features: F1286 (Campaign error state), F1287 (Campaign error alert)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface CampaignError {
  campaignId: string;
  errorType: 'unrecoverable' | 'recoverable' | 'warning';
  errorCode: string;
  errorMessage: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export interface AlertRecipient {
  email: string;
  name?: string;
  role: 'admin' | 'manager' | 'user';
}

/**
 * Handle a campaign error with state update and alerting
 */
export async function handleCampaignError(error: CampaignError): Promise<{
  stateUpdated: boolean;
  alertSent: boolean;
}> {
  const results = {
    stateUpdated: false,
    alertSent: false,
  };

  try {
    // Log the error
    await logCampaignError(error);

    // Update campaign state if unrecoverable
    if (error.errorType === 'unrecoverable') {
      await setCampaignErrorState(error.campaignId, error);
      results.stateUpdated = true;

      // Send alert to admins
      const alertSent = await sendErrorAlert(error);
      results.alertSent = alertSent;
    } else if (error.errorType === 'recoverable') {
      // Log but don't change state - attempt recovery
      console.warn(`Recoverable campaign error: ${error.errorMessage}`);
    }

    return results;
  } catch (err) {
    console.error('Failed to handle campaign error:', err);
    return results;
  }
}

/**
 * Set campaign to error state
 */
async function setCampaignErrorState(
  campaignId: string,
  error: CampaignError
): Promise<void> {
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      status: 'error',
      error_state: {
        error_type: error.errorType,
        error_code: error.errorCode,
        error_message: error.errorMessage,
        context: error.context,
        occurred_at: error.timestamp.toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (updateError) {
    throw new Error(`Failed to update campaign state: ${updateError.message}`);
  }
}

/**
 * Log campaign error to database
 */
async function logCampaignError(error: CampaignError): Promise<void> {
  const { error: logError } = await supabase.from('campaign_errors').insert({
    campaign_id: error.campaignId,
    error_type: error.errorType,
    error_code: error.errorCode,
    error_message: error.errorMessage,
    context: error.context || {},
    occurred_at: error.timestamp.toISOString(),
    created_at: new Date().toISOString(),
  });

  if (logError) {
    console.error('Failed to log campaign error:', logError);
  }
}

/**
 * Send error alert to administrators
 */
async function sendErrorAlert(error: CampaignError): Promise<boolean> {
  try {
    // Get campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name, created_by, alert_config')
      .eq('id', error.campaignId)
      .single();

    if (!campaign) {
      console.error('Campaign not found for alerting');
      return false;
    }

    // Get alert recipients
    const recipients = await getAlertRecipients(
      error.campaignId,
      campaign.created_by,
      campaign.alert_config
    );

    if (recipients.length === 0) {
      console.warn('No alert recipients configured for campaign');
      return false;
    }

    // Send alerts (this would integrate with your email service)
    await sendAlertEmails(recipients, campaign, error);

    // Log alert sent
    await logAlertSent(error.campaignId, recipients.length);

    return true;
  } catch (err) {
    console.error('Failed to send error alert:', err);
    return false;
  }
}

/**
 * Get alert recipients for a campaign
 */
async function getAlertRecipients(
  campaignId: string,
  createdBy: string,
  alertConfig?: Record<string, any>
): Promise<AlertRecipient[]> {
  const recipients: AlertRecipient[] = [];

  // Add campaign creator
  const { data: creator } = await supabase
    .from('users')
    .select('email, name, role')
    .eq('id', createdBy)
    .single();

  if (creator) {
    recipients.push({
      email: creator.email,
      name: creator.name,
      role: creator.role || 'user',
    });
  }

  // Add configured alert emails
  if (alertConfig?.alertEmails) {
    alertConfig.alertEmails.forEach((email: string) => {
      if (!recipients.find((r) => r.email === email)) {
        recipients.push({ email, role: 'admin' });
      }
    });
  }

  // Add all admins if configured
  if (alertConfig?.alertAdmins !== false) {
    const { data: admins } = await supabase
      .from('users')
      .select('email, name')
      .eq('role', 'admin');

    admins?.forEach((admin) => {
      if (!recipients.find((r) => r.email === admin.email)) {
        recipients.push({
          email: admin.email,
          name: admin.name,
          role: 'admin',
        });
      }
    });
  }

  return recipients;
}

/**
 * Send alert emails to recipients
 */
async function sendAlertEmails(
  recipients: AlertRecipient[],
  campaign: any,
  error: CampaignError
): Promise<void> {
  const subject = `Campaign Error Alert: ${campaign.name}`;
  const body = `
Campaign: ${campaign.name}
Campaign ID: ${error.campaignId}

Error Type: ${error.errorType}
Error Code: ${error.errorCode}
Error Message: ${error.errorMessage}

Occurred At: ${error.timestamp.toISOString()}

${error.context ? `Context:\n${JSON.stringify(error.context, null, 2)}` : ''}

Please review the campaign in the dashboard and take appropriate action.

Dashboard Link: ${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${error.campaignId}
  `.trim();

  // In a real implementation, this would use an email service like SendGrid, Postmark, etc.
  // For now, we'll use Supabase Edge Functions or queue for batch sending

  const emailPayloads = recipients.map((recipient) => ({
    to: recipient.email,
    to_name: recipient.name,
    subject,
    body,
    campaign_id: error.campaignId,
    alert_type: 'campaign_error',
    created_at: new Date().toISOString(),
  }));

  const { error: queueError } = await supabase.from('email_queue').insert(emailPayloads);

  if (queueError) {
    console.error('Failed to queue alert emails:', queueError);
    throw new Error('Failed to queue alert emails');
  }
}

/**
 * Log that an alert was sent
 */
async function logAlertSent(campaignId: string, recipientCount: number): Promise<void> {
  await supabase.from('campaign_alerts').insert({
    campaign_id: campaignId,
    alert_type: 'error',
    recipient_count: recipientCount,
    sent_at: new Date().toISOString(),
  });
}

/**
 * Get campaign error history
 */
export async function getCampaignErrorHistory(
  campaignId: string,
  limit: number = 50
): Promise<CampaignError[]> {
  const { data, error } = await supabase
    .from('campaign_errors')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch campaign error history:', error);
    return [];
  }

  return (data || []).map((row) => ({
    campaignId: row.campaign_id,
    errorType: row.error_type,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    context: row.context,
    timestamp: new Date(row.occurred_at),
  }));
}

/**
 * Clear campaign error state (manual recovery)
 */
export async function clearCampaignError(
  campaignId: string,
  clearReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .update({
        status: 'paused',
        error_state: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Log the clear action
    await supabase.from('campaign_error_clears').insert({
      campaign_id: campaignId,
      clear_reason: clearReason,
      cleared_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get error stats for monitoring
 */
export async function getCampaignErrorStats(hours: number = 24): Promise<{
  totalErrors: number;
  unrecoverableCount: number;
  recoverableCount: number;
  campaignsInError: number;
  topErrorCodes: Array<{ code: string; count: number }>;
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const [errors, campaigns] = await Promise.all([
    supabase
      .from('campaign_errors')
      .select('error_type, error_code')
      .gte('occurred_at', since.toISOString()),

    supabase.from('campaigns').select('id', { count: 'exact' }).eq('status', 'error'),
  ]);

  const errorData = errors.data || [];
  const unrecoverableCount = errorData.filter((e) => e.error_type === 'unrecoverable').length;
  const recoverableCount = errorData.filter((e) => e.error_type === 'recoverable').length;

  // Count error codes
  const codeCounts: Record<string, number> = {};
  errorData.forEach((e) => {
    codeCounts[e.error_code] = (codeCounts[e.error_code] || 0) + 1;
  });

  const topErrorCodes = Object.entries(codeCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalErrors: errorData.length,
    unrecoverableCount,
    recoverableCount,
    campaignsInError: campaigns.count || 0,
    topErrorCodes,
  };
}
