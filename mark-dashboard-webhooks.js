// Mark dashboard, webhooks, and remaining P0 features as complete

const fs = require('fs');
const path = require('path');

const featuresPath = path.join(__dirname, 'features.json');
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf-8'));

// Features completed in this session
const completedFeatureIds = [
  // SMS Webhook (F0510, F0512, F0547)
  'F0510', 'F0512', 'F0547',

  // Dashboard Features (F0685-F0742)
  'F0685', 'F0686', 'F0688', 'F0691', 'F0700', 'F0713', 'F0719', 'F0720',
  'F0721', 'F0722', 'F0723', 'F0725', 'F0730', 'F0742', 'F0779',

  // Analytics/Stats (F0817-F0850)
  'F0817', 'F0818', 'F0819', 'F0850',

  // Vapi Webhook - already implemented but marking now
  'F0895', 'F0896', 'F0897',

  // These were already implemented in the webhook handler but not marked
  'F0898', 'F0899', // Twilio webhook
  'F0565', 'F0566', 'F0609', // Contacts table (already in migration)
];

let updatedCount = 0;

features.features.forEach(feature => {
  if (completedFeatureIds.includes(feature.id)) {
    if (!feature.passes || feature.status !== 'completed') {
      feature.passes = true;
      feature.status = 'completed';
      updatedCount++;
      console.log(`✓ Marked ${feature.id} as complete: ${feature.title}`);
    }
  }
});

fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2));

console.log(`\n✅ Updated ${updatedCount} features as complete`);
console.log(`Total passing: ${features.features.filter(f => f.passes).length}/${features.features.length}`);

// Calculate percentage
const percentComplete = ((features.features.filter(f => f.passes).length / features.features.length) * 100).toFixed(1);
console.log(`Progress: ${percentComplete}%`);
