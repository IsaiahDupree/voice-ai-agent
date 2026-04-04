export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Voice AI Agent</h1>
        <p className="text-xl text-gray-300 mb-8">
          AI-powered phone agent for 24/7 inbound/outbound calls, appointment booking, and CRM integration
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-2">📞 Inbound Calls</h2>
            <p className="text-gray-400">Answer calls 24/7 with natural AI conversations</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-2">📅 Book Appointments</h2>
            <p className="text-gray-400">Integrated with Cal.com for real-time scheduling</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold mb-2">💬 SMS Follow-ups</h2>
            <p className="text-gray-400">Automatic SMS confirmations via Twilio</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">System Status</h2>
            <p className="text-gray-400">Check <a href="/api/health" className="text-blue-400 underline">/api/health</a> for service connectivity</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <a href="/dashboard" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 transition rounded font-semibold">
              Open Dashboard →
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
