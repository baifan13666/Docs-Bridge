---
inclusion: always
---

# Skeleton Loading & Animation Rules

This document defines the standards for implementing skeleton loading states and animations throughout the application to ensure a smooth, professional user experience.

## Core Principles

1. **Never show blank screens** - Always provide visual feedback during data loading
2. **Maintain layout stability** - Skeleton placeholders should match the final content dimensions
3. **Smooth transitions** - Use fade-in animations when transitioning from skeleton to real data
4. **Consistent timing** - Use standardized animation durations across the app

---

## Available Skeleton Components

Location: `components/ui/Skeleton.tsx`

### Base Component

```tsx
import { Skeleton } from '@/components/ui/Skeleton';

<Skeleton 
  variant="rectangular" // or "text" | "circular"
  width={200}
  height={40}
  animation="pulse" // or "wave" | "none"
  className="custom-classes"
/>
```

### Preset Components

Use these for common UI patterns:

```tsx
import { 
  FolderSkeleton,
  DocumentSkeleton,
  ConversationSkeleton,
  AttachmentSkeleton,
  MessageSkeleton 
} from '@/components/ui/Skeleton';

// Example: Loading folders
{loading ? (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => <FolderSkeleton key={i} />)}
  </div>
) : (
  folders.map(folder => <FolderItem key={folder.id} {...folder} />)
)}
```

---

## Animation Classes

Location: `app/globals.css`

### Available Animations

1. **Shimmer Effect** (for skeletons)
   ```css
   .animate-shimmer
   ```
   - 2s infinite linear animation
   - Gradient moves from left to right
   - Use for skeleton loading states

2. **Fade In** (for loaded content)
   ```css
   .animate-fadeIn
   ```
   - 0.3s ease-out animation
   - Opacity: 0 → 1
   - Transform: translateY(4px) → translateY(0)
   - Use when real data appears

3. **Pulse** (built-in Tailwind)
   ```css
   .animate-pulse
   ```
   - Simple opacity animation
   - Use for simple loading indicators

---

## Implementation Pattern

### Step 1: Add Loading State

```tsx
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadData() {
    try {
      setLoading(true);
      const result = await fetchData();
      setData(result);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  loadData();
}, []);
```

### Step 2: Render Skeleton or Data

```tsx
return (
  <div>
    {loading ? (
      // Skeleton state
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonComponent key={i} />
        ))}
      </div>
    ) : (
      // Real data with fade-in animation
      data.map((item) => (
        <div key={item.id} className="animate-fadeIn">
          <RealComponent {...item} />
        </div>
      ))
    )}
  </div>
);
```

### Step 3: Pass Loading State to Child Components

```tsx
// Parent component
<ChildList 
  items={items}
  loading={loading}
  onSelect={handleSelect}
/>

// Child component
interface ChildListProps {
  items: Item[];
  loading?: boolean;
  onSelect: (item: Item) => void;
}

export default function ChildList({ items, loading = false, onSelect }: ChildListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <ItemSkeleton key={i} />)}
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="animate-fadeIn">
          <ItemComponent item={item} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: List Loading

```tsx
// Folders, Documents, Conversations, etc.
{loading ? (
  <div className="space-y-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <ItemSkeleton key={i} />
    ))}
  </div>
) : (
  items.map((item) => (
    <div key={item.id} className="animate-fadeIn">
      <Item {...item} />
    </div>
  ))
)}
```

### Pattern 2: Conditional Loading (Show if loading OR has data)

```tsx
// Attachments section
{(items.length > 0 || loading) && (
  <div className="mt-8">
    <h3>Items ({loading ? '...' : items.length})</h3>
    <div className="grid gap-3">
      {loading ? (
        <>
          <ItemSkeleton />
          <ItemSkeleton />
        </>
      ) : (
        items.map((item) => (
          <div key={item.id} className="animate-fadeIn">
            <Item {...item} />
          </div>
        ))
      )}
    </div>
  </div>
)}
```

### Pattern 3: Separate Loading States

```tsx
// When you have multiple independent data sources
const [folders, setFolders] = useState<Folder[]>([]);
const [documents, setDocuments] = useState<Document[]>([]);
const [loadingFolders, setLoadingFolders] = useState(true);
const [loadingDocuments, setLoadingDocuments] = useState(false);

// Load folders on mount
useEffect(() => {
  loadFolders();
}, []);

// Load documents when folder changes
useEffect(() => {
  if (selectedFolder) {
    loadDocuments(selectedFolder.id);
  }
}, [selectedFolder]);

async function loadFolders() {
  try {
    setLoadingFolders(true);
    const data = await fetchFolders();
    setFolders(data);
  } finally {
    setLoadingFolders(false);
  }
}

