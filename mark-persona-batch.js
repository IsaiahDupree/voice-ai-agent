#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Persona features completed
const completedFeatures = [
  'F0781', // Persona clone
  'F0784', // Persona performance metrics
  'F0797', // Persona export
  'F0798', // Persona import
  'F1009', // GET /api/personas/:id/metrics (same as F0784)
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

console.log('\n✅ Persona batch features marked as completed!')
console.log('Completed features:', completedFeatures.join(', '))
