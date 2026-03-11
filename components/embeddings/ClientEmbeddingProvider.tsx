/**
 * Client Embedding Provider Component
 * 
 * Provides embedding generation functionality to child components
 * Shows loading progress and handles errors
 */

'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useClientEmbedding, UseClientEmbeddingReturn } from '@/hooks/useClientEmbedding';

const ClientEmbeddingContext = createContext<UseClientEmbeddingReturn | null>(null);

export function useClientEmbeddingContext() {
  const context = useContext(ClientEmbeddingContext);
  if (!context) {
    throw new Error('useClientEmbeddingContext must be used within ClientEmbeddingProvider');
  }
  return context;
}

interface ClientEmbeddingProviderProps {
  children: ReactNode;
  showProgress?: boolean;
}

export function ClientEmbeddingProvider({ 
  children, 
  showProgress = true 
}: ClientEmbeddingProviderProps) {
  const embedding = useClientEmbedding();
  
  return (
    <ClientEmbeddingContext.Provider value={embedding}>
      {showProgress && embedding.progress && (
        <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 max-w-sm z-50">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Loading embedding model...
              </p>
              {embedding.progress.file && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {embedding.progress.file}
                </p>
              )}
              {embedding.progress.progress !== undefined && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${embedding.progress.progress * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {Math.round(embedding.progress.progress * 100)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {embedding.error && (
        <div className="fixed top-4 right-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-sm z-50">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Embedding Error
              </p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                {embedding.error}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {children}
    </ClientEmbeddingContext.Provider>
  );
}
