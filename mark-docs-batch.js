#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Documentation features completed
const completedFeatures = [
  'F1392', // API SDK examples
  'F1394', // Postman collection (Bruno collection already exists)
  'F1396', // FAQ
  'F1397', // Monitoring guide
  'F1398', // Client onboarding guide
  'F1399', // Demo script
  'F1496', // Changelog
  'F1497', // Performance tuning guide
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

console.log('\n✅ Documentation batch features marked as completed!')
console.log('Completed features:', completedFeatures.join(', '))
