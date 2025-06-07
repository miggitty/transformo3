export async function triggerN8nWorkflow({
  audioUrl,
  contentId,
  businessId,
}: {
  audioUrl: string;
  contentId: string;
  businessId: string;
}) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const apiKey = process.env.N8N_API_KEY;

  if (!webhookUrl) {
    console.error('N8N_WEBHOOK_URL is not defined.');
    throw new Error('n8n webhook URL is not configured.');
  }

  if (!apiKey) {
    console.error('N8N_API_KEY is not defined.');
    throw new Error('n8n API key is not configured.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      content_id: contentId,
      business_id: businessId,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    console.error('n8n API response:', responseBody);
    throw new Error(
      `Failed to trigger n8n workflow. Status: ${response.status}`
    );
  }

  // We don't need to read the response body, just confirm it was accepted.
  console.log(`n8n workflow triggered for content ID: ${contentId}`);
  return { success: true };
} 