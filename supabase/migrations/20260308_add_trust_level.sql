-- Add trust_level field to kb_documents for confidence scoring
-- Government documents = 1.0, user documents = 0.7

ALTER TABLE public.kb_documents
ADD COLUMN IF NOT EXISTS trust_level DECIMAL(3,2) DEFAULT 0.70;

-- Update existing government documents to have trust_level = 1.0
UPDATE public.kb_documents
SET trust_level = 1.00
WHERE document_type = 'gov_crawled';

-- Add comment
COMMENT ON COLUMN public.kb_documents.trust_level IS 
'Trust level for confidence scoring: 1.0 for government docs, 0.7 for user docs';

-- Create trigger to auto-set trust_level based on document_type
CREATE OR REPLACE FUNCTION public.set_document_trust_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_type = 'gov_crawled' THEN
    NEW.trust_level = 1.00;
  ELSE
    NEW.trust_level = 0.70;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_document_trust_level_trigger ON public.kb_documents;
CREATE TRIGGER set_document_trust_level_trigger
  BEFORE INSERT OR UPDATE OF document_type ON public.kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_trust_level();
