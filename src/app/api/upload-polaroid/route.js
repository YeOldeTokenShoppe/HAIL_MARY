// app/api/upload-polaroid/route.js
// Simple Node.js runtime version using Firebase REST APIs

import { NextResponse } from 'next/server';

// Remove edge runtime to use Node.js runtime
// export const runtime = 'edge';

export async function POST(request) {
  try {
    const body = await request.json();
    const { imageData, metadata } = body;
    
    console.log('[Upload API] Received request with metadata:', metadata);
    
    if (!imageData) {
      console.error('[Upload API] No image data provided');
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Get Firebase config from environment variables
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    
    if (!projectId || !storageBucket || !apiKey) {
      console.error('[Upload API] Missing Firebase configuration', {
        projectId: !!projectId,
        storageBucket: !!storageBucket,
        apiKey: !!apiKey
      });
      return NextResponse.json(
        { error: 'Firebase configuration missing' },
        { status: 503 }
      );
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `polaroids/${timestamp}-${randomId}.png`;
    
    console.log('[Upload API] Attempting to upload to Firebase Storage:', filename);

    // Upload to Firebase Storage using REST API
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
      },
      body: buffer,
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Upload API] Storage upload failed:', errorText);
      return NextResponse.json(
        { error: 'Storage upload failed', details: errorText },
        { status: uploadResponse.status }
      );
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('[Upload API] Upload successful:', uploadResult.name);
    
    // Generate public URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filename)}?alt=media`;
    
    // Save to Firestore using REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/polaroids?key=${apiKey}`;
    
    const firestoreDoc = {
      fields: {
        imageUrl: { stringValue: publicUrl },
        storagePath: { stringValue: filename },
        username: { stringValue: metadata?.username || 'Anonymous' },
        devotionType: { stringValue: metadata?.devotionType || 'candle' },
        background: { stringValue: metadata?.background || '' },
        burnedAmount: { stringValue: String(metadata?.burnedAmount || '0') },
        tattooDesign: { stringValue: metadata?.tattooDesign || '' },
        tattooCharacter: { stringValue: metadata?.tattooCharacter || '' },
        candleType: { stringValue: metadata?.candleType || '' },
        baseColor: { stringValue: metadata?.baseColor || '' },
        createdAt: { timestampValue: new Date().toISOString() },
      }
    };
    
    const firestoreResponse = await fetch(firestoreUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: firestoreDoc.fields }),
    });
    
    if (!firestoreResponse.ok) {
      const errorText = await firestoreResponse.text();
      console.error('[Upload API] Firestore save failed:', errorText);
      // Continue anyway since the image was uploaded
    }
    
    const firestoreResult = await firestoreResponse.json();
    const docId = firestoreResult.name?.split('/').pop() || 'unknown';
    
    console.log('[Upload API] Successfully saved to Firebase');
    
    return NextResponse.json({
      success: true,
      storageUrl: publicUrl,
      docId: docId,
      storagePath: filename,
    });

  } catch (error) {
    console.error('[Upload API] Upload error:', error);
    console.error('[Upload API] Error stack:', error.stack);
    console.error('[Upload API] Error details:', {
      name: error.name,
      message: error.message,
    });
    return NextResponse.json(
      { 
        error: 'Upload failed', 
        message: error.message,
        details: error.name 
      },
      { status: 500 }
    );
  }
}