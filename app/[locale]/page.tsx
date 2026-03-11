import { createClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/supabase/getUserPlan';
import dynamic from 'next/dynamic';

// Dynamically import ChatPage to avoid server-side bundling of client dependencies
const ChatPage = dynamic(() => import('@/components/chat/ChatPage'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  ),
});

export default async function Home({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Await searchParams (Next.js 15 requirement)
    const params = await searchParams;
    
    // Get user plan from database
    const userPlan = await getUserPlan();
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
    const conversationId = params.conversation;

    return (
        <ChatPage
            isAuthenticated={!!user}
            userEmail={user?.email}
            userName={userName}
            userAvatar={userAvatar}
            userPlan={userPlan}
            conversationId={conversationId}
        />
    );
}
