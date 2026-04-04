const fs = require('fs')

const data = JSON.parse(fs.readFileSync('features.json', 'utf8'))

const pending = data.features.filter(f => !f.passes && f.category === 'CRM')

console.log(`CRM pending features: ${pending.length}\n`)
pending.slice(0, 20).forEach(f => {
  console.log(`${f.id}: ${f.title}`)
})
