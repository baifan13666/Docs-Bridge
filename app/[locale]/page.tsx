import { createClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/supabase/getUserPlan';
import ChatPage from '@/components/chat/ChatPage';

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
