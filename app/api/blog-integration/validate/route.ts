import { NextRequest, NextResponse } from 'next/server';

interface BlogValidationRequest {
  provider: 'wordpress' | 'wix';
  credential: string;
  siteUrl?: string; // Required for WordPress
  username?: string; // Required for WordPress
}

interface SiteInfo {
  name: string;
  description?: string;
  url: string;
  version?: string;
  platform: 'wordpress' | 'wix';
  canPublishPosts: boolean;
  canUploadMedia: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: BlogValidationRequest = await request.json();
    const { provider, credential, siteUrl, username } = body;

    if (!provider || !credential) {
      return NextResponse.json(
        { error: 'Provider and credential are required' },
        { status: 400 }
      );
    }

    let siteInfo: SiteInfo;

    if (provider === 'wordpress') {
      if (!siteUrl || !username) {
        return NextResponse.json(
          { error: 'Site URL and username are required for WordPress' },
          { status: 400 }
        );
      }

      siteInfo = await validateWordPress(credential, siteUrl, username);
    } else if (provider === 'wix') {
      siteInfo = await validateWix(credential);
    } else {
      return NextResponse.json(
        { error: 'Unsupported blog provider' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      siteInfo,
    });

  } catch (error) {
    console.error('Blog validation error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: error.message,
          errorCode: 'VALIDATION_FAILED',
          troubleshooting: {
            title: 'How to fix this',
            steps: [
              'Check your credentials are correct',
              'Ensure your site is accessible',
              'Verify API permissions'
            ]
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function validateWordPress(appPassword: string, siteUrl: string, username: string): Promise<SiteInfo> {
  // Ensure URL has proper format
  const cleanUrl = siteUrl.replace(/\/$/, ''); // Remove trailing slash
  const restApiUrl = `${cleanUrl}/wp-json/wp/v2`;

  try {
    // Test authentication by fetching site info
    const siteResponse = await fetch(`${cleanUrl}/wp-json`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!siteResponse.ok) {
      if (siteResponse.status === 401) {
        throw new Error('Invalid username or application password. Please check your credentials.');
      } else if (siteResponse.status === 404) {
        throw new Error('WordPress REST API not found. Please ensure REST API is enabled on your site.');
      } else {
        throw new Error(`Site not accessible: ${siteResponse.statusText}`);
      }
    }

    const siteData = await siteResponse.json();

    // Test if we can access posts endpoint (permission check)
    const postsResponse = await fetch(`${restApiUrl}/posts?per_page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    const canPublishPosts = postsResponse.ok;

    // Test if we can access media endpoint
    const mediaResponse = await fetch(`${restApiUrl}/media?per_page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    const canUploadMedia = mediaResponse.ok;

    return {
      name: siteData.name || 'WordPress Site',
      description: siteData.description || undefined,
      url: cleanUrl,
      version: siteData.version || undefined,
      platform: 'wordpress',
      canPublishPosts,
      canUploadMedia,
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to validate WordPress site. Please check your site URL and credentials.');
  }
}

async function validateWix(apiKey: string): Promise<SiteInfo> {
  try {
    // Test API key by fetching site information
    const siteResponse = await fetch('https://dev.wix.com/api/v1/sites', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!siteResponse.ok) {
      if (siteResponse.status === 401) {
        throw new Error('Invalid Wix API key. Please check your credentials.');
      } else if (siteResponse.status === 403) {
        throw new Error('API key does not have sufficient permissions.');
      } else {
        throw new Error(`Wix API error: ${siteResponse.statusText}`);
      }
    }

    const siteData = await siteResponse.json();
    
    // Get the first site (assuming single site for now)
    const site = siteData.sites?.[0];
    
    if (!site) {
      throw new Error('No sites found for this API key.');
    }

    // Test blog API access
    const blogResponse = await fetch(`https://dev.wix.com/api/v1/sites/${site.siteId}/blog/posts?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const canPublishPosts = blogResponse.ok;

    return {
      name: site.displayName || site.siteDisplayName || 'Wix Site',
      description: undefined,
      url: site.liveUrl || site.editorUrl || 'https://wix.com',
      platform: 'wix',
      canPublishPosts,
      canUploadMedia: true, // Assuming Wix supports media upload through API
    };

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to validate Wix site. Please check your API key.');
  }
} 