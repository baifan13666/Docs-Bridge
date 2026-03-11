/**
 * Client Embedding API Route
 * 
 * This is a fallback route for browsers that don't support Web Workers
 * or when client-side embedding fails
 * 
 * NOTE: This returns an error directing users to use client-side generation
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }
    
    // Return error - client should use Web Worker
    return NextResponse.json(
      { 
        error: 'Client-side embedding should be used',
        message: 'Please use the Web Worker for embedding generation in the browser. See CLIENT_EMBEDDING_GUIDE.md for details.',
        useClientSide: true,
      },
      { status: 410 } // Gone
    );
    
  } catch (error) {
    console.error('[Client Embedding API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