async function loadDocuments(folderId: string) {
  try {
    setLoadingDocuments(true);
    const data = await fetchDocuments(folderId);
    setDocuments(data);
  } finally {
    setLoadingDocuments(false);
  }
}
```

### Pattern 4: Full Page Loading

```tsx
// For initial page load
if (loading) {
  return (
    <div className="flex-1 flex items-center justify-center bg-(--color-bg-primary)">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-(--color-accent) border-t-transparent animate-spin"></div>
        <p className="text-(--color-text-secondary)">Loading...</p>
      </div>
    </div>
  );
}
```

---

## Skeleton Count Guidelines

Choose the number of skeleton items based on typical content:

- **Folders**: 3-4 skeletons
- **Documents**: 4-5 skeletons
- **Conversations**: 5-6 skeletons
- **Attachments**: 2-3 skeletons
- **Messages**: 2-3 skeletons

---

## Animation Timing Standards

| Animation | Duration | Easing | Use Case |
|-----------|----------|--------|----------|
| Fade In | 300ms | ease-out | Content appearing |
| Shimmer | 2000ms | linear | Skeleton loading |
| Pulse | 2000ms | cubic-bezier | Simple loading |
| Spin | 1000ms | linear | Spinner icons |

---

## Checklist for New Components

When creating a new component that loads data:

- [ ] Add loading state: `const [loading, setLoading] = useState(true)`
- [ ] Set loading to `true` before fetch
- [ ] Set loading to `false` in `finally` block
- [ ] Create or use existing skeleton component
- [ ] Render skeleton when `loading === true`
- [ ] Add `animate-fadeIn` class to real data elements
- [ ] Pass loading state to child components if needed
- [ ] Test loading state by adding artificial delay

---

## Examples in Codebase

Reference these files for implementation examples:

1. **FolderList.tsx** - List with skeleton loading
2. **DocumentList.tsx** - List with skeleton loading
3. **DocumentEditor.tsx** - Conditional section loading (attachments)
4. **KnowledgeBaseInterface.tsx** - Multiple loading states
5. **Sidebar.tsx** - Conversation list loading

---

## Testing Loading States

### During Development

Add artificial delay to test loading states:

```tsx
async function loadData() {
  try {
    setLoading(true);
    
    // Add delay for testing (REMOVE IN PRODUCTION)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const data = await fetchData();
    setData(data);
  } finally {
    setLoading(false);
  }
}
```

### What to Test

1. Skeleton appears immediately
2. Layout doesn't shift when data loads
3. Fade-in animation is smooth
4. Loading state handles errors gracefully
5. Multiple rapid loads don't cause flickering

---

## Common Mistakes to Avoid

### ❌ DON'T: Show blank screen while loading

```tsx
// BAD
{!loading && items.map(item => <Item {...item} />)}
```

### ✅ DO: Show skeleton while loading

```tsx
// GOOD
{loading ? (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => <ItemSkeleton key={i} />)}
  </div>
) : (
  items.map(item => <Item key={item.id} {...item} />)
)}
```

### ❌ DON'T: Forget fade-in animation

```tsx
// BAD
{items.map(item => <Item key={item.id} {...item} />)}
```

### ✅ DO: Add fade-in animation

```tsx
// GOOD
{items.map(item => (
  <div key={item.id} className="animate-fadeIn">
    <Item {...item} />
  </div>
))}
```

### ❌ DON'T: Use wrong skeleton count

```tsx
// BAD - Too many skeletons for small lists
{[1,2,3,4,5,6,7,8,9,10].map(i => <Skeleton key={i} />)}
```

### ✅ DO: Match expected content count

```tsx
// GOOD - Reasonable number
{[1,2,3,4].map(i => <Skeleton key={i} />)}
```

### ❌ DON'T: Forget to reset loading state

```tsx
// BAD - Loading state never resets on error
async function loadData() {
  setLoading(true);
  const data = await fetchData();
  setData(data);
  setLoading(false); // Won't run if error occurs
}
```

### ✅ DO: Use finally block

```tsx
// GOOD - Always resets loading state
async function loadData() {
  try {
    setLoading(true);
    const data = await fetchData();
    setData(data);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false); // Always runs
  }
}
```

---

## Performance Considerations

1. **Skeleton components are lightweight** - They're just styled divs, no performance impact
2. **Limit skeleton count** - Don't render 100 skeletons for a paginated list
3. **Reuse skeleton components** - Don't create new ones for every use case
4. **CSS animations are performant** - They use GPU acceleration
5. **Avoid layout shifts** - Skeleton dimensions should match real content

---

## Accessibility

1. **Add ARIA labels** to loading states:
   ```tsx
   <div role="status" aria-live="polite" aria-label="Loading content">
     <Skeleton />
   </div>
   ```

2. **Announce when content loads**:
   ```tsx
   {!loading && (
     <div role="status" aria-live="polite" className="sr-only">
       Content loaded
     </div>
   )}
   ```

3. **Respect prefers-reduced-motion**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .animate-fadeIn,
     .animate-shimmer {
       animation: none;
     }
   }
   ```

---

## Summary

- **Always show skeleton loading** for data fetching
- **Use animate-fadeIn** when real data appears
- **Separate loading states** for independent data sources
- **Match skeleton count** to expected content
- **Test loading states** during development
- **Use finally blocks** to ensure loading state resets

Following these rules ensures a professional, smooth user experience throughout the application.
