用 pgvector + Supabase 做 vector database，其实是一个非常合理的选择。很多生产系统都这么做，因为它把 向量检索、结构化数据、权限控制、API 全放进同一个数据库。复杂度比专门的向量数据库低很多，尤其适合 Hackathon 或 MVP。

先从数据结构说起。RAG 系统里真正需要存的东西只有三类：文本、embedding、metadata。

一个典型的表结构会像这样：

create extension if not exists vector;

create table gov_docs (
  id uuid primary key default gen_random_uuid(),
  content text,
  embedding vector(1024),
  source text,
  url text,
  language text,
  created_at timestamptz default now()
);

这里的 1024 是因为 multilingual-e5-large 的向量维度是 1024。如果你改用 small 或 base，需要把维度改掉。

当 crawler 抓到政府文档之后，流程是：

gov website
   ↓
HTML / PDF extraction
   ↓
text cleaning
   ↓
chunking (500–800 tokens)
   ↓
embedding (e5-large)
   ↓
insert into pgvector

插入数据的 SQL 很简单：

insert into gov_docs (content, embedding, source, url)
values (
  'Applicants must submit documentation verifying eligibility',
  '[0.021, -0.334, ...]',
  'MOH subsidy guideline',
  'https://moh.gov.my/...'
);

在 Supabase 里，embedding 实际是 float32 array 存储。

接下来是关键：相似度搜索函数。

在 PostgreSQL 里通常写一个 RPC function：

create or replace function match_docs (
  query_embedding vector(1024),
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from gov_docs
  order by embedding <=> query_embedding
  limit match_count;
$$;

这里 <=> 是 pgvector 的 cosine distance 运算符。

查询时：

select * from match_docs('[...]', 5);

它会返回 最相似的 5 个文档 chunk。

浏览器侧流程就很清晰了。

浏览器使用
Transformers.js
跑 multilingual-e5-small：

const embedding = await embedder(
  "query: cara mohon bantuan kesihatan",
  { pooling: "mean", normalize: true }
)

然后调用 Supabase：

const { data } = await supabase.rpc("match_docs", {
  query_embedding: embedding,
  match_count: 10
})

返回：

[
  { "content": "...", "similarity": 0.82 },
  { "content": "...", "similarity": 0.79 }
]

这些 chunk 就是 RAG context。

接下来是 性能问题。
如果文档量开始变大，需要建 index。

pgvector 提供两种主要索引：

HNSW（推荐）

create index on gov_docs
using hnsw (embedding vector_cosine_ops);

IVFFLAT（旧一点）

create index on gov_docs
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

HNSW 是目前最流行的 ANN 算法之一，很多向量数据库都在用。

如果你的数据规模是：

5k – 50k chunks

Supabase + pgvector 完全够用。

现在把它放回 DocsBridge 的整体架构：

Crawler
   ↓
Government Websites
   ↓
Text extraction
   ↓
Chunking
   ↓
Embedding (e5-large)
   ↓
Supabase pgvector

用户查询：

Browser
   ↓
Embedding (e5-small)
   ↓
Supabase RPC search
   ↓
Top 10 chunks
   ↓
LLM summarization + simplification

这样有几个工程上的优点：

第一，系统非常简单。
没有额外 vector service。

第二，权限很好控制。
Supabase RLS 可以限制数据访问。

第三，SQL 能做很多额外过滤：

where language = 'ms'

或者

where source = 'health'

这对 政府文档分类检索很有用。

还有一个小技巧，很多 RAG 系统都会做：hybrid search。

不仅用 vector，还用 keyword search。

PostgreSQL 自带：

tsvector

可以做 BM25 类似的搜索。

查询可以写成：

vector score + keyword score

这样系统对 精确政策名称也能找到。

最后给你一个现实建议。
DocsBridge 的数据量大概率不会超过：

100k chunks

这个规模：

Supabase + pgvector + HNSW

完全足够，而且部署最简单。

很多创业团队在 MVP 阶段也是这么做的，然后等数据到 百万级才迁移到专门的向量数据库。

工程上，简单往往比“最先进架构”更可靠。

一个更强的 trick（很多人不知道）

RAG最优架构）：双 embedding 模型

很多 production RAG 用：

Large model → document embedding
Small model → query embedding

例如：

Documents → e5-large
Query → e5-small

E5 模型需要 prefix：

query: xxx
passage: xxx

否则效果会差。

例如：

embed("query: bantuan tunai kerajaan")

文档：

embed("passage: Bantuan tunai Rahmah diberikan kepada...")

很多 RAG 项目没做这个。
