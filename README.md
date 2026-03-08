# DocsBridge - Multilingual AI for Public Services

**Status**: 85% Complete (Production Ready)  
**Demo Ready**: ✅ Yes  
**Hackathon**: Varsity Hackathon 2026 - Case Study 4

---

## 🎯 Project Overview

DocsBridge is an inclusive AI system that makes government information accessible to citizens who speak dialects and have low literacy levels. It performs a complete NLP transformation pipeline:

```
Government Document
    ↓
Language & Dialect Detection
    ↓
Query Optimization (Semantic Expansion)
    ↓
RAG Retrieval (Hybrid Search)
    ↓
Text Simplification (Grade 5)
    ↓
Recursive Summarization
    ↓
Dialect Translation
    ↓
Accessible Answer with Sources
```

---

## ✨ Key Features

### 🌐 Multilingual Support
- **6 Languages**: English, Malay, Indonesian, Tagalog, Tamil, Chinese
- **5+ Dialects**: Kelantan, Sabah, Cebuano, Ilocano, Waray
- **Query Optimization**: Semantic expansion with keyword enrichment (9-15% retrieval improvement)

### 🧠 Complete NLP Pipeline
- **Language Detection**: Automatic detection with confidence scoring
- **Text Simplification**: Grade 12 → Grade 5 readability
- **Recursive Summarization**: Bullet points + key actions
- **Dialect Translation**: Preserves simplification level
- **Confidence Scoring**: Multi-factor trust indicators

### 🔍 Advanced RAG System
- **Dual Embedding**: 384-dim (browser) + 1024-dim (server)
- **Hybrid Search**: 30 coarse candidates → 5 reranked results
- **Structured Memory**: Multi-turn conversation context
- **Source Attribution**: Similarity scores + document metadata

### 🎨 Progressive UI
- **7-Step Pipeline Visualization**: Real-time progress feedback
- **No Blank Screens**: Every step shows status
- **Interactive Enhancements**: Simplify, Summarize, Translate buttons
- **Confidence Display**: 🟢🟡🔴 badges with explanations

---

## 🏗️ Tech Stack

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Transformers.js** - Browser-side embeddings

### Backend
- **Next.js API Routes** - Serverless functions
- **LangChain** - LLM orchestration
- **OpenRouter** - LLM access (Trinity Mini/Large)
- **Supabase** - PostgreSQL + pgvector

### AI/ML
- **multilingual-e5-small** - Browser embedding (384-dim)
- **multilingual-e5-large** - Server embedding (1024-dim)
- **LFM 2.5 1.2B Thinking** - Small LLM for detection/normalization
- **Trinity Mini/Large** - Main LLM for RAG

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Supabase account
- OpenRouter API key

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd docs-bridge
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run database migrations**
```bash
# Apply all migrations in supabase/migrations/
# Use Supabase CLI or dashboard
```

5. **Start development server**
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## 📁 Project Structure

```
docs-bridge/
├── app/
│   ├── api/
│   │   ├── chat/          # Chat & RAG endpoints
│   │   ├── nlp/           # NLP transformation endpoints
│   │   ├── kb/            # Knowledge base management
│   │   └── embeddings/    # Embedding generation
│   └── [locale]/          # Internationalized pages
├── components/
│   ├── chat/              # Chat UI components
│   ├── knowledge-base/    # KB management UI
│   └── ui/                # Reusable UI components
├── lib/
│   ├── nlp/               # NLP functions (core logic)
│   ├── embeddings/        # Embedding generation
│   ├── langchain/         # LangChain integration
│   ├── supabase/          # Database queries
│   └── api/               # Client API functions
├── supabase/
│   └── migrations/        # Database migrations
└── messages/              # i18n translations
```

---

## 🎮 Usage

### Basic Chat Flow

1. **Ask a Question** (in any supported language/dialect)
   ```
   User: "Bantuan banjir ada tak?" (Kelantan dialect)
   ```

2. **System Detects Language**
   ```
   🌐 You are asking in Malay (Kelantan dialect)
   ```

