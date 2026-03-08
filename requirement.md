Crawler：Node.js + Vercel Cron + QStash

Embedding pipeline：multilingual-e5-large（server）

Query embedding：multilingual-e5-small（browser）

Vector DB：Supabase pgvector

Hybrid retrieval：browser coarse search → server rerank

这其实是一种 Hybrid Edge-RAG architecture。很多 AI 产品正在往这个方向走，因为它能把推理成本和延迟压得很低。

DocsBridge 技术架构（优化版）
1️⃣ Government Document Crawling Pipeline

目标：持续更新官方政策文档，使 RAG 知识库保持最新。

调度架构

不使用 Python crawler，而是完全 Node.js serverless pipeline，方便部署在 Vercel。

组件：

Vercel Cron Jobs

Upstash QStash

Next.js API Route (crawler worker)

工作流程：

Vercel Cron
     │
     ▼
QStash Queue
     │
     ▼
Crawler Worker (Next.js API)
     │
     ▼
Parse + Clean
     │
     ▼
Chunk
     │
     ▼
Embedding (e5-large)
     │
     ▼
Supabase pgvector

优点：

无需常驻服务器

与 Next.js 项目完全统一

Hackathon demo 部署简单

爬取数据源（Gov Sources）

Malaysia

https://data.gov.my

https://www.malaysia.gov.my

https://www.moh.gov.my

https://bantuantunai.hasil.gov.my

ASEAN Open Data

https://data.gov.sg

https://data.go.id

https://data.gov.ph

https://data.go.th

https://data.gov.bn

文档类型：

HTML

PDF

Policy announcements

Legal documents

文档解析

HTML：

使用

cheerio

@mozilla/readability

清理：

navbar

footer

ads

scripts

PDF：

使用

pdf-parse

输出统一格式：

{
  title
  source_url
  published_date
  text
}
Chunking

分块策略：

500 – 800 tokens
overlap: 100 tokens

原因：

RAG检索更稳定

LLM上下文更合理

实现：

LangChain RecursiveTextSplitter
Embedding Pipeline

Crawler pipeline 使用：

multilingual-e5-large

原因：

更高语义质量

更好的跨语言能力

Embedding 过程：

chunk
  ↓
normalize text
  ↓
e5-large embedding
  ↓
vector

存储到：

Supabase pgvector

表结构示例：

documents
---------
id
title
source
url
chunk_text
embedding vector(1024)
created_at

索引：

ivfflat
cosine similarity
2️⃣ Hybrid Retrieval Architecture

DocsBridge 使用 Hybrid Edge Retrieval：

浏览器负责 粗检索
服务器负责 精排 + RAG

结构：

User Browser
     │
     ▼
e5-small query embedding
     │
     ▼
Supabase Vector Search
     │
Top 20 results
     │
     ▼
Server Rerank
     │
Top 5
     │
     ▼
RAG + LLM

优点：

查询速度快

server成本低

client AI能力强

Demo非常亮眼

3️⃣ Browser-side Embedding

浏览器直接运行 embedding 模型。

使用：

Transformers.js

模型：

multilingual-e5-small

原因：

模型小

WebGPU可运行

下载速度快

cross-lingual能力好

浏览器流程：

User query
     │
     ▼
Transformers.js
     │
     ▼
e5-small embedding
     │
     ▼
Supabase pgvector search

实现技术：

WebGPU

ONNX

WASM fallback

Edge AI Potential（高级能力）

如果 vector index 同步到浏览器：

IndexedDB

理论上可以实现：

Offline RAG

结构：

PWA
 │
Local Vector DB
 │
Local embedding
 │
Offline policy search

用户在手机 没有网络时仍然可以查询政策。

这是很多 edge AI 产品的未来方向。

4️⃣ Multilingual NLP Pipeline

DocsBridge 支持：

English

Malay

Chinese

Tamil

Tagalog

Indonesian

流程：

User Query
     │
Language Detection
     │
Cross-lingual Embedding
     │
Vector Retrieval
     │
LLM Generation
     │
Simplification
     │
Translate to user language
Dialect / Language Detection

工具：

fastText language detection

输出：

zh
ms
id
tl
ta
en
Cross-lingual Retrieval

Embedding模型：

multilingual-e5-small（query）

multilingual-e5-large（documents）

这种 dual-model retrieval 在很多系统中被使用。

优点：

查询快

文档语义质量高

5️⃣ RAG + LLM Pipeline

Server执行。

输入：

query
top-k chunks

流程：

retrieve
   ↓
rerank
   ↓
LLM
   ↓
simplify
   ↓
translate

LLM：

通过 OpenRouter 调用。

推荐模型：

Llama 3

Mixtral

DeepSeek

SEA-LION（东南亚语言优化）

Prompt 示例：

Answer based ONLY on the provided government documents.

Then rewrite the answer so that a 10-year-old can understand.

Use bullet points.
6️⃣ Voice / Chat Interface

UI设计：

类似 WhatsApp chat。

功能：

text query

voice query

voice answer

组件：

Frontend

Next.js

TailwindCSS

React

Speech-to-text

Whisper

Text-to-speech

Coqui TTS

流程：

User voice
   ↓
Speech to text
   ↓
RAG pipeline
   ↓
LLM answer
   ↓
TTS
   ↓
Voice output
7️⃣ 完整技术栈
模块	技术
Frontend	Next.js + React + Tailwind
Crawler	Node.js + Vercel Cron + QStash
HTML Parser	cheerio + readability
PDF Parser	pdf-parse
Chunking	LangChain
Embedding (crawler)	multilingual-e5-large
Embedding (browser)	multilingual-e5-small
Vector DB	Supabase pgvector
Retrieval	Hybrid search
LLM	OpenRouter
Translation	NLLB / LLM
Voice	Whisper + Coqui TTS
8️⃣ Hackathon Demo 亮点
Inclusive AI

支持：

Malay

Chinese

Tamil

ASEAN languages

降低政府信息获取门槛。

Trustworthy AI

RAG + 官方文档：

No hallucination
Traceable sources
Edge AI

Browser embedding：

WebGPU AI inference

展示 client-side AI。

Real-time Policy Updates
Scheduled crawling

政策更新自动同步。