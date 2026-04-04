const fs = require('fs')
const path = require('path')

const featuresPath = path.join(__dirname, 'features.json')
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'))

const completedIds = ['F1227', 'F1246', 'F1248', 'F1251', 'F1254', 'F1260']

completedIds.forEach((id) => {
  const feature = features.features.find((f) => f.id === id)
  if (feature) {
    feature.passes = true
    feature.status = 'completed'
    console.log(`✓ Marked ${id} as complete: ${feature.title}`)
  } else {
    console.log(`✗ Feature ${id} not found`)
  }
})

fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2))
console.log('\nFeatures file updated!')
