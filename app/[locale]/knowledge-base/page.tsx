import { createClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/supabase/getUserPlan';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/chat/Sidebar';
import KnowledgeBaseInterface from '@/components/knowledge-base/KnowledgeBaseInterface';

export default async function KnowledgeBasePage({
  searchParams
}: {
  searchParams: Promise<{ doc?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Check if user is authenticated and has pro/business plan
  if (!user) {
    redirect('/');
  }
  
  const userPlan = await getUserPlan();
  
  if (userPlan === 'free') {
    redirect('/');
  }

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';

  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;
  const documentId = params.doc;

  return (
    <div className="bg-(--color-bg-primary) text-(--color-text-primary) h-screen flex font-sans antialiased overflow-hidden">
      <Sidebar 
        isAuthenticated={true} 
        userEmail={user.email}
        userName={userName}
        userAvatar={userAvatar}
        userPlan={userPlan}
      />
      <KnowledgeBaseInterface 
        userEmail={user.email} 
        userName={userName}
        initialDocumentId={documentId}
      />
    </div>
  );
}
