---
inclusion: auto
fileMatchPattern: "**/*.{tsx,ts,jsx,js}"
---

# Internationalization (i18n) and Styling Rules

## 🌍 Internationalization Rules

### Rule 1: NO Hardcoded Text Strings

**❌ NEVER DO THIS:**
```tsx
<button>Save Changes</button>
<h1>Welcome to DocsBridge</h1>
<p>You have 5 messages</p>
```

**✅ ALWAYS DO THIS:**
```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations();

<button>{t('common.save')}</button>
<h1>{t('chat.welcome')}</h1>
<p>{t('chat.messageCount', { count: 5 })}</p>
```

### Rule 2: Add Translation Keys BEFORE Using Them

**Workflow:**
1. **First:** Add the key to `messages/en.json`
2. **Then:** Use the key in your component

**Example:**

**Step 1 - Add to `messages/en.json`:**
```json
{
  "myFeature": {
    "title": "My New Feature",
    "description": "This is a description",
    "button": "Click Me"
  }
}
```

**Step 2 - Use in component:**
```tsx
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <button>{t('myFeature.button')}</button>
    </div>
  );
}
```

### Rule 3: Use Dynamic Values for Personalization

**For dynamic content:**
```json
{
  "greeting": "Hello, {name}!",
  "itemCount": "You have {count} items",
  "deadline": "Due on {date}"
}
```

**Usage:**
```tsx
<p>{t('greeting', { name: userName })}</p>
<p>{t('itemCount', { count: items.length })}</p>
<p>{t('deadline', { date: dueDate })}</p>
```

### Rule 4: Organize Keys Logically

**Structure by feature/section:**
```json
{
  "common": { ... },      // Shared across app
  "auth": { ... },        // Authentication
  "chat": { ... },        // Chat feature
  "settings": {           // Settings feature
    "account": { ... },
    "plan": { ... }
  }
}
```

### Rule 5: Server Components

**For Server Components, use `getTranslations`:**
```tsx
import { getTranslations } from 'next-intl/server';

export default async function ServerPage() {
  const t = await getTranslations();
  
  return <h1>{t('common.appName')}</h1>;
}
```

---

## 🎨 Styling Rules

### Rule 1: NO Hardcoded Colors

**❌ NEVER DO THIS:**
```tsx
<div className="bg-white text-black">
<div className="bg-gray-100 text-gray-900">
<div style={{ backgroundColor: '#ffffff', color: '#000000' }}>
```

**✅ ALWAYS DO THIS:**
```tsx
// Use CSS variables with dark mode support
<div className="bg-(--color-bg-primary) text-(--color-text-primary)">
<div className="bg-(--color-bg-secondary) text-(--color-text-secondary)">
<div className="bg-(--color-bg-tertiary) text-(--color-text-tertiary)">
```

### Rule 2: ALWAYS Include Dark Mode Variants

**❌ WRONG - No dark mode:**
```tsx
<div className="bg-white text-gray-900">
<button className="bg-blue-600 text-white">
```

**✅ CORRECT - Use CSS variables (Tailwind v4 syntax):**
```tsx
<div className="bg-(--color-bg-primary) text-(--color-text-primary)">
<button className="bg-(--color-button-primary-bg) text-(--color-button-primary-text)">
```

**Why this works:**
- We use `next-themes` with `attribute="class"` which adds `class="dark"` to HTML
- CSS variables are defined in `globals.css` for both `:root` (light) and `.dark` (dark)
- Tailwind v4 supports `bg-(--variable-name)` syntax
- Variables automatically switch when dark mode is active
- No need to write `dark:` prefixes everywhere

**⚠️ Exception - When to use `dark:` prefix:**
Only use `dark:` prefix for specific overrides that can't use CSS variables:
```tsx
// Example: Ring color that needs specific Tailwind color
<div className="ring-4 ring-blue-50 dark:ring-blue-950">
```
For everything else, use CSS variables.

### Rule 3: NO Hardcoded Font Sizes

**❌ NEVER DO THIS:**
```tsx
<h1 className="text-2xl">Title</h1>
<p className="text-base">Content</p>
<span style={{ fontSize: '14px' }}>Small text</span>
```

**✅ ALWAYS DO THIS:**
```tsx
// Use semantic HTML and let CSS variables handle sizing
<h1 className="text-xl font-bold">Title</h1>
<p className="text-sm">Content</p>

// Or use relative units
<span className="text-[0.875rem]">Small text</span>
```

**Why?** Users can adjust font size in settings, and hardcoded sizes won't scale.

### Rule 4: Use CSS Variable System

**Available CSS Variables:**

**Background Colors:**
- `--color-bg-primary` - Main background
- `--color-bg-secondary` - Secondary background
- `--color-bg-tertiary` - Tertiary background

**Text Colors:**
- `--color-text-primary` - Main text
- `--color-text-secondary` - Secondary text
- `--color-text-tertiary` - Tertiary/muted text

**Accent Colors:**
- `--color-accent` - Primary accent color
- `--color-accent-hover` - Accent hover state

**Border Colors:**
- `--color-border` - Default border
- `--color-border-secondary` - Secondary border

**Input Colors:**
- `--color-input-bg` - Input background
- `--color-input-border` - Input border
- `--color-input-focus` - Input focus state

**Button Colors:**
- `--color-button-primary-bg` - Primary button background
- `--color-button-primary-text` - Primary button text
- `--color-button-primary-hover` - Primary button hover

