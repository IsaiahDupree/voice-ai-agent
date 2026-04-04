// F0261: Campaign cooldown enforcement
// Enforce 24h cooldown between campaign runs for same contact

import { supabaseAdmin } from './supabase';

/**
 * Check if contact is currently in cooldown
 * F0261: Campaign cooldown
 */
export async function isContactInCooldown(contactId: number): Promise<boolean> {
  try {
    const now = new Date();

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('cooldown_until, last_contacted_at')
      .eq('id', contactId)
      .single();

    if (error || !data) {
      // No record means not in cooldown
      return false;
    }

    // Check explicit cooldown_until timestamp
    if (data.cooldown_until) {
      const cooldownUntil = new Date(data.cooldown_until);
      if (now < cooldownUntil) {
        console.log(
          `[Cooldown] Contact ${contactId} in cooldown until ${cooldownUntil.toISOString()}`
        );
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[Cooldown] Error checking cooldown:', err);
    return false; // Fail-open
  }
}

/**
 * Set contact cooldown after call attempt
 * F0261: Campaign cooldown
 */
export async function setContactCooldown(
  contactId: number,
  cooldownHours: number = 24
): Promise<void> {
  try {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000);

    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        last_contacted_at: now.toISOString(),
        cooldown_until: cooldownUntil.toISOString()
      })
      .eq('id', contactId);

    console.log(
      `[Cooldown] Set cooldown for contact ${contactId} until ${cooldownUntil.toISOString()}`
    );
  } catch (err) {
    console.error('[Cooldown] Error setting cooldown:', err);
    // Fail-open: don't block on cooldown update failures
  }
}

/**
 * Clear contact cooldown (manual override)
 * F0261: Campaign cooldown
 */
export async function clearContactCooldown(contactId: number): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        cooldown_until: null
      })
      .eq('id', contactId);

    console.log(`[Cooldown] Cleared cooldown for contact ${contactId}`);
  } catch (err) {
    console.error('[Cooldown] Error clearing cooldown:', err);
  }
}

/**
 * Get contacts NOT in cooldown for a campaign
 * F0261: Campaign cooldown
 * Returns contact IDs that are eligible to be called
 */
export async function getEligibleContacts(
  campaignId: number,
  limit: number = 100
): Promise<number[]> {
  try {
    const now = new Date();

    // Get pending campaign contacts
    const { data: campaignContacts } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('contact_id')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(limit * 2); // Fetch extra to account for cooldowns

    if (!campaignContacts || campaignContacts.length === 0) {
      return [];
    }

    const contactIds = campaignContacts.map((cc) => cc.contact_id);

    // Filter out contacts in cooldown
    const { data: contacts } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('id, cooldown_until')
      .in('id', contactIds);

    if (!contacts) {
      return contactIds.slice(0, limit);
    }

    const eligible = contacts
      .filter((contact) => {
        if (!contact.cooldown_until) return true;
        const cooldownUntil = new Date(contact.cooldown_until);
        return now >= cooldownUntil;
      })
      .map((contact) => contact.id);

    console.log(
      `[Cooldown] ${eligible.length}/${contactIds.length} contacts eligible (not in cooldown)`
    );

    return eligible.slice(0, limit);
  } catch (err) {
    console.error('[Cooldown] Error getting eligible contacts:', err);
    return [];
  }
}

/**
 * Check campaign-level cooldown configuration
 * F0261: Campaign cooldown
 */
export async function getCampaignCooldownConfig(campaignId: number): Promise<{
  cooldownHours: number;
  respectGlobalCooldown: boolean;
}> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('cooldown_hours, respect_global_cooldown')
      .eq('id', campaignId)
      .single();

    if (error || !data) {
      // Default config
      return {
        cooldownHours: 24,
        respectGlobalCooldown: true
      };
    }

    return {
      cooldownHours: data.cooldown_hours || 24,
      respectGlobalCooldown: data.respect_global_cooldown !== false
    };
  } catch (err) {
    console.error('[Cooldown] Error getting campaign config:', err);
    return {
      cooldownHours: 24,
      respectGlobalCooldown: true
    };
  }
}
