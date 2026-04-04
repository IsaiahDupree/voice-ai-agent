#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Features completed in this batch
const completedFeatures = [
  'F0449', // Transcript word count
  'F0452', // Keyword extraction
  'F0453', // Intent classification
  'F0454', // Entity extraction
  'F0456', // Export plain text
  'F0457', // Export JSON
  'F0458', // Export SRT
  'F0466', // Quality score
  'F0467', // Language detection
  'F0469', // Talk ratio
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

console.log('\n✅ All features marked as completed!')
console.log('Completed features:', completedFeatures.join(', '))
