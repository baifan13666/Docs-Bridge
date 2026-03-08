-- Add usage tracking to user_plans table
ALTER TABLE public.user_plans
ADD COLUMN IF NOT EXISTS messages_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_limit INTEGER NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cycle_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS cycle_end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

-- Update existing records with default limits based on plan type
UPDATE public.user_plans
SET 
  messages_limit = CASE 
    WHEN plan_type = 'free' THEN 100
    WHEN plan_type = 'pro' THEN 1000
    WHEN plan_type = 'business' THEN 10000
    ELSE 100
  END,
  cycle_end_date = cycle_start_date + INTERVAL '30 days'
WHERE messages_limit = 100; -- Only update if not already set

-- Create function to reset usage cycle
CREATE OR REPLACE FUNCTION public.reset_usage_cycle()
RETURNS void AS $$
BEGIN
  UPDATE public.user_plans
  SET 
    messages_used = 0,
    tokens_used = 0,
    cycle_start_date = NOW(),
    cycle_end_date = NOW() + INTERVAL '30 days'
  WHERE cycle_end_date < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment message usage
CREATE OR REPLACE FUNCTION public.increment_message_usage(
  p_user_id UUID,
  p_tokens_used INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check if cycle needs reset
  PERFORM reset_usage_cycle();
  
  -- Increment usage
  UPDATE public.user_plans
  SET 
    messages_used = messages_used + 1,
    tokens_used = tokens_used + p_tokens_used,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING jsonb_build_object(
    'messages_used', messages_used,
    'messages_limit', messages_limit,
    'tokens_used', tokens_used,
    'cycle_end_date', cycle_end_date
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can send message
CREATE OR REPLACE FUNCTION public.can_send_message(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_messages_used INTEGER;
  v_messages_limit INTEGER;
BEGIN
  -- Check if cycle needs reset
  PERFORM reset_usage_cycle();
  
  SELECT messages_used, messages_limit
  INTO v_messages_used, v_messages_limit
  FROM public.user_plans
  WHERE user_id = p_user_id;
  
  RETURN v_messages_used < v_messages_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_plans_cycle_end ON public.user_plans(cycle_end_date);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reset_usage_cycle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_message_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_message(UUID) TO authenticated;
