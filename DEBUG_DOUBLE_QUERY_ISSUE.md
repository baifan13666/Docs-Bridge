# Debug: Double Query Usage Issue

## Problem Description
User reports that each AI response consumes 2 queries from their usage limit instead of 1.

## What I've Added

### Comprehensive Logging System

I've added detailed logging throughout the entire message flow to track exactly what's happening:

#### 1. Frontend Logging (ChatInterface.tsx)

**handleSendMessage:**
- Unique ID for each send attempt: `send-{timestamp}-{random}`
- Logs when function starts and ends
- Tracks authentication status
- Logs each step of the pipeline

**continueWithStreamingRAG:**
- Unique request ID: `req-{timestamp}-{random}`
- Logs when streaming RAG starts
- Tracks conversation ID creation
- Logs when executeStreamingQuery is called

#### 2. Backend Logging (app/api/chat/query-stream/route.ts)

**API Route:**
- Unique request ID: `api-{timestamp}-{random}`
- Logs when new request arrives
- Tracks conversation ID
- **CRITICAL**: Logs usage BEFORE and AFTER increment
- Shows exact messages_used count before/after

## How to Debug

### Step 1: Open Browser Console
1. Open your app in the browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Clear the console

### Step 2: Send a Test Message
1. Type a message and send it
2. Watch the console logs

### Step 3: Look for These Patterns

#### Expected Flow (CORRECT - should only increment once):
```
[ChatInterface] ========== handleSendMessage START - ID: send-xxx ==========
[ChatInterface] send-xxx - Processing message: "..."
[ChatInterface] send-xxx - Step 1: Detecting language...
[ChatInterface] send-xxx - Step 2: Optimizing query...
[ChatInterface] send-xxx - Calling continueWithRAG...
[ChatInterface] continueWithRAG START - RequestID: req-xxx
[ChatInterface] Calling executeStreamingQuery - RequestID: req-xxx
[RAG Stream] ========== NEW REQUEST - RequestID: api-xxx ==========
[RAG Stream] RequestID: api-xxx - Received request for conversation: ...
[RAG Stream] RequestID: api-xxx - Usage BEFORE: 5/100
[RAG Stream] RequestID: api-xxx - Usage AFTER increment: 6/100  ← Should increment by 1
[RAG Stream] RequestID: api-xxx - ========== REQUEST COMPLETE ==========
[ChatInterface] executeStreamingQuery completed - RequestID: req-xxx
[ChatInterface] send-xxx - continueWithRAG completed
[ChatInterface] ========== handleSendMessage END - ID: send-xxx ==========
```

#### Problem Pattern 1 (handleSendMessage called twice):
```
[ChatInterface] ========== handleSendMessage START - ID: send-xxx ==========
[ChatInterface] ========== handleSendMessage START - ID: send-yyy ==========  ← DUPLICATE!
```
**Cause**: Something is triggering handleSendMessage twice (e.g., double-click, form submit + button click)

#### Problem Pattern 2 (API called twice):
```
[RAG Stream] ========== NEW REQUEST - RequestID: api-xxx ==========
[RAG Stream] ========== NEW REQUEST - RequestID: api-yyy ==========  ← DUPLICATE!
```
**Cause**: executeStreamingQuery is being called twice

#### Problem Pattern 3 (Usage incremented twice in single request):
```
[RAG Stream] RequestID: api-xxx - Usage BEFORE: 5/100
[RAG Stream] RequestID: api-xxx - Usage AFTER increment: 6/100
[RAG Stream] RequestID: api-xxx - Usage BEFORE: 6/100  ← CALLED AGAIN!
[RAG Stream] RequestID: api-xxx - Usage AFTER increment: 7/100
```
**Cause**: increment_message_usage is being called twice in the same request

### Step 4: Check Server Logs

If you're running locally, also check your terminal/server logs for the `[RAG Stream]` messages.

## What to Report Back

Please send me:

1. **Full console log** from when you click send until the response completes
2. **Count the number of times** you see:
   - `handleSendMessage START`
   - `NEW REQUEST - RequestID`
   - `Usage BEFORE:`
   - `Usage AFTER increment:`
3. **The actual usage numbers** shown in the logs (e.g., "5/100" → "6/100" or "5/100" → "7/100")

## Possible Causes & Solutions

### Cause 1: Double Form Submit
**Symptom**: Two `handleSendMessage START` logs with different IDs
**Solution**: Add form submit prevention or debouncing

### Cause 2: React Strict Mode (Development Only)
**Symptom**: Everything runs twice in development
**Solution**: This is normal in dev mode, test in production build

### Cause 3: API Called Twice
**Symptom**: Two `NEW REQUEST` logs for one user action
**Solution**: Check if executeStreamingQuery is called multiple times

### Cause 4: Database Function Issue
**Symptom**: Usage increments by 2 in single API call
**Solution**: Check the `increment_message_usage` database function

## Quick Test

To quickly test, try this:

1. Check your current usage: Look at the sidebar or user settings
2. Send ONE message
3. Check usage again
4. Did it increment by 1 or 2?

If it incremented by 2, check the console logs to see which pattern matches.

## Next Steps

Once we identify the pattern from the logs, I can provide a targeted fix.
