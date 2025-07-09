// mock-aws-adapter.js
// Drop-in replacement for AWS SDK for local testing with mock-aws-services.js
const axios = require('axios')

const MOCK_BASE = process.env.MOCK_AWS_BASE || 'http://localhost:4566'

class MockSQS {
  async sendMessage(params) {
    const res = await axios.post(`${MOCK_BASE}/sqs/send-message`, params)
    return res.data
  }
  async receiveMessage(params) {
    const res = await axios.post(`${MOCK_BASE}/sqs/receive-message`, params)
    return res.data
  }
  async deleteMessage(params) {
    const res = await axios.post(`${MOCK_BASE}/sqs/delete-message`, params)
    return res.data
  }
}

class MockS3 {
  async putObject(params) {
    const res = await axios.post(`${MOCK_BASE}/s3/put-object`, params)
    return res.data
  }
  async getObject(params) {
    const res = await axios.post(`${MOCK_BASE}/s3/get-object`, params)
    return res.data
  }
}

class MockSSM {
  async getParameter(params) {
    const res = await axios.post(`${MOCK_BASE}/ssm/get-parameter`, params)
    return res.data
  }
}

module.exports = {
  SQS: MockSQS,
  S3: MockS3,
  SSM: MockSSM
}