3. **Normalization Dialog** (if dialect detected)
   ```
   Normalize dialect for better search results?
   
   Original: "Bantuan banjir ada tak?"
   Normalized: "Bantuan banjir ada tidak?"
   
   [Yes, normalize] [No, use original]
   ```

4. **Progressive Pipeline** (7 steps shown)
   ```
   ✓ Language Detection
   ✓ Query Optimization
   ✓ Embedding Generation
   ✓ Searching 30 candidates
   ✓ Reranking (5 docs found)
   ✓ Building context
   ✓ Generating answer
   ```

5. **Enhanced Response**
   - Original answer
   - [Simplified] button → Grade 5 readability
   - [Summarize] button → Bullet points
   - [Kelantan] button → Translate to dialect
   - Confidence score (🟢 95%)
   - Sources with similarity scores

---

## 📊 Current Status

### Completed (85%) ✅
- ✅ All backend NLP functions
- ✅ RAG pipeline with hybrid search
- ✅ Progressive UI (7 steps)
- ✅ Confidence scoring
- ✅ Structured memory
- ✅ Source attribution

### Pending (15%) ⚠️
- ⚠️ Difficult words tooltips
- ⚠️ Clickable sources to KB
- ⚠️ Auto-translation to dialect
- ⚠️ Readability score comparison
- ⚠️ Translation confidence display

### Optional (Not Started) ❌
- ❌ Government document crawler
- ❌ Voice interface
- ❌ Streaming responses

**See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed status**

---

## 📚 Documentation

- **[PROJECT_STATUS.md](PROJECT_STATUS.md)** - Executive summary
- **[TASK_CHECKLIST.md](TASK_CHECKLIST.md)** - Detailed task tracking
- **[KNOWN_ISSUES.md](KNOWN_ISSUES.md)** - Known issues & limitations
- **[COMPLETE_NLP_PIPELINE.md](COMPLETE_NLP_PIPELINE.md)** - Technical pipeline docs
- **[requirement.md](requirement.md)** - Original requirements
- **[backgroundIssue.md](backgroundIssue.md)** - Case study deep dive

---

## 🧪 Testing

### Manual Testing
```bash
# Test language detection
1. Enter text in different languages
2. Verify detection accuracy

# Test query optimization
1. Enter queries in any language/dialect
2. Check automatic semantic expansion
3. Verify changes are correct

# Test RAG pipeline
1. Upload documents to KB
2. Ask questions
3. Verify sources are relevant

# Test enhancements
1. Click [Simplified] button
2. Click [Summarize] button
3. Click [Translate] button
4. Verify all work correctly
```

### Automated Testing
```bash
# Run TypeScript checks
pnpm type-check

# Run linter
pnpm lint

# Build for production
pnpm build
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Import to Vercel**
- Go to [vercel.com](https://vercel.com)
- Import your repository
- Add environment variables
- Deploy

3. **Configure Supabase**
- Update `NEXT_PUBLIC_APP_URL` in Supabase dashboard
- Add Vercel domain to allowed origins

### Environment Variables
Make sure to set all variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_APP_URL`

---

## 🎓 Case Study Compliance

### Required Features ✅
- [x] Cross-lingual search
- [x] Text simplification
- [x] Recursive summarization
- [x] Dialect translation
- [x] RAG with source attribution
- [x] Confidence scoring
- [x] Progressive UI feedback

### Bonus Features ✅
- [x] Structured memory
- [x] Dual embedding hybrid search
- [x] Query optimization (replaces normalization)
- [x] Multi-factor confidence
- [x] 7-step progressive UI

---

## 🤝 Contributing

This is a hackathon project. Contributions welcome after the event!

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- **Varsity Hackathon 2026** - For the challenge
- **Supabase** - Database and auth
- **OpenRouter** - LLM access
- **LangChain** - LLM orchestration
- **Transformers.js** - Browser-side AI

---

## 📞 Contact

For questions or issues, please open a GitHub issue.

---

**Built with ❤️ for inclusive AI**
