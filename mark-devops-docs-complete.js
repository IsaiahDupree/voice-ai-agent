const fs = require('fs')
const features = JSON.parse(fs.readFileSync('features.json', 'utf8'))

const completedIds = [
  'F1321', // Vercel preview deployments
  'F1322', // Vercel production domain
  'F1326', // Cal.com webhook registration
  'F1336', // Monitoring: uptime
  'F1337', // Monitoring: error rate
  'F1338', // Monitoring: response time
  'F1367', // API reference
  'F1368', // Webhook event reference
  'F1372', // Database schema doc
]

completedIds.forEach((id) => {
  const feature = features.features.find((f) => f.id === id)
  if (feature) {
    feature.passes = true
    feature.status = 'completed'
    console.log(`✓ ${id}: ${feature.title}`)
  }
})

fs.writeFileSync('features.json', JSON.stringify(features, null, 2))
console.log(`\n✓ Marked ${completedIds.length} features as complete`)
