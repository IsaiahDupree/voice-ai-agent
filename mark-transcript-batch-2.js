#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Features completed in batch 2
const completedFeatures = [
  'F0462', // Gap detection
  'F0465', // Next steps
  'F0470', // Silence ratio
  'F0471', // Longest monologue
  'F0472', // Update/edit transcript
  'F0480', // Delete transcript
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

console.log('\n✅ Batch 2 features marked as completed!')
console.log('Completed features:', completedFeatures.join(', '))
