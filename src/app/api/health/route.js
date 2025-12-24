export async function GET() {
  const envCheck = {
    hasClerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
    hasThirdweb: !!process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    nodeEnv: process.env.NODE_ENV,
    // Don't expose actual values for security
    clerkKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 10) || 'not-found',
  };

  return Response.json({
    status: 'ok',
    environment: envCheck,
    timestamp: new Date().toISOString()
  });
}