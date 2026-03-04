const mongoose = require('mongoose')

let isConnected = false

async function connectDB() {
  if (isConnected) return

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)

    isConnected = true
    console.log(`[DB] MongoDB connected → ${conn.connection.host}`)
  } catch (err) {
    console.error('[DB] Connection failed:', err.message)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close()
  console.log('[DB] Connection closed — process terminated')
  process.exit(0)
})

module.exports = connectDB
