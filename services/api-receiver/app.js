const express = require('express')
const AWS = require('aws-sdk')

const app = express()
app.use(express.json())

// Configure AWS
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-2' })
const sqs = new AWS.SQS({ region: process.env.AWS_REGION || 'us-east-2' })

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'microdemo-data-bucket'
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-2.amazonaws.com/145023112744/microdemo-queue'

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-receiver',
    timestamp: new Date().toISOString()
  })
})

// Main data endpoint
app.post('/api/data', async (req, res) => {
  try {
    const timestamp = new Date().toISOString()
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const key = `data/${timestamp.split('T')[0]}/${id}.json`
    
    console.log(`Processing request ${id}`)
    
    // Prepare data for storage
    const dataToStore = {
      id,
      timestamp,
      data: req.body,
      source: 'api-receiver'
    }
    
    // Store in S3
    await s3.putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: JSON.stringify(dataToStore, null, 2),
      ContentType: 'application/json'
    }).promise()
    
    console.log(`Stored data in S3: ${key}`)
    
    // Send message to SQS for processing
    const sqsMessage = {
      id,
      s3Key: key,
      timestamp,
      type: req.body.type || 'general'
    }
    
    await sqs.sendMessage({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage)
    }).promise()
    
    console.log(`Sent message to SQS for processing: ${id}`)
    
    // Return success response
    res.status(201).json({
      success: true,
      id,
      message: 'Data received and queued for processing',
      s3Location: key,
      timestamp
    })
    
  } catch (error) {
    console.error('Error processing request:', error)
    res.status(500).json({
      error: 'Failed to process data',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'API Receiver',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      data: 'POST /api/data'
    }
  })
})

const PORT = process.env.PORT || 8080

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Receiver running on port ${PORT}`)
  console.log(`S3 Bucket: ${S3_BUCKET}`)
  console.log(`SQS Queue: ${SQS_QUEUE_URL}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully')
  process.exit(0)
})
