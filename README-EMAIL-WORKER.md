# Email Background Worker Implementation

This document describes the implementation of a background worker system for email checking in the AllerPal API.

## Overview

The email checking functionality has been moved from the API endpoints to a background worker system using BullMQ and Redis. This provides several benefits:

1. **Improved API Response Time**: API endpoints no longer need to wait for email checking to complete before responding.
2. **Reliability**: Failed email checks can be retried automatically.
3. **Scalability**: The worker can be scaled independently of the API server.
4. **Monitoring**: Jobs can be monitored and tracked through the BullMQ dashboard.

## Architecture

The implementation consists of three main components:

1. **Email Queue Service**: Responsible for creating and managing the job queue.
2. **Email Worker Service**: Processes jobs from the queue.
3. **Email Poller Service**: The existing service that checks for new emails via IMAP.

## Setup Requirements

To use this implementation, you need:

1. **Redis Server**: BullMQ requires Redis to store job data.
2. **Environment Variables**:
   - `REDIS_HOST`: Redis server hostname (default: localhost)
   - `REDIS_PORT`: Redis server port (default: 6379)
   - `REDIS_PASSWORD`: Redis server password (if required)

## How It Works

### Initialization

The services are initialized in the bootstrap process:

1. The Email Poller Service is initialized first.
2. The Email Queue Service is initialized to create the job queue.
3. The Email Worker Service is initialized to process jobs from the queue.
4. A repeating job is scheduled to check for new emails every 5 minutes.

### API Endpoints

The API endpoints (`checkNewMessages` and `checkChatMessages`) now queue jobs for email checking instead of performing the checks directly:

1. `checkNewMessages`: Queues a job to check for new emails for all chats of a user.
2. `checkChatMessages`: Queues a job to check for new emails for a specific chat.

### Job Processing

The Email Worker Service processes jobs from the queue:

1. `check-emails`: Checks for new emails for all chats.
2. `check-chat-emails`: Checks for new emails for a specific chat.
3. `check-emails-repeated`: The scheduled job that runs every 5 minutes.

## Monitoring

The jobs can be monitored through the BullMQ dashboard. To set up the dashboard, you can use the `@bull-board/express` package.

## Error Handling

The implementation includes comprehensive error handling:

1. Failed jobs are retried up to 3 times with exponential backoff.
2. Errors are logged with detailed information.
3. API endpoints continue to function even if job queueing fails.

## Logging

The implementation includes detailed logging:

1. Job creation and processing events are logged.
2. IMAP connection status and email check details are logged.
3. Changes detected in chats are logged.

## Cleanup

The services are properly cleaned up when the server shuts down:

1. The Email Worker Service is closed.
2. The Email Queue Service is closed.
3. The Email Poller Service is stopped.

## Future Improvements

Potential future improvements include:

1. **Dashboard Integration**: Add a BullMQ dashboard for monitoring jobs.
2. **Job Prioritization**: Prioritize certain types of jobs.
3. **Distributed Workers**: Run workers on separate servers for better scalability.
4. **Job Concurrency**: Adjust concurrency settings for better performance.
5. **Job Retention**: Adjust job retention settings for better resource usage. 