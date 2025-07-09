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

const sqs = new AWS.SQS()
const s3 = new AWS.S3()

// Configuration
const QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-2.amazonaws.com/145023112744/microdemo-queue'
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'microdemo-data-bucket'
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL_MS) || 5000 // 5 seconds default
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES) || 10
const WAIT_TIME_SECONDS = parseInt(process.env.WAIT_TIME_SECONDS) || 20 // Long polling

let isRunning = true
let activeProcesses = 0

console.log('SQS Worker microservice starting...')
console.log(`Queue URL: ${QUEUE_URL}`)
console.log(`S3 Bucket: ${S3_BUCKET}`)
console.log(`Polling Interval: ${POLLING_INTERVAL}ms`)
console.log(`Max Messages per poll: ${MAX_MESSAGES}`)

// Helper to support both AWS SDK and mock adapter for .promise()
function maybePromise(objOrPromise) {
  // If the object has a .promise method, call it (AWS SDK v2 style)
  if (objOrPromise && typeof objOrPromise.promise === 'function') {
    return objOrPromise.promise()
  }
  // Otherwise, assume it's already a promise (mock adapter)
  return objOrPromise
}

// Function to generate S3 key path for the message
function generateS3Key(messageData) {
  const timestamp = new Date()
  const year = timestamp.getFullYear()
  const month = String(timestamp.getMonth() + 1).padStart(2, '0')
  const day = String(timestamp.getDate()).padStart(2, '0')
  const hour = String(timestamp.getHours()).padStart(2, '0')
  
  // Create a unique filename
  const messageId = `msg_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Organize by date and hour for better S3 organization
  return `emails/${year}/${month}/${day}/${hour}/${messageId}.json`
}

// Function to upload message to S3
async function uploadMessageToS3(messageData, s3Key) {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(messageData, null, 2),
      ContentType: 'application/json',
      Metadata: {
        'source': 'sqs-worker',
        'processed-at': new Date().toISOString(),
        'email-subject': messageData.data?.email_subject || 'unknown',
        'email-sender': messageData.data?.email_sender || 'unknown'
      }
    }
    
    const result = await maybePromise(s3.putObject(params))
    console.log(`Successfully uploaded to S3: s3://${S3_BUCKET}/${s3Key}`)
    return result
  } catch (error) {
    console.error(`Error uploading to S3:`, error.message)
    throw error
  }
}

// Function to process a single message
async function processMessage(message) {
  const messageId = message.MessageId
  const receiptHandle = message.ReceiptHandle
  
  try {
    console.log(`Processing message ${messageId}`)
    
    // Parse message body
    const messageData = JSON.parse(message.Body)
    
    // Add processing metadata
    const enrichedData = {
      ...messageData,
      sqs_metadata: {
        messageId: messageId,
        receivedAt: new Date().toISOString(),
        processedBy: 'sqs-worker'
      }
    }
    
    // Generate S3 key for organized storage
    const s3Key = generateS3Key(messageData)
    
    // Upload to S3
    await uploadMessageToS3(enrichedData, s3Key)
    
    // Delete message from queue after successful processing
    await maybePromise(sqs.deleteMessage({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle
    }))
    
    console.log(`Successfully processed and deleted message ${messageId}`)
    console.log(`Email from: ${messageData.data?.email_sender} | Subject: ${messageData.data?.email_subject}`)
    
  } catch (error) {
    console.error(`Error processing message ${messageId}:`, error.message)
    // Message will become visible again after visibility timeout
    // In production, you might want to implement dead letter queue logic
  }
}

// Main polling function
async function pollSQS() {
  if (!isRunning) {
    return
  }
  
  try {
    console.log('Polling SQS for messages...')
    
    const params = {
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: MAX_MESSAGES,
      WaitTimeSeconds: WAIT_TIME_SECONDS, // Long polling
      VisibilityTimeout: 30 // 30 seconds to process each message
    }
    
    const result = await maybePromise(sqs.receiveMessage(params))
    
    if (result.Messages && result.Messages.length > 0) {
      console.log(`Received ${result.Messages.length} message(s) from SQS`)
      
      // Process messages concurrently
      activeProcesses += result.Messages.length
      const processPromises = result.Messages.map(message => 
        processMessage(message).finally(() => {
          activeProcesses--
        })
      )
      
      await Promise.allSettled(processPromises)
    } else {
      console.log('No messages received from SQS')
    }
    
  } catch (error) {
    console.error('Error polling SQS:', error.message)
    
    if (error.code === 'AWS.SQS.NonExistentQueue' || error.code === 'AWS.SimpleQueueService.NonExistentQueue') {
      console.error('Queue does not exist. Please check the queue URL.')
    }
  }
  
  // Schedule next poll
  if (isRunning) {
    setTimeout(pollSQS, POLLING_INTERVAL)
  }
}

// Graceful shutdown function
async function gracefulShutdown() {
  console.log('Initiating graceful shutdown...')
  isRunning = false
  
  // Wait for active processes to complete (max 30 seconds)
  const maxWait = 30000
  const waitStart = Date.now()
  
  while (activeProcesses > 0 && (Date.now() - waitStart) < maxWait) {
    console.log(`Waiting for ${activeProcesses} active processes to complete...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  if (activeProcesses > 0) {
    console.log(`Forcing shutdown with ${activeProcesses} active processes`)
  }
  
  console.log('SQS Worker microservice stopped')
  process.exit(0)
}

// Signal handlers
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  gracefulShutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason)
  gracefulShutdown()
})

// Start the service
console.log('Starting SQS polling...')
pollSQS()
