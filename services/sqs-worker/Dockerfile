# Use the official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean npm cache to avoid integrity errors
RUN npm cache clean --force

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY index.js ./

# Start the application
CMD ["npm", "start"]
