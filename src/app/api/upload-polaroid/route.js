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
    const filename = `polaroids/${timestamp}-${randomId}.jpg`;
    
    console.log('[Upload API] Attempting to upload to Firebase Storage:', filename);

    // Upload to Firebase Storage using REST API
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
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
    
    // Skip creating a polaroids document - the client will update the offerings document
    // This prevents duplicate data in two collections
    console.log('[Upload API] Skipping polaroids collection - client will update offerings');
    
    // Just return the storage URL so the client can update the offering
    
    return NextResponse.json({
      success: true,
      storageUrl: publicUrl,
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