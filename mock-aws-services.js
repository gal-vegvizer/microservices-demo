const express = require('express')
const fs = require('fs').promises
const path = require('path')

const app = express()
app.use(express.json())

// Mock SSM Parameter Store
const mockParameters = {
  '/microservices-demo/api-token': '$DJISA<$#45ex3RtYr'
}

// Mock SQS Queue (in-memory)
let mockQueue = []

// Mock S3 Storage (file system)
const mockS3Path = path.join(__dirname, 'mock-s3')

// Initialize mock S3 directory
async function initMockS3() {
  try {
    await fs.mkdir(mockS3Path, { recursive: true })
    console.log('Mock S3 storage initialized at:', mockS3Path)
  } catch (error) {
    console.error('Error initializing mock S3:', error.message)
  }
}

// SSM GetParameter endpoint
app.post('/ssm/get-parameter', (req, res) => {
  const { Name } = req.body
  
  if (mockParameters[Name]) {
    res.json({
      Parameter: {
        Name,
        Value: mockParameters[Name],
        Type: 'SecureString'
      }
    })
  } else {
    res.status(400).json({
      __type: 'ParameterNotFound',
      message: `Parameter ${Name} not found.`
    })
  }
})

// SQS SendMessage endpoint
app.post('/sqs/send-message', (req, res) => {
  const { QueueUrl, MessageBody, MessageAttributes } = req.body
  
  const message = {
    MessageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    Body: MessageBody,
    MessageAttributes,
    ReceiptHandle: `rh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  }
  
  mockQueue.push(message)
  
  console.log(`SQS: Message added to queue (${mockQueue.length} total)`)
  
  res.json({
    MessageId: message.MessageId,
    MD5OfBody: 'mock-md5-hash'
  })
})

// SQS ReceiveMessage endpoint
app.post('/sqs/receive-message', (req, res) => {
  const { QueueUrl, MaxNumberOfMessages = 1, WaitTimeSeconds = 0 } = req.body
  
  const messages = mockQueue.splice(0, MaxNumberOfMessages)
  
  console.log(`SQS: Retrieved ${messages.length} message(s) from queue (${mockQueue.length} remaining)`)
  
  res.json({
    Messages: messages.length > 0 ? messages : undefined
  })
})

// SQS DeleteMessage endpoint
app.post('/sqs/delete-message', (req, res) => {
  const { ReceiptHandle } = req.body
  
  console.log(`SQS: Message deleted (Receipt: ${ReceiptHandle})`)
  
  res.json({})
})

// S3 PutObject endpoint
app.post('/s3/put-object', async (req, res) => {
  const { Bucket, Key, Body, ContentType, Metadata } = req.body
  
  try {
    const filePath = path.join(mockS3Path, Bucket, Key)
    const dir = path.dirname(filePath)
    
    await fs.mkdir(dir, { recursive: true })
    
    const fileData = {
      body: typeof Body === 'string' ? Body : JSON.stringify(Body),
      contentType: ContentType,
      metadata: Metadata,
      uploadedAt: new Date().toISOString()
    }
    
    await fs.writeFile(filePath, JSON.stringify(fileData, null, 2))
    
    console.log(`S3: Object stored at s3://${Bucket}/${Key}`)
    
    res.json({
      ETag: '"mock-etag"',
      Location: `https://${Bucket}.s3.amazonaws.com/${Key}`
    })
  } catch (error) {
    console.error('S3 Error:', error.message)
    res.status(500).json({
      Code: 'InternalError',
      Message: error.message
    })
  }
})

// S3 GetObject endpoint
app.post('/s3/get-object', async (req, res) => {
  const { Bucket, Key } = req.body
  
  try {
    const filePath = path.join(mockS3Path, Bucket, Key)
    const fileData = await fs.readFile(filePath, 'utf8')
    const parsedData = JSON.parse(fileData)
    
    console.log(`S3: Object retrieved from s3://${Bucket}/${Key}`)
    
    res.json({
      Body: parsedData.body,
      ContentType: parsedData.contentType,
      Metadata: parsedData.metadata
    })
  } catch (error) {
    console.error('S3 Error:', error.message)
    res.status(404).json({
      Code: 'NoSuchKey',
      Message: 'The specified key does not exist.'
    })
  }
})

// Status endpoint to check mock services
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    services: ['SSM', 'SQS', 'S3'],
    queueLength: mockQueue.length,
    timestamp: new Date().toISOString()
  })
})

// Start mock AWS services
const PORT = 4566 // LocalStack default port
initMockS3().then(() => {
  app.listen(PORT, () => {
    console.log(`Mock AWS services running on port ${PORT}`)
    console.log('Available endpoints:')
    console.log('- POST /ssm/get-parameter')
    console.log('- POST /sqs/send-message')
    console.log('- POST /sqs/receive-message') 
    console.log('- POST /sqs/delete-message')
    console.log('- POST /s3/put-object')
    console.log('- POST /s3/get-object')
    console.log('- GET /status')
  })
})
