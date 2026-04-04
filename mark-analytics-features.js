const fs = require('fs')

const data = JSON.parse(fs.readFileSync('features.json', 'utf8'))

const completedIds = [
  'F0862', // Drop-off analysis
  'F0863', // Geography map
  'F0867', // Transcript analytics
  'F0868', // Keyword frequency
  'F0869', // Objection frequency
  'F0870', // Sentiment by time of day
  'F0871', // API latency analytics
  'F0872', // Error rate analytics
  'F0873', // SMS analytics by template
]

let updated = 0
data.features = data.features.map(f => {
  if (completedIds.includes(f.id)) {
    console.log(`Marking ${f.id} - ${f.feature} as completed`)
    updated++
    return { ...f, passes: true, status: 'completed' }
  }
  return f
})

fs.writeFileSync('features.json', JSON.stringify(data, null, 2))
console.log(`\n✅ Updated ${updated} features`)

// Update harness status
const harness = JSON.parse(fs.readFileSync('harness-status.json', 'utf8'))
const passing = data.features.filter(f => f.passes).length
const total = data.features.length
const pending = total - passing
const percentComplete = ((passing / total) * 100).toFixed(1)

harness.stats = {
  total,
  passing,
  pending,
  percentComplete,
}
harness.lastUpdated = new Date().toISOString()

fs.writeFileSync('harness-status.json', JSON.stringify(harness, null, 2))
console.log(`Harness status: ${passing}/${total} (${percentComplete}%)`)