**Sidebar Colors:**
- `--color-sidebar-bg` - Sidebar background
- `--color-sidebar-text` - Sidebar text
- `--color-sidebar-hover` - Sidebar hover state
- `--color-sidebar-active` - Sidebar active state
- `--color-sidebar-border` - Sidebar border

**Message Colors:**
- `--color-message-user-bg` - User message background
- `--color-message-user-text` - User message text
- `--color-message-ai-bg` - AI message background
- `--color-message-ai-text` - AI message text
- `--color-message-ai-border` - AI message border

### Rule 5: Responsive Font Sizes

**Use Tailwind's responsive classes:**
```tsx
<h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
  Responsive Title
</h1>
```

---

## 📋 Quick Reference Checklist

### Before Adding Any Text:
- [ ] Is this text already in `messages/en.json`?
- [ ] If not, add it to `messages/en.json` first
- [ ] Use `t('section.key')` to display the text
- [ ] Test that the translation works

### Before Adding Any Styling:
- [ ] Am I using CSS variables for colors?
- [ ] Have I included dark mode variants?
- [ ] Am I avoiding hardcoded font sizes?
- [ ] Will this work with user's theme preference?
- [ ] Will this work with user's font size preference?

---

## 🚫 Common Mistakes to Avoid

### Mistake 1: Hardcoded Text in Placeholders
```tsx
❌ <input placeholder="Enter your name" />
✅ <input placeholder={t('form.namePlaceholder')} />
```

### Mistake 2: Hardcoded Text in Titles/Alt Text
```tsx
❌ <button title="Save">💾</button>
✅ <button title={t('common.save')}>💾</button>

❌ <img alt="Logo" src="/logo.png" />
✅ <img alt={t('common.appName')} src="/logo.png" />
```

### Mistake 3: Hardcoded Colors Without Dark Mode
```tsx
❌ <div className="bg-white text-black">
✅ <div className="bg-(--color-bg-primary) text-(--color-text-primary)">
```

### Mistake 4: Fixed Font Sizes
```tsx
❌ <p style={{ fontSize: '16px' }}>Text</p>
✅ <p className="text-base">Text</p>
```

### Mistake 5: Inline Styles for Colors
```tsx
❌ <div style={{ backgroundColor: '#f0f0f0' }}>
✅ <div className="bg-(--color-bg-secondary)">
```

---

## 🎯 Examples of Correct Implementation

### Example 1: Button Component
```tsx
import { useTranslations } from 'next-intl';

export default function SaveButton({ onClick, loading }) {
  const t = useTranslations();
  
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-4 py-2 bg-(--color-button-primary-bg) text-(--color-button-primary-text) hover:bg-(--color-button-primary-hover) rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? t('common.saving') : t('common.save')}
    </button>
  );
}
```

### Example 2: Card Component
```tsx
import { useTranslations } from 'next-intl';

export default function FeatureCard({ feature }) {
  const t = useTranslations();
  
  return (
    <div className="p-6 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl">
      <h3 className="text-lg font-bold text-(--color-text-primary) mb-2">
        {t(`features.${feature.key}.title`)}
      </h3>
      <p className="text-sm text-(--color-text-secondary)">
        {t(`features.${feature.key}.description`)}
      </p>
    </div>
  );
}
```

### Example 3: Form Input
```tsx
import { useTranslations } from 'next-intl';

export default function EmailInput({ value, onChange }) {
  const t = useTranslations();
  
  return (
    <div>
      <label className="block text-sm font-semibold text-(--color-text-primary) mb-2">
        {t('form.emailLabel')}
      </label>
      <input
        type="email"
        value={value}
        onChange={onChange}
        placeholder={t('form.emailPlaceholder')}
        className="w-full px-4 py-3 rounded-xl border border-(--color-border) bg-(--color-input-bg) text-(--color-text-primary) focus:ring-2 focus:ring-(--color-accent) focus:border-(--color-accent) outline-none"
      />
    </div>
  );
}
```

---

## 🔍 Code Review Checklist

When reviewing code, check for:

### Internationalization:
- [ ] No hardcoded text strings
- [ ] All text uses `t('key')` pattern
- [ ] New keys added to `messages/en.json`
- [ ] Dynamic values use proper syntax: `{variable}`
- [ ] Server components use `getTranslations`

### Styling:
- [ ] No hardcoded colors (no `bg-white`, `text-black`, etc.)
- [ ] All colors use CSS variables: `bg-(--color-*)`
- [ ] Dark mode variants included OR CSS variables used
- [ ] No hardcoded font sizes in pixels
- [ ] Responsive design considered
- [ ] No inline styles for colors

---

## 📚 Additional Resources

- **Translation Keys:** See `messages/en.json` for all available keys
- **CSS Variables:** See `app/globals.css` for all available color variables
- **Theme System:** See `components/providers/ThemeProvider.tsx`
- **Font Size System:** See `components/providers/FontSizeProvider.tsx`
- **Documentation:** See `TRANSLATION_COMPLETE.md` for full i18n guide

---

## ⚠️ CRITICAL REMINDERS

1. **NEVER hardcode text** - Always use translation keys
2. **NEVER hardcode colors** - Always use CSS variables or dark mode variants
3. **NEVER hardcode font sizes** - Use relative units or Tailwind classes
4. **ALWAYS add keys to messages/en.json BEFORE using them**
5. **ALWAYS test with both light and dark themes**
6. **ALWAYS test with different font size settings**

---

**Last Updated:** March 6, 2026  
**Status:** Active - Must be followed for all new code  
**Applies to:** All React/Next.js components in the project
