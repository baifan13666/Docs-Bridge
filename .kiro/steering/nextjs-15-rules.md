# Next.js 15 Development Rules

This document contains important rules and patterns specific to Next.js 15 that must be followed in this project.

## Dynamic Route Parameters

### CRITICAL: params is now a Promise

In Next.js 15, route parameters (`params`) in dynamic routes are now **asynchronous** and must be awaited before accessing their properties.

### CRITICAL: searchParams is also a Promise

In Next.js 15, `searchParams` in page components is also **asynchronous** and must be awaited before accessing its properties.

#### ❌ WRONG (Next.js 14 and earlier)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id; // ERROR: params.id is not accessible synchronously
  // ...
}
```

#### ✅ CORRECT (Next.js 15)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Must await params first
  // Now you can use id
  // ...
}
```

### Pattern for All HTTP Methods

Apply this pattern to ALL route handlers (GET, POST, PATCH, PUT, DELETE) in dynamic routes:

```typescript
// app/api/resource/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Use id here
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  // Use id and body here
}

export async function DELETE(
  _request: NextRequest, // Prefix with _ if unused
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Use id here
}
```

### Multiple Dynamic Segments

For routes with multiple dynamic segments:

```typescript
// app/api/[category]/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string; id: string }> }
) {
  const { category, id } = await params;
  // Use both category and id
}
```

### Catch-All Routes

For catch-all routes:

```typescript
// app/api/[...slug]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  // slug is an array of path segments
}
```

---

## Page Components with searchParams

### CRITICAL: searchParams is now a Promise

In Next.js 15, `searchParams` in page components is now **asynchronous** and must be awaited.

#### ❌ WRONG (Next.js 14 and earlier)

```typescript
export default async function Page({ 
  searchParams 
}: { 
  searchParams: { query?: string } 
}) {
  const query = searchParams.query; // ERROR: searchParams.query not accessible
  // ...
}
```

#### ✅ CORRECT (Next.js 15)

```typescript
export default async function Page({ 
  searchParams 
}: { 
  searchParams: Promise<{ query?: string }> 
}) {
  const params = await searchParams; // Must await searchParams first
  const query = params.query; // Now you can use it
  // ...
}
```

### Real Example from This Project

```typescript
// app/[locale]/page.tsx
export default async function Home({ 
  searchParams 
}: { 
  searchParams: Promise<{ conversation?: string }> 
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;
  const conversationId = params.conversation;
  
  return (
    <ChatInterface conversationId={conversationId} />
  );
}
```

## Error Message

If you see this error:

```
Error: Route "/api/resource/[id]" used `params.id`. 
`params` is a Promise and must be unwrapped with `await` or `React.use()` 
before accessing its properties.
```

**Solution:** Change the params type to `Promise<{ id: string }>` and await it before use.

If you see this error:

```
Error: Route "/[locale]" used `searchParams.conversation`. 
`searchParams` is a Promise and must be unwrapped with `await` or `React.use()` 
before accessing its properties.
```

**Solution:** Change the searchParams type to `Promise<{ conversation?: string }>` and await it before use.

## Checklist for Dynamic Routes

When creating or updating dynamic route handlers:

- [ ] Change params type from `{ id: string }` to `Promise<{ id: string }>`
- [ ] Add `const { id } = await params;` at the start of the function
- [ ] Replace all `params.id` references with the destructured `id` variable
- [ ] Apply to ALL HTTP methods in the file (GET, POST, PATCH, PUT, DELETE)
- [ ] If request parameter is unused, prefix with underscore: `_request`

## Checklist for Page Components with searchParams

When creating or updating page components that use searchParams:

- [ ] Change searchParams type from `{ key?: string }` to `Promise<{ key?: string }>`
- [ ] Add `const params = await searchParams;` at the start of the function
- [ ] Replace all `searchParams.key` references with `params.key`

## Related Files in This Project

The following files have been updated to follow this pattern:

**API Routes (params)**:
- `app/api/kb/folders/[id]/route.ts`
- `app/api/kb/documents/[id]/route.ts`
- `app/api/chat/conversations/[id]/route.ts`

**Page Components (searchParams)**:
- `app/[locale]/page.tsx`

Use these as reference examples for any new dynamic routes or pages.
