const AWS = require('aws-sdk')

// Configure AWS
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-2' })
const sqs = new AWS.SQS({ region: process.env.AWS_REGION || 'us-east-2' })

const S3_BUCKET = process.env.S3_BUCKET_NAME || 'microdemo-data-bucket'
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || 'https://sqs.us-east-2.amazonaws.com/145023112744/microdemo-queue'

let isRunning = true

// Simple data processing function
function processData(originalData) {
  console.log(`Processing data of type: ${originalData.data.type || 'general'}`)
  
  return {
    ...originalData,
    processed: true,
    processedAt: new Date().toISOString(),
    processor: 'sqs-worker',
    processing: {
      status: 'completed',
      transformations: [
        'added_timestamp',
        'added_processor_info',
        'validated_structure'
      ]
    }
  }
}

// Main processing function
async function processMessages() {
  if (!isRunning) return
  
  try {
    console.log('Polling SQS for messages...')
    
    // Receive messages from SQS
    const result = await sqs.receiveMessage({
      QueueUrl: SQS_QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      VisibilityTimeout: 30
    }).promise()
    
    if (result.Messages && result.Messages.length > 0) {
      console.log(`Received ${result.Messages.length} messages`)
      
      // Process each message
      for (const message of result.Messages) {
        try {
          const messageData = JSON.parse(message.Body)
          console.log(`Processing message for ID: ${messageData.id}`)
          
          // Get original data from S3
          const s3Object = await s3.getObject({
            Bucket: S3_BUCKET,
            Key: messageData.s3Key
          }).promise()
          
          const originalData = JSON.parse(s3Object.Body.toString())
          
          // Process the data
          const processedData = processData(originalData)
          
          // Store processed data back to S3
          const processedKey = messageData.s3Key.replace('data/', 'processed/')
          await s3.putObject({
            Bucket: S3_BUCKET,
            Key: processedKey,
            Body: JSON.stringify(processedData, null, 2),
            ContentType: 'application/json'
          }).promise()
          
          console.log(`Stored processed data: ${processedKey}`)
          
          // Delete message from SQS
          await sqs.deleteMessage({
            QueueUrl: SQS_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle
          }).promise()
          
          console.log(`Successfully processed message: ${messageData.id}`)
          
        } catch (error) {
          console.error('Error processing message:', error)
          // Message will become visible again after visibility timeout
        }
      }
    } else {
      console.log('No messages received')
    }
    
  } catch (error) {
    console.error('Error polling SQS:', error)
  }
  
  // Continue polling
  if (isRunning) {
    setTimeout(processMessages, 5000) // Poll every 5 seconds
  }
}

// Start the worker
console.log('Starting SQS Worker...')
console.log(`S3 Bucket: ${S3_BUCKET}`)
console.log(`SQS Queue: ${SQS_QUEUE_URL}`)

processMessages()

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully')
  isRunning = false
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully')
  isRunning = false
  process.exit(0)
})
