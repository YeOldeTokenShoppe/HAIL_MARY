// app/api/upload-polaroid/route.js
// Simple Node.js runtime version using Firebase REST APIs

import { NextResponse } from 'next/server';
// Firestore writes use the ADMIN SDK (bypasses security rules). The client SDK
// can't write here: `polaroids` is `write: if false` and the catch-all denies by
// default, so a client-SDK write would be silently rejected.
import { getAdminDb } from '@/lib/firebaseAdmin';

// Remove edge runtime to use Node.js runtime
// export const runtime = 'edge';

export async function POST(request) {
  try {
    const body = await request.json();
    const { imageData, metadata, password } = body;
    
    console.log('[Upload API] Received request with metadata:', metadata);
    
    if (!imageData) {
      console.error('[Upload API] No image data provided');
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Admin "Publish to Feed" (approved=true) is password-gated. Validate up front,
    // BEFORE the storage upload, so an unauthorized request can't orphan an image.
    const wantApprove = metadata && typeof metadata === 'object' && metadata.approved === true;
    if (wantApprove && (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 403 });
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

    // Detect image type from data URL
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = contentType === 'image/webp' ? 'webp' : contentType === 'image/png' ? 'png' : 'jpg';

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const filename = `polaroids/${timestamp}-${randomId}.${ext}`;

    console.log('[Upload API] Attempting to upload to Firebase Storage:', filename);

    // Upload to Firebase Storage using REST API
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?uploadType=media&name=${encodeURIComponent(filename)}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
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
    
    // Normalize the optional event metadata sent by auto-captures (gusher/hell).
    // Everything is sanitized + length-capped: the client is untrusted, and these
    // fields can end up rendered in a public feed.
    const meta = metadata && typeof metadata === 'object' ? metadata : {};
    const clampStr = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const eventType = ['gusher', 'hell', 'showcase'].includes(meta.eventType) ? meta.eventType : null;

    // `approved: true` is the ONLY way an entry becomes publicly visible, and it
    // was already password-validated above. Auto-captures never send `approved`,
    // so they stay `false` (a private backlog).
    const approved = wantApprove;

    const feedMeta = {
      eventType,
      userId: clampStr(meta.userId, 128),
      username: clampStr(meta.username, 40) || 'A Prospector',
      col: num(meta.col),
      row: num(meta.row),
      oilAmount: num(meta.oilAmount),
      caption: clampStr(meta.caption, 140),
      referralCode: clampStr(meta.referralCode, 32),
    };

    // Save metadata to Firestore (admin SDK) for Twitter Card OG tags
    let snapshotId = randomId;
    try {
      const adb = getAdminDb();
      if (adb) {
        await adb.collection('polaroids').doc(randomId).set({
          storageUrl: publicUrl,
          storagePath: filename,
          createdAt: new Date().toISOString(),
          ...feedMeta,
        });
        console.log('[Upload API] Saved polaroid doc:', randomId);

        // Feed entries: milestone auto-captures (gusher/hell) land as an
        // unapproved private backlog (`approved: false`); admin "Publish to Feed"
        // writes an approved, publicly-visible entry. A rig render can contain a
        // player's custom sign art, so only password-gated approval makes it live.
        if (eventType || approved) {
          try {
            await adb.collection('oilFeed').add({
              ...feedMeta,
              snapshotId: randomId,
              storageUrl: publicUrl,
              storagePath: filename,
              approved,
              createdAt: new Date().toISOString(),
              createdAtMs: Date.now(),
            });
            console.log('[Upload API] Saved oilFeed entry:', eventType || 'custom', 'approved=' + approved, randomId);
          } catch (feedErr) {
            console.error('[Upload API] Failed to write oilFeed doc:', feedErr.message);
            // Non-fatal — the image + polaroid doc are already saved.
          }
        }
      } else {
        console.warn('[Upload API] Firestore not available, skipping doc creation');
      }
    } catch (firestoreErr) {
      console.error('[Upload API] Failed to save polaroid doc:', firestoreErr.message);
      // Non-fatal — still return the upload result
    }

    return NextResponse.json({
      success: true,
      storageUrl: publicUrl,
      storagePath: filename,
      snapshotId,
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