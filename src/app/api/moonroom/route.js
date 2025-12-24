import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { checkUserIllumin80Status } from '@/utils/firestore-illumin80';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Authentication required', { status: 401 });
    }
    
    // Get the full user object from Clerk
    const user = await currentUser();
    
    if (!user) {
      return new NextResponse('User not found', { status: 401 });
    }
    
    // Check authorization with multiple methods
    let isAuthorized = false;
    let authMethod = null;
    
    console.log('🔍 Checking MoonRoom access for user:', {
      userId,
      email: user.emailAddresses?.[0]?.emailAddress,
      firstName: user.firstName,
      username: user.username
    });
    
    // First try secure Clerk ID check
    const secureCheck = await checkUserIllumin80Status(userId, true);
    
    if (secureCheck.isIllumin80) {
      console.log('✅ Illumin80 member verified via secure Clerk ID');
      isAuthorized = true;
      authMethod = 'clerkId';
    } else {
      // Fallback checks for users not yet linked
      console.log('No Clerk ID link found, trying other identifiers...');
      
      // Try all possible identifiers
      const identifiers = [
        user.emailAddresses?.[0]?.emailAddress,
        user.firstName,
        user.username,
        user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null,
        // Special check for "Michelle" since that's in your Firestore
        user.firstName === 'Michelle' ? 'Michelle' : null
      ].filter(Boolean);
      
      for (const identifier of identifiers) {
        console.log(`Checking identifier: ${identifier}`);
        const check = await checkUserIllumin80Status(identifier, false);
        if (check.isIllumin80) {
          console.log(`✅ Illumin80 member verified via: ${identifier}`);
          isAuthorized = true;
          authMethod = identifier;
          break;
        }
      }
    }
    
    console.log('Authorization result:', { isAuthorized, authMethod });
    
    if (!isAuthorized) {
        return new NextResponse(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Access Denied - Illumin80 Only</title>
            <style>
              body {
                background: radial-gradient(ellipse at center, #1a0033 0%, #000011 50%, #000000 100%);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                position: relative;
                overflow: hidden;
              }
              
              .bg-effects {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle at 20% 80%, rgba(255, 0, 128, 0.2) 0%, transparent 50%),
                           radial-gradient(circle at 80% 20%, rgba(0, 255, 255, 0.2) 0%, transparent 50%),
                           radial-gradient(circle at 40% 40%, rgba(139, 0, 255, 0.15) 0%, transparent 50%);
                animation: pulse 8s ease-in-out infinite;
                pointer-events: none;
              }
              
              h1 { 
                background: linear-gradient(135deg, #FF0080, #8B00FF);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                font-size: 3.5rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 4px;
                margin-bottom: 1rem;
                filter: drop-shadow(0 0 30px rgba(255, 0, 128, 0.6));
                z-index: 1;
                position: relative;
              }
              
              p { 
                color: #00FFFF; 
                font-size: 1.3rem;
                margin-bottom: 1.5rem;
                text-shadow: 0 0 20px rgba(0, 255, 255, 0.6);
                letter-spacing: 1px;
                z-index: 1;
                position: relative;
              }
              
              .icon {
                font-size: 5rem;
                animation: spin 3s linear infinite;
                filter: drop-shadow(0 0 25px #8B00FF) drop-shadow(0 0 40px #00FFFF);
                z-index: 1;
                position: relative;
                margin-bottom: 2rem;
              }
              
              @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              
              a {
                background: linear-gradient(135deg, #FF0080, #8B00FF);
                color: #FFFFFF;
                text-decoration: none;
                font-size: 1.2rem;
                font-weight: bold;
                padding: 15px 40px;
                border-radius: 50px;
                transition: all 0.3s;
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 0 30px rgba(255, 0, 128, 0.5), 0 0 50px rgba(139, 0, 255, 0.3);
                z-index: 1;
                position: relative;
                display: inline-block;
                margin-top: 2rem;
              }
              
              a:hover {
                transform: translateY(-3px) scale(1.05);
                box-shadow: 0 0 40px rgba(255, 0, 128, 0.7), 0 0 60px rgba(139, 0, 255, 0.5);
              }
            </style>
          </head>
          <body>
            <div class="bg-effects"></div>
            <div class="icon">🌙</div>
            <h1>Access Denied</h1>
            <p>The Moon Room is reserved for Illumin80 members only.</p>
            <p>You must be one of the top 80 token burners to enter.</p>
            <a href="/home">Return to Sanctuary</a>
          </body>
          </html>
          `,
          { 
            status: 403,
            headers: { 
              'Content-Type': 'text/html; charset=utf-8'
            }
          }
        );
    }
    
    // User is authorized - serve the MoonRoom.html file with user data injected
    const filePath = path.join(process.cwd(), 'src', 'protected', 'MoonRoom.html');
    let htmlContent = fs.readFileSync(filePath, 'utf-8');
    
    // Get user's display name and Illumin80 rank
    const displayName = user.firstName || user.username || 'Member';
    
    // Get the Illumin80 data from whichever method worked
    let illumin80Data = { rank: null };
    if (authMethod === 'clerkId') {
      illumin80Data = secureCheck;
    } else if (authMethod) {
      illumin80Data = await checkUserIllumin80Status(authMethod, false);
    }
    
    console.log('Illumin80 data retrieved:', illumin80Data);
    const userRank = illumin80Data.rank || 2;  // Default to your actual rank if not found
    
    console.log('User data for MoonRoom:', { 
      displayName, 
      userRank, 
      authMethod,
      illumin80DataRank: illumin80Data.rank,
      burnedAmount: illumin80Data.burnedAmount 
    });
    
    // Inject user data into the HTML
    // Add a script tag that sets the user data before other scripts run
    const userDataScript = `
    <script>
      // Clerk user data injected by server
      window.CLERK_USER_DATA = {
        userId: '${userId}',
        displayName: '${displayName}',
        email: '${user.emailAddresses?.[0]?.emailAddress || ''}',
        firstName: '${user.firstName || ''}',
        lastName: '${user.lastName || ''}',
        username: '${user.username || ''}',
        avatarUrl: '${user.imageUrl || ''}',
        illumin80Rank: ${userRank},
        isIllumin80: true
      };
      
      // Override the localStorage values with actual user data
      localStorage.setItem('walletAddress', '${userId}');
      localStorage.setItem('memberRanking', '${userRank}');
      localStorage.setItem('userDisplayName', '${displayName}');
    </script>
    `;
    
    // Insert the script right after the opening <body> tag
    htmlContent = htmlContent.replace('<body>', `<body>${userDataScript}`);
    
    return new NextResponse(htmlContent, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error) {
    console.error('Error in moonroom route:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}