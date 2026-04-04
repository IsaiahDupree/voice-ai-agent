// F1220, F1221, F1222, F1223: Load test runner script
import { LOAD_TEST_CONFIG } from '../__tests__/load-test.config'

async function runConcurrentCallsTest() {
  console.log('Running F1220: Concurrent calls load test...')
  const { count, assistantId, phoneNumbers } = LOAD_TEST_CONFIG.concurrentCalls

  const startTime = Date.now()
  const promises = phoneNumbers.map(async (phone, index) => {
    try {
      const response = await fetch('http://localhost:3000/api/calls/manual-dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: phone,
          assistant_id: assistantId,
        }),
      })
      return { success: response.ok, phone, index }
    } catch (error) {
      return { success: false, phone, index, error }
    }
  })

  const results = await Promise.all(promises)
  const duration = Date.now() - startTime
  const successful = results.filter((r) => r.success).length

  console.log(`✅ Concurrent calls test: ${successful}/${count} calls initiated in ${duration}ms`)
  return { successful, total: count, duration }
}

async function runWebhookThroughputTest() {
  console.log('Running F1221: Webhook throughput load test...')
  const { eventsPerMinute, duration, webhookUrl } = LOAD_TEST_CONFIG.webhookThroughput

  const intervalMs = (60 * 1000) / eventsPerMinute
  let sent = 0
  let errors = 0

  const startTime = Date.now()
  const endTime = startTime + duration * 1000

  while (Date.now() < endTime) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status-update',
          call: { id: `load-test-${sent}`, status: 'in-progress' },
        }),
      })
      sent++
    } catch (error) {
      errors++
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  console.log(`✅ Webhook throughput test: ${sent} events sent, ${errors} errors`)
  return { sent, errors }
}

async function runSMSBatchTest() {
  console.log('Running F1222: SMS batch load test...')
  const { count, message, phoneNumbers } = LOAD_TEST_CONFIG.smsBatch

  try {
    const response = await fetch('http://localhost:3000/api/sms/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_numbers: phoneNumbers,
        message,
      }),
    })

    const result = await response.json()
    console.log(`✅ SMS batch test: ${result.sent}/${count} SMS sent successfully`)
    return result
  } catch (error) {
    console.error('❌ SMS batch test failed:', error)
    return { sent: 0, failed: count, error }
  }
}

async function runAPIThroughputTest() {
  console.log('Running F1223: API throughput load test...')
  const { requestsPerSecond, duration, endpoints } = LOAD_TEST_CONFIG.apiThroughput

  const totalRequests = requestsPerSecond * duration
  const intervalMs = 1000 / requestsPerSecond

  let successful = 0
  let errors = 0
  const startTime = Date.now()

  for (let i = 0; i < totalRequests; i++) {
    const endpoint = endpoints[i % endpoints.length]
    const requestStartTime = Date.now()

    try {
      const response = await fetch(`http://localhost:3000${endpoint.path}`, {
        method: endpoint.method,
      })
      if (response.ok) successful++
      else errors++
    } catch (error) {
      errors++
    }

    const elapsed = Date.now() - requestStartTime
    const waitTime = Math.max(0, intervalMs - elapsed)
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
  }

  const totalDuration = Date.now() - startTime
  const actualRPS = (totalRequests / totalDuration) * 1000

  console.log(
    `✅ API throughput test: ${successful}/${totalRequests} successful, ${actualRPS.toFixed(2)} req/sec`
  )
  return { successful, errors, totalRequests, actualRPS }
}

async function runAllLoadTests() {
  console.log('🚀 Starting load tests...\n')

  const results = {
    concurrentCalls: await runConcurrentCallsTest(),
    webhookThroughput: await runWebhookThroughputTest(),
    smsBatch: await runSMSBatchTest(),
    apiThroughput: await runAPIThroughputTest(),
  }

  console.log('\n📊 Load test results:')
  console.log(JSON.stringify(results, null, 2))

  return results
}

// Run if executed directly
if (require.main === module) {
  runAllLoadTests().catch(console.error)
}

export { runAllLoadTests, runConcurrentCallsTest, runWebhookThroughputTest, runSMSBatchTest, runAPIThroughputTest }
