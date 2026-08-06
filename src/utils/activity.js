import { supabase } from '../../lib/supabase';

export async function logActivity(caseId, actionType, description) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || supabase.auth.currentUser?.id;
    if (!userId) return;

    // Fetch user's firm ID if they belong to one
    const { data: memberData } = await supabase
      .from('firm_members')
      .select('firm_id')
      .eq('user_id', userId)
      .maybeSingle();

    await supabase.from('case_activities').insert({
      case_id: caseId,
      user_id: userId,
      firm_id: memberData?.firm_id || null,
      action_type: actionType,
      description: description,
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}
