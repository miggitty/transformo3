# N8N Callback Node Configuration Guide

This is a detailed step-by-step guide for setting up the callback HTTP Request nodes in your N8N content creation workflow.

## Overview

You need to add **2 HTTP Request nodes** to your content creation workflow:
1. **Success Callback Node** - Sends callback when workflow completes successfully
2. **Error Callback Node** - Sends callback when workflow fails

## Part 1: Success Callback Node

### Step 1: Add the HTTP Request Node

1. **In your N8N workflow editor:**
   - Scroll to the END of your content creation workflow (after all content generation is complete)
   - Click the **+ (plus)** button to add a new node
   - In the search box, type: `HTTP Request`
   - Click on **HTTP Request** to add it

### Step 2: Configure Basic Settings

2. **Node Name & Method:**
   - At the top, change the node name from "HTTP Request" to: `Send Completion Callback`
   - **Method**: Click dropdown and select `POST`

### Step 3: Configure the URL

3. **URL Field:**
   - Click in the **URL** input field
   - Click the **{}** (expression) button next to it
   - In the expression editor, paste: `{{ $json.callbackUrl }}`
   - Click **Close**

### Step 4: Configure Headers

4. **Add Headers:**
   - Scroll down to the **Headers** section
   - Click **Add Header** button
   - **Name**: Type `Content-Type`
   - **Value**: Type `application/json`

5. **Add Second Header:**
   - Click **Add Header** again
   - **Name**: Type `x-n8n-callback-secret`
   - **Value**: Click the **{}** expression button and paste: `{{ $json.callbackSecret }}`

### Step 5: Configure Request Body

6. **Body Configuration:**
   - Scroll down to **Body** section
   - **Body Content Type**: Click dropdown and select `JSON`
   - **JSON**: Click in the large text area and paste this exact JSON:

```json
{
  "content_id": "={{ $json.contentId }}",
  "workflow_type": "content_creation",
  "success": true,
  "environment": "={{ $json.environment }}",
  "timestamp": "={{ new Date().toISOString() }}"
}
```

### Step 6: Configure Node Settings (Recommended)

7. **Advanced Settings:**
   - Click the **Settings** tab (next to Parameters)
   - **Continue On Fail**: Toggle this **ON** (so workflow doesn't crash if callback fails)
   - **Retry On Fail**: Toggle this **ON**
   - **Max Retries**: Set to `3`

8. **Save the Node:**
   - Click **Execute Node** to test (optional)
   - The node should show green checkmark when configured correctly

## Part 2: Error Callback Node

### Step 1: Set Up Error Handling

1. **Enable Error Handling on a Key Node:**
   - Find one of your important content generation nodes (like a node that creates content assets)
   - Click on that node
   - Go to **Settings** tab
   - Toggle **Continue On Fail** to **ON**
   - This creates a red error output line from that node

### Step 2: Add Error HTTP Request Node

2. **Add HTTP Request to Error Path:**
   - From the **red error line**, click the **+** button
   - Search for and add **HTTP Request**
   - Name it: `Send Error Callback`

### Step 3: Configure Error Node

3. **Configure Exactly Like Success Node, But Different Body:**
   - **Method**: `POST`
   - **URL**: `{{ $json.callbackUrl }}`
   - **Headers**: Same as success node:
     - `Content-Type`: `application/json`
     - `x-n8n-callback-secret`: `{{ $json.callbackSecret }}`

4. **Error Body JSON:**
```json
{
  "content_id": "={{ $json.contentId }}",
  "workflow_type": "content_creation",
  "success": false,
  "error": "={{ $json.error || 'Content creation workflow failed' }}",
  "environment": "={{ $json.environment }}",
  "timestamp": "={{ new Date().toISOString() }}"
}
```

## Part 3: Visual Workflow Structure

Your workflow should now look like this:

```
📥 Webhook Trigger
    ↓
🔄 Content Generation Node 1
    ↓
🔄 Content Generation Node 2  
    ↓ ✅ (success)
📤 Send Completion Callback
    ↘️ ❌ (error)
    📤 Send Error Callback
```

## Part 4: Testing Your Configuration

### Test in N8N Interface

1. **Test Success Path:**
   - Click on the "Send Completion Callback" node
   - Click **Execute Node** button
   - Should see green checkmark with HTTP 200 response

2. **Test Error Path:**
   - Click on the "Send Error Callback" node  
   - Click **Execute Node** button
   - Should see green checkmark with HTTP 200 response

### Test With Real Data

3. **Trigger Full Workflow:**
   - Go to your app and trigger content generation
   - Watch the N8N execution log
   - Should see both nodes execute properly

## Part 5: Common Issues & Solutions

### Issue: "callbackUrl is undefined"
**Solution:** Make sure your app is sending the callback URL in the initial payload:
```json
{
  "contentId": "abc123",
  "callbackUrl": "https://your-app.com/api/n8n/callback",
  "callbackSecret": "your-secret",
  // ... other data
}
```

### Issue: "401 Unauthorized" Response
**Solution:** Check that the callback secret matches:
- In your app's `.env`: `N8N_CALLBACK_SECRET=your-secret`
- In N8N header: `{{ $json.callbackSecret }}`

### Issue: Node Shows Red Error
**Solution:** 
1. Check the URL is properly formed
2. Verify headers are exactly as shown
3. Make sure JSON body has proper expression syntax `={{ }}`

### Issue: App Not Receiving Callbacks
**Solution:** 
1. Check your app's callback endpoint is accessible
2. Verify the URL in N8N matches your app's URL
3. Check firewall/network settings

## Part 6: Final Verification

After setting up both nodes, your content generation flow should work like this:

1. **User clicks "Regenerate Content"** → App shows loading state
2. **N8N workflow starts** → Content gets generated
3. **If successful** → Success callback sent → App re-enables fields  
4. **If failed** → Error callback sent → App shows error message

You should see these logs in your app when callbacks are received:
```
N8N callback received from production: {
  content_id: "abc123",
  workflow_type: "content_creation", 
  success: true
}
```

That's it! Your N8N workflow will now properly communicate back to the app when content generation is complete. 