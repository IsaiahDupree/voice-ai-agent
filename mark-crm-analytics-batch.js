const fs = require('fs')

const data = JSON.parse(fs.readFileSync('features.json', 'utf8'))

const completedIds = [
  // CRM profile fields
  'F0611', // Contact industry field
  'F0612', // Contact company field
  'F0613', // Contact title field
  'F0614', // Contact city field
  'F0615', // Contact state field
  'F0618', // Contact lifetime value
  'F0619', // Contact booking rate
  'F0625', // Contact re-engagement flag
  'F0599', // Contact engagement score (already had endpoint, added lib functions)
]

let updated = 0
data.features = data.features.map(f => {
  if (completedIds.includes(f.id)) {
    console.log(`Marking ${f.id} - ${f.title} as completed`)
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
