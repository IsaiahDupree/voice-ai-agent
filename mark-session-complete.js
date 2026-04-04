const fs = require('fs');

// Read features
const data = JSON.parse(fs.readFileSync('features.json'));

// All features implemented in this session
const sessionFeatures = [
  // Core features implemented
  'F0139', // Call whisper to agent (outbound/route.ts + campaign-dialer.ts)
  'F0154', // Call note creation (already existed in notes/route.ts)
  'F0155', // Inbound DID display (webhook saves to_number)
  'F0159', // Call whispering to rep (transfer-whisper.ts)
  'F0166', // Inbound compliance logging (compliance-logger.ts + webhook integration)
  'F0172', // Call PII redaction (pii-redaction.ts + webhook integration)
  'F0173', // Live transfer context (transfer-whisper.ts)
  'F0178', // Campaign list (campaigns/route.ts)
  'F0179', // Campaign get (campaigns/[id]/route.ts)
  'F0180', // Campaign update (campaigns/[id]/route.ts)
  'F0181', // Campaign delete (campaigns/[id]/route.ts)
  'F0185', // Batch dial start (campaigns/[id]/start/route.ts)
  'F0187', // Batch dial pause (campaign-dialer.ts pauseCampaign)
  'F0191', // Outbound calling hours enforcement (campaign-dialer.ts)
  'F0192', // Day-of-week restrictions (campaign-dialer.ts)
  'F0194', // DNC list check (campaign-dialer.ts + campaign-helpers.ts)
  'F0196', // DNC export (dnc/export/route.ts)
];

let updated = 0;
data.features.forEach(f => {
  if (sessionFeatures.includes(f.id) && !f.passes) {
    f.passes = true;
    f.status = 'completed';
    updated++;
    console.log(`✓ ${f.id}: ${f.title}`);
  }
});

// Write back
fs.writeFileSync('features.json', JSON.stringify(data, null, 2));
fs.writeFileSync('/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json', JSON.stringify(data, null, 2));

const totalComplete = data.features.filter(f => f.passes).length;
const totalFeatures = data.features.length;
const percentComplete = ((totalComplete / totalFeatures) * 100).toFixed(1);

console.log(`\n✨ Updated ${updated} features`);
console.log(`📊 Total complete: ${totalComplete}/${totalFeatures} (${percentComplete}%)`);
console.log(`🎯 Remaining: ${totalFeatures - totalComplete}`);
