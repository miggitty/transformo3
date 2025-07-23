# Email Rate Limit Monitoring & Prevention

## Current Configuration
- **Rate Limit**: 200 emails per hour (increased from 50)
- **Email Provider**: Resend via SMTP
- **Verification Required**: Yes (`enable_confirmations = true`)

## Monitoring Dashboard

### Supabase Analytics
1. **Authentication** → **Users** → Monitor signup frequency
2. **Settings** → **API** → Check rate limit usage
3. **Logs** → Filter for "auth" events

### Key Metrics to Watch
- Signups per hour vs. email rate limit
- Failed email deliveries
- Suspicious signup patterns (same IP, similar emails)

## Rate Limit Guidelines

| App Size | Emails/Hour | Max Signups/Day |
|----------|-------------|-----------------|
| Small    | 50          | ~1,200         |
| Medium   | 100         | ~2,400         |
| **Current** | **200** | **~4,800** |
| Large    | 500+        | ~12,000+       |

## Prevention Strategies

### 1. Anti-Spam Measures
```typescript
// Add to signup form validation
const validateSignup = async (email: string, ip: string) => {
  // Check for suspicious patterns
  const recentSignups = await checkRecentSignupsByIP(ip);
  if (recentSignups > 5) {
    throw new Error('Too many signups from this IP');
  }
  
  // Validate email domain
  const suspiciousDomains = ['10minutemail.com', 'temp-mail.org'];
  const domain = email.split('@')[1];
  if (suspiciousDomains.includes(domain)) {
    throw new Error('Please use a permanent email address');
  }
};
```

### 2. Rate Limit Alerts
Set up monitoring to alert when approaching 80% of rate limit:
- 160/200 emails per hour = Warning alert
- 190/200 emails per hour = Critical alert

### 3. Graceful Degradation
```typescript
// In signup action
const { error } = await supabase.auth.signUp({...});

if (error?.message.includes('rate limit')) {
  return {
    message: 'High signup volume detected. Please try again in a few minutes.',
    suggestion: 'You can still create your account - verification email will be sent shortly.'
  };
}
```

## Emergency Response

### If Rate Limit Hit Again:
1. **Immediate**: Increase rate limit in Supabase Dashboard
2. **Check**: Look for bot/spam signups in user list
3. **Block**: Add IP blocks if necessary
4. **Monitor**: Watch for continued unusual activity

### Rate Limit Recommendations by Growth:
- **Current (200/hour)**: Good for 4,800 signups/day
- **If hitting 200**: Increase to 500/hour
- **High growth**: Consider 1000+ emails/hour

## Email Provider Backup Plan

### Resend Limits
- **Free**: 3,000 emails/month
- **Paid**: 50,000+ emails/month
- **Rate**: Up to 10 emails/second

### Fallback Strategy
If Resend fails, have backup SMTP configured:
1. SendGrid
2. AWS SES
3. Mailgun

## Troubleshooting Common Issues

### "Email rate limit exceeded"
1. Check current usage in Supabase Dashboard
2. Increase rate limit if legitimate traffic
3. Investigate if bot traffic

### "Failed to send magic link"
1. Verify RESEND_API_KEY is set correctly
2. Check Resend dashboard for delivery failures
3. Verify domain DNS configuration

### Users not receiving emails
1. Check spam folders
2. Verify sender domain reputation
3. Check Resend delivery logs 