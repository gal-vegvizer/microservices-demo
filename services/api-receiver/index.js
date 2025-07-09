const express = require('express')
const cors = require('cors')

// Conditionally use mock AWS adapter for local testing
let AWS
let isMock = false
if (process.env.USE_MOCK_AWS === 'true') {
  AWS = require('../../mock-aws-adapter')
  isMock = true
  console.log('Using mock AWS adapter')
} else {
  AWS = require('aws-sdk')
}

// Configure AWS SDK only if not using mock
if (!isMock) {
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-2'
  })
}

const app = express()
const PORT = process.env.PORT || 8080

const sqs = new AWS.SQS()
const ssm = new AWS.SSM()

// Middleware
app.use(cors())
app.use(express.json())

// Cache for SSM parameter to avoid repeated calls
let cachedToken = null
let tokenLastFetched = 0
const TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Helper to support both AWS SDK and mock adapter for .promise()
function maybePromise(objOrPromise) {
  // If the object has a .promise method, call it (AWS SDK v2 style)
  if (objOrPromise && typeof objOrPromise.promise === 'function') {
    return objOrPromise.promise()
  }
  // Otherwise, assume it's already a promise (mock adapter)
  return objOrPromise
}

// Function to get token from SSM Parameter Store
async function getTokenFromSSM() {
  const now = Date.now()
  
  // Return cached token if still valid
  if (cachedToken && (now - tokenLastFetched) < TOKEN_CACHE_TTL) {
    return cachedToken
  }
  
  try {
    const params = {
      Name: process.env.SSM_API_TOKEN_PARAM || '/microservices-demo/api-token',
      WithDecryption: true
    }
    
    const result = await maybePromise(ssm.getParameter(params))
    cachedToken = result.Parameter.Value
    tokenLastFetched = now
    
    console.log('Token fetched from SSM Parameter Store')
    return cachedToken
  } catch (error) {
    console.error('Error fetching token from SSM:', error.message)
    throw new Error('Failed to retrieve authentication token')
  }
}

// Function to validate email timestamp
function validateEmailTimestamp(timestamp) {
  if (!timestamp) {
    return { valid: false, error: 'email_timestream field is required' }
  }
  
  // Check if it's a valid Unix timestamp (10 digits)
  const timestampStr = timestamp.toString()
  if (!/^\d{10}$/.test(timestampStr)) {
    return { valid: false, error: 'email_timestream must be a valid 10-digit Unix timestamp' }
  }
  
  // Convert to date and validate
  const date = new Date(parseInt(timestamp) * 1000)
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'email_timestream contains invalid date' }
  }
  
  return { valid: true, date }
}

// Main endpoint that receives requests from ELB
app.post('/', async (req, res) => {
  try {
    const { data, token } = req.body
    
    // Validate request structure
    if (!data || !token) {
      return res.status(400).json({
        error: 'Invalid request structure',
        message: 'Both "data" and "token" fields are required'
      })
    }
    
    // Validate data structure
    const { email_subject, email_sender, email_timestream, email_content } = data
    if (!email_subject || !email_sender || !email_timestream || !email_content) {
      return res.status(400).json({
        error: 'Invalid data structure',
        message: 'All email fields (email_subject, email_sender, email_timestream, email_content) are required'
      })
    }
    
    // Validate date
    const timestampValidation = validateEmailTimestamp(email_timestream)
    if (!timestampValidation.valid) {
      return res.status(400).json({
        error: 'Date validation failed',
        message: timestampValidation.error
      })
    }
    
    // Get and validate token
    let validToken
    try {
      validToken = await getTokenFromSSM()
    } catch (error) {
      return res.status(500).json({
        error: 'Authentication service unavailable',
        message: 'Unable to validate token at this time'
      })
    }
    
    if (token !== validToken) {
      return res.status(401).json({
        error: 'Token validation failed',
        message: 'Invalid authentication token'
      })
    }
    
    // Token validation successful - publish to SQS
    const sqsParams = {
      QueueUrl: process.env.SQS_QUEUE_URL || 'https://sqs.us-east-2.amazonaws.com/145023112744/microdemo-queue',
      MessageBody: JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
        email_date: timestampValidation.date.toISOString(),
        processed_by: 'api-receiver'
      })
    }
    
    const sqsResult = await sqs.sendMessage(sqsParams).promise()
    
    console.log(`Message sent to SQS successfully:`, {
      messageId: sqsResult.MessageId,
      email_subject: data.email_subject,
      email_sender: data.email_sender,
      timestamp: timestampValidation.date.toISOString()
    })
    
    // Success response
    res.status(200).json({
      success: true,
      message: 'Request processed successfully',
      messageId: sqsResult.MessageId,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error processing request:', error)
    
    if (error.code === 'AWS.SQS.NonExistentQueue' || error.code === 'AWS.SimpleQueueService.NonExistentQueue') {
      return res.status(503).json({
        error: 'Queue service unavailable',
        message: 'Unable to queue message for processing'
      })
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request'
    })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-receiver',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Receiver microservice running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`AWS Region: ${process.env.AWS_REGION || 'us-east-2'}`)
  console.log(`SQS Queue: ${process.env.SQS_QUEUE_URL || 'default'}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})
