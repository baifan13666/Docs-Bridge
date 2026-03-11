# LangGraph Integration Guide for DocsBridge

**Purpose**: Guide for adding LangGraph workflow orchestration to DocsBridge
**Current Status**: Not implemented (Vercel AI SDK + minimal LangChain)
**Target**: Complex multi-step agent workflows

---

## Table of Contents

1. [Why Add LangGraph](#why-add-langgraph)
2. [Current Architecture](#current-architecture)
3. [Integration Strategy](#integration-strategy)
4. [Implementation Plan](#implementation-plan)
5. [File Structure Changes](#file-structure-changes)
6. [Example Workflows](#example-workflows)
7. [Migration Steps](#migration-steps)

---

## 1. Why Add LangGraph

### Current Limitations
- Linear RAG pipeline (even with parallelization)
- No conditional branching based on query type
- No multi-step reasoning workflows
- No agent-like behavior (tool calling, planning)
- No state management across complex workflows

### LangGraph Benefits
- **State Management**: Persistent state across workflow steps
- **Conditional Logic**: Branch based on intermediate results
- **Tool Integration**: Seamless tool calling and chaining
- **Error Recovery**: Retry and fallback mechanisms
- **Human-in-the-Loop**: Approval gates for sensitive operations
- **Complex Workflows**: Multi-agent collaboration patterns

---

## 2. Current Architecture

### What We Have
```
User Query → Parallel Pipeline → Dual Search → LLM Response
```

### What We Keep
- Vercel AI SDK for streaming responses
- Current embedding cache system
- Document chunking with LangChain TextSplitters
- Parallel preprocessing optimizations
---

## 3. Integration Strategy

### Hybrid Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│              (No changes required)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                 WORKFLOW ROUTER                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Simple Query   │  │ Complex Query   │                  │
│  │  (Current RAG)  │  │  (LangGraph)    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              EXECUTION ENGINES                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Vercel AI SDK  │  │   LangGraph     │                  │
│  │   (Streaming)   │  │  (Workflows)    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Query Classification
- **Simple**: Direct factual questions → Current RAG pipeline
- **Complex**: Multi-step reasoning, planning → LangGraph workflows
- **Tool-based**: Requires external API calls → LangGraph agents

---

## 4. Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Install LangGraph dependencies
- [ ] Create workflow router
- [ ] Implement basic graph structure
- [ ] Add state management schemas

### Phase 2: Core Workflows (Week 2-3)
- [ ] Document analysis workflow
- [ ] Multi-document comparison
- [ ] Application guidance workflow
- [ ] Eligibility checking workflow

### Phase 3: Advanced Features (Week 4)
- [ ] Human-in-the-loop approvals
- [ ] Error recovery mechanisms
- [ ] Workflow monitoring and logging
- [ ] Performance optimization

### Phase 4: Integration (Week 5)
- [ ] Frontend workflow visualization
- [ ] API endpoint updates
- [ ] Testing and validation
- [ ] Documentation updates
---

## 5. File Structure Changes

### New Directories
```
lib/
├── workflows/                    # LangGraph workflows
│   ├── index.ts                  # Workflow exports
│   ├── router.ts                 # Query classification & routing
│   ├── state.ts                  # State management schemas
│   ├── nodes/                    # Individual workflow nodes
│   │   ├── search.ts             # Document search node
│   │   ├── analyze.ts            # Document analysis node
│   │   ├── compare.ts            # Multi-doc comparison node
│   │   ├── synthesize.ts         # Information synthesis node
│   │   └── validate.ts           # Result validation node
│   ├── graphs/                   # Complete workflow graphs
│   │   ├── document-analysis.ts  # Analyze single document
│   │   ├── eligibility-check.ts  # Check user eligibility
│   │   ├── application-guide.ts  # Step-by-step guidance
│   │   └── multi-doc-compare.ts  # Compare multiple documents
│   └── tools/                    # External tools integration
│       ├── calculator.ts         # Eligibility calculations
│       ├── form-filler.ts        # Auto-fill applications
│       └── deadline-checker.ts   # Check important dates
```

### Modified Files
```
app/api/chat/query-stream/route.ts  # Add workflow routing
lib/rag/parallel-pipeline.ts        # Integration with workflows
components/chat/ChatInterface.tsx    # Workflow progress display
```

---

## 6. Example Workflows

### 6.1 Document Analysis Workflow
```typescript
// lib/workflows/graphs/document-analysis.ts
import { StateGraph } from "@langchain/langgraph";

interface DocumentAnalysisState {
  query: string;
  documents: Document[];
  analysis: DocumentAnalysis[];
  synthesis: string;
  confidence: number;
}

const workflow = new StateGraph<DocumentAnalysisState>({
  channels: {
    query: { value: null },
    documents: { value: [] },
    analysis: { value: [] },
    synthesis: { value: "" },
    confidence: { value: 0 }
  }
})
.addNode("search", searchDocuments)
.addNode("analyze", analyzeDocuments)
.addNode("synthesize", synthesizeResults)
.addNode("validate", validateResults)
.addEdge("search", "analyze")
.addEdge("analyze", "synthesize")
.addEdge("synthesize", "validate")
.setEntryPoint("search")
.setFinishPoint("validate");
```
### 6.2 Eligibility Checking Workflow
```typescript
// lib/workflows/graphs/eligibility-check.ts
interface EligibilityState {
  userProfile: UserProfile;
  requirements: Requirement[];
  checks: EligibilityCheck[];
  result: EligibilityResult;
  recommendations: string[];
}

const eligibilityWorkflow = new StateGraph<EligibilityState>({
  channels: {
    userProfile: { value: null },
    requirements: { value: [] },
    checks: { value: [] },
    result: { value: null },
    recommendations: { value: [] }
  }
})
.addNode("extractProfile", extractUserProfile)
.addNode("findRequirements", findRequirements)
.addNode("checkEligibility", checkEligibility)
.addNode("generateRecommendations", generateRecommendations)
.addConditionalEdges(
  "checkEligibility",
  (state) => state.result.eligible ? "generateRecommendations" : "findAlternatives"
)
.addNode("findAlternatives", findAlternatives);
```

### 6.3 Application Guidance Workflow
```typescript
// lib/workflows/graphs/application-guide.ts
interface ApplicationGuideState {
  serviceType: string;
  userSituation: UserSituation;
  steps: ApplicationStep[];
  currentStep: number;
  completedSteps: string[];
  nextActions: string[];
}

const applicationGuideWorkflow = new StateGraph<ApplicationGuideState>({
  channels: {
    serviceType: { value: "" },
    userSituation: { value: null },
    steps: { value: [] },
    currentStep: { value: 0 },
    completedSteps: { value: [] },
    nextActions: { value: [] }
  }
})
.addNode("identifyService", identifyService)
.addNode("assessSituation", assessSituation)
.addNode("generateSteps", generateSteps)
.addNode("prioritizeActions", prioritizeActions)
.addNode("checkDeadlines", checkDeadlines);
```

---

## 7. Migration Steps

### Step 1: Install Dependencies
```bash
npm install @langchain/langgraph @langchain/core
npm install @langchain/community  # For additional tools
```

### Step 2: Create Workflow Router
```typescript
// lib/workflows/router.ts
export async function routeQuery(query: string): Promise<'simple' | 'complex'> {
  // Use LLM to classify query complexity
  const classification = await classifyQuery(query);
  
  if (classification.requiresMultiStep || 
      classification.needsTools || 
      classification.hasConditionalLogic) {
    return 'complex';
  }
  
  return 'simple';
}
```
### Step 3: Update API Route
```typescript
// app/api/chat/query-stream/route.ts (additions)
import { routeQuery } from '@/lib/workflows/router';
import { executeWorkflow } from '@/lib/workflows';

export async function POST(request: NextRequest) {
  // ... existing code ...
  
  // Route query to appropriate execution engine
  const queryType = await routeQuery(query);
  
  if (queryType === 'complex') {
    // Use LangGraph workflow
    const workflowResult = await executeWorkflow(query, {
      userId: user?.id,
      conversationId,
      activeFolders
    });
    
    // Stream workflow progress
    for await (const step of workflowResult.stream) {
      sendEvent('workflow_step', {
        step: step.node,
        status: step.status,
        result: step.result
      });
    }
  } else {
    // Use existing RAG pipeline
    // ... existing parallel pipeline code ...
  }
}
```

### Step 4: Add State Management
```typescript
// lib/workflows/state.ts
import { z } from 'zod';

export const BaseWorkflowState = z.object({
  query: z.string(),
  userId: z.string().optional(),
  conversationId: z.string(),
  activeFolders: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  error: z.string().optional(),
  completed: z.boolean().default(false)
});

export const DocumentAnalysisState = BaseWorkflowState.extend({
  documents: z.array(z.any()).default([]),
  analysis: z.array(z.any()).default([]),
  synthesis: z.string().default(""),
  confidence: z.number().default(0)
});

export type DocumentAnalysisState = z.infer<typeof DocumentAnalysisState>;
```

### Step 5: Create Workflow Nodes
```typescript
// lib/workflows/nodes/search.ts
export async function searchDocuments(
  state: DocumentAnalysisState
): Promise<Partial<DocumentAnalysisState>> {
  const { query, userId, activeFolders } = state;
  
  // Use existing search functionality
  const searchResults = await executeDualEmbeddingSearch(
    supabase,
    userId!,
    originalEmbedding,
    rewrittenEmbedding,
    activeFolders
  );
  
  return {
    documents: searchResults
  };
}
```
---

## 8. Integration with Existing Systems

### 8.1 Preserve Current Performance
```typescript
// lib/workflows/nodes/parallel-search.ts
export async function parallelSearchNode(
  state: WorkflowState
): Promise<Partial<WorkflowState>> {
  // Reuse existing parallel pipeline for performance
  const pipelineResult = await executeParallelPipeline(
    state.query,
    state.userId!,
    state.conversationId
  );
  
  return {
    language: pipelineResult.language,
    rewrittenQuery: pipelineResult.rewrittenQuery,
    searchResults: pipelineResult.searchResults,
    structuredMemory: pipelineResult.structuredMemory
  };
}
```

### 8.2 Streaming Integration
```typescript
// lib/workflows/streaming.ts
export async function* streamWorkflow(
  workflow: CompiledGraph,
  initialState: any
) {
  for await (const step of workflow.stream(initialState)) {
    // Convert LangGraph events to SSE format
    yield {
      event: 'workflow_step',
      data: {
        node: step.node,
        status: step.status,
        result: step.result,
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### 8.3 Error Handling
```typescript
// lib/workflows/error-handling.ts
export function addErrorHandling(workflow: StateGraph) {
  return workflow
    .addNode("handleError", async (state) => {
      console.error('Workflow error:', state.error);
      
      // Fallback to simple RAG
      const fallbackResult = await executeParallelPipeline(
        state.query,
        state.userId,
        state.conversationId
      );
      
      return {
        completed: true,
        result: fallbackResult,
        fallbackUsed: true
      };
    })
    .addConditionalEdges(
      "START",
      (state) => state.error ? "handleError" : "continue"
    );
}
```

---

## 9. Frontend Integration

### 9.1 Workflow Progress Component
```typescript
// components/chat/WorkflowProgress.tsx
interface WorkflowStep {
  node: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  result?: any;
  timestamp: string;
}

export function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="workflow-progress">
      {steps.map((step, idx) => (
        <div key={idx} className={`step step-${step.status}`}>
          <div className="step-icon">
            {step.status === 'completed' && <CheckIcon />}
            {step.status === 'active' && <SpinnerIcon />}
            {step.status === 'error' && <ErrorIcon />}
          </div>
          <div className="step-content">
            <h4>{formatNodeName(step.node)}</h4>
            {step.result && (
              <p className="step-result">{step.result.summary}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```
### 9.2 Update Chat Interface
```typescript
// components/chat/ChatInterface.tsx (additions)
import { WorkflowProgress } from './WorkflowProgress';

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [isWorkflowActive, setIsWorkflowActive] = useState(false);
  
  // Handle workflow events
  useEffect(() => {
    const handleWorkflowStep = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.event === 'workflow_step') {
        setWorkflowSteps(prev => [...prev, data.data]);
        setIsWorkflowActive(true);
      }
      
      if (data.event === 'workflow_complete') {
        setIsWorkflowActive(false);
      }
    };
    
    // Add to existing SSE event listener
    eventSource.addEventListener('workflow_step', handleWorkflowStep);
    
    return () => {
      eventSource.removeEventListener('workflow_step', handleWorkflowStep);
    };
  }, []);
  
  return (
    <div className="chat-interface">
      {/* Existing chat UI */}
      
      {isWorkflowActive && (
        <div className="workflow-section">
          <h3>Processing your request...</h3>
          <WorkflowProgress steps={workflowSteps} />
        </div>
      )}
      
      {/* Rest of chat interface */}
    </div>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
// __tests__/workflows/document-analysis.test.ts
import { documentAnalysisWorkflow } from '@/lib/workflows/graphs/document-analysis';

describe('Document Analysis Workflow', () => {
  it('should analyze documents correctly', async () => {
    const initialState = {
      query: "What are the requirements for healthcare assistance?",
      userId: "test-user",
      conversationId: "test-conv"
    };
    
    const result = await documentAnalysisWorkflow.invoke(initialState);
    
    expect(result.completed).toBe(true);
    expect(result.analysis).toHaveLength(greaterThan(0));
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
```

### 10.2 Integration Tests
```typescript
// __tests__/api/workflow-integration.test.ts
describe('Workflow Integration', () => {
  it('should route complex queries to LangGraph', async () => {
    const response = await fetch('/api/chat/query-stream', {
      method: 'POST',
      body: JSON.stringify({
        query: "Compare healthcare benefits across different states and help me choose the best option for my family",
        conversation_id: "test-conv"
      })
    });
    
    const events = await parseSSEResponse(response);
    
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'workflow_step',
        data: expect.objectContaining({
          node: 'search'
        })
      })
    );
  });
});
```
---

## 11. Performance Considerations

### 11.1 Workflow Caching
```typescript
// lib/workflows/cache.ts
export class WorkflowCache {
  private cache = new Map<string, any>();
  
  async getCachedResult(
    workflowType: string,
    state: any
  ): Promise<any | null> {
    const key = this.generateKey(workflowType, state);
    return this.cache.get(key) || null;
  }
  
  async setCachedResult(
    workflowType: string,
    state: any,
    result: any
  ): Promise<void> {
    const key = this.generateKey(workflowType, state);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    });
  }
  
  private generateKey(workflowType: string, state: any): string {
    return `${workflowType}:${JSON.stringify(state)}`;
  }
}
```

### 11.2 Parallel Node Execution
```typescript
// lib/workflows/parallel.ts
export function createParallelWorkflow() {
  return new StateGraph()
    .addNode("parallel_start", async (state) => {
      // Split into parallel branches
      return {
        branch1: state,
        branch2: state,
        branch3: state
      };
    })
    .addNode("search_docs", searchDocuments)
    .addNode("analyze_user", analyzeUserProfile)
    .addNode("check_eligibility", checkEligibility)
    .addNode("merge_results", async (state) => {
      // Merge parallel results
      return {
        combinedResult: {
          documents: state.branch1.documents,
          userProfile: state.branch2.userProfile,
          eligibility: state.branch3.eligibility
        }
      };
    })
    // Parallel edges
    .addEdge("parallel_start", "search_docs")
    .addEdge("parallel_start", "analyze_user")
    .addEdge("parallel_start", "check_eligibility")
    .addEdge(["search_docs", "analyze_user", "check_eligibility"], "merge_results");
}
```

---

## 12. Monitoring and Observability

### 12.1 Workflow Metrics
```typescript
// lib/workflows/monitoring.ts
export class WorkflowMonitor {
  async trackWorkflowExecution(
    workflowType: string,
    executionId: string,
    metrics: {
      startTime: number;
      endTime: number;
      nodeExecutions: NodeExecution[];
      success: boolean;
      error?: string;
    }
  ) {
    // Log to monitoring service
    console.log(`[Workflow Monitor] ${workflowType}:${executionId}`, {
      duration: metrics.endTime - metrics.startTime,
      nodeCount: metrics.nodeExecutions.length,
      success: metrics.success,
      avgNodeTime: metrics.nodeExecutions.reduce((sum, node) => 
        sum + (node.endTime - node.startTime), 0) / metrics.nodeExecutions.length
    });
  }
}
```

### 12.2 Error Tracking
```typescript
// lib/workflows/error-tracking.ts
export function trackWorkflowError(
  workflowType: string,
  node: string,
  error: Error,
  state: any
) {
  console.error(`[Workflow Error] ${workflowType}:${node}`, {
    error: error.message,
    stack: error.stack,
    state: JSON.stringify(state, null, 2),
    timestamp: new Date().toISOString()
  });
  
  // Send to error tracking service (Sentry, etc.)
  // Sentry.captureException(error, { tags: { workflowType, node } });
}
```

---

## 13. Deployment Considerations

### 13.1 Environment Variables
```bash
# Add to .env.local
LANGGRAPH_ENABLED=true
WORKFLOW_CACHE_TTL=300000
WORKFLOW_MAX_EXECUTION_TIME=30000
WORKFLOW_PARALLEL_LIMIT=5
```

### 13.2 Feature Flags
```typescript
// lib/feature-flags.ts
export function isLangGraphEnabled(): boolean {
  return process.env.LANGGRAPH_ENABLED === 'true';
}

export function shouldUseWorkflow(query: string): boolean {
  if (!isLangGraphEnabled()) return false;
  
  // Additional logic for gradual rollout
  const userId = getCurrentUserId();
  return isUserInBeta(userId) || isComplexQuery(query);
}
```

---

## 14. Migration Checklist

### Pre-Migration
- [ ] Review current RAG performance metrics
- [ ] Identify complex query patterns that would benefit from workflows
- [ ] Set up monitoring and logging infrastructure
- [ ] Create feature flag system

### Implementation
- [ ] Install LangGraph dependencies
- [ ] Create workflow router and state schemas
- [ ] Implement core workflow nodes
- [ ] Add error handling and fallback mechanisms
- [ ] Update API routes with workflow integration
- [ ] Create frontend workflow progress components

### Testing
- [ ] Unit tests for individual workflow nodes
- [ ] Integration tests for complete workflows
- [ ] Performance testing vs current RAG pipeline
- [ ] User acceptance testing with complex queries

### Deployment
- [ ] Deploy with feature flag disabled
- [ ] Enable for beta users only
- [ ] Monitor performance and error rates
- [ ] Gradual rollout to all users
- [ ] Update documentation

---

**End of LangGraph Integration Guide**

*This guide provides a comprehensive roadmap for adding LangGraph workflow orchestration to DocsBridge while preserving the current high-performance RAG pipeline for simple queries.*