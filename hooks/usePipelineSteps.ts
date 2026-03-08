import { useState } from 'react';

interface PipelineStep {
  id: number;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  result?: string;
  visible: boolean; // New field to control visibility
}

const ALL_STEPS: PipelineStep[] = [
  { id: 1, name: 'Language Detection', status: 'pending', visible: false },
  { id: 2, name: 'Query Optimization', status: 'pending', visible: false },
  { id: 3, name: 'Embedding Generation', status: 'pending', visible: false },
  { id: 4, name: 'Coarse Search', status: 'pending', visible: false },
  { id: 5, name: 'Reranking', status: 'pending', visible: false },
  { id: 6, name: 'Context Building', status: 'pending', visible: false },
  { id: 7, name: 'LLM Generation', status: 'pending', visible: false },
];

export function usePipelineSteps() {
  const [steps, setSteps] = useState<PipelineStep[]>(ALL_STEPS);
  const [showPipeline, setShowPipeline] = useState(false);

  function updateStep(
    stepId: number,
    status: 'pending' | 'active' | 'completed' | 'skipped',
    result?: string
  ) {
    console.log('[usePipelineSteps] updateStep called:', { stepId, status, result });
    setSteps(prev => {
      const updated = prev.map(step => 
        step.id === stepId 
          ? { ...step, status, result, visible: true } // Make step visible when updated
          : step
      );
      console.log('[usePipelineSteps] Updated steps:', updated);
      return updated;
    });
  }

  function resetSteps() {
    console.log('[usePipelineSteps] resetSteps called');
    setSteps(ALL_STEPS.map(step => ({ 
      ...step, 
      status: 'pending' as const, 
      result: undefined,
      visible: false // Hide all steps on reset
    })));
  }

  function showPipelineUI() {
    console.log('[usePipelineSteps] showPipelineUI called');
    setShowPipeline(true);
  }

  function hidePipelineUI() {
    console.log('[usePipelineSteps] hidePipelineUI called');
    setShowPipeline(false);
  }

  function hidePipelineAfterDelay(delay: number = 2000) {
    console.log('[usePipelineSteps] hidePipelineAfterDelay called, delay:', delay);
    setTimeout(() => setShowPipeline(false), delay);
  }

  const visibleSteps = steps.filter(step => step.visible) || [];
  console.log('[usePipelineSteps] Returning visible steps:', visibleSteps.length, 'showPipeline:', showPipeline);

  return {
    steps: visibleSteps,
    showPipeline,
    updateStep,
    resetSteps,
    showPipelineUI,
    hidePipelineUI,
    hidePipelineAfterDelay
  };
}
