#!/usr/bin/env node
const fs = require('fs')

const featuresPath = './features.json'
const features = JSON.parse(fs.readFileSync(featuresPath, 'utf8'))

const toComplete = ['F0308', 'F0309', 'F0320', 'F0292', 'F0293', 'F0232', 'F0260', 'F0256', 'F0257']

toComplete.forEach(id => {
  const feature = features.features.find(f => f.id === id)
  if (feature) {
    feature.status = 'completed'
    feature.passes = true
    console.log(`✓ Marked ${id} as completed: ${feature.title}`)
  }
})

fs.writeFileSync(featuresPath, JSON.stringify(features, null, 2))
console.log(`\n✓ Updated features.json`)
