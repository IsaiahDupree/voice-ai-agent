#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Features completed in this batch
const completedFeatures = [
  'F0390', // getContactHistory tool
  'F0391', // searchContacts tool
  'F0392', // createTask tool
  'F0427', // getNextBooking tool
  'F0429', // addToWaitlist tool
  'F1419', // Tool documentation endpoint
  'F1420', // Tool invocation history
  'F0977', // DELETE /api/transcripts/:id (already done)
  'F0978', // GET /api/transcripts/:id/export (already done)
]

const featuresPath = path.join(__dirname, 'features.json')
const harnessPath = '/Users/isaiahdupree/Documents/Software/autonomous-coding-dashboard/harness/voice-ai-agent-features.json'

function updateFeatures(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  let updatedCount = 0

  data.features = data.features.map((feature) => {
    if (completedFeatures.includes(feature.id)) {
      updatedCount++
      return {
        ...feature,
        status: 'completed',
        passes: true,
      }
    }
    return feature
  })

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))

  console.log(`Updated ${updatedCount} features in ${filePath}`)
}

// Update both files
updateFeatures(featuresPath)
updateFeatures(harnessPath)

console.log('\n✅ FunctionTools & API batch features marked as completed!')
console.log('Completed features:', completedFeatures.join(', '))
