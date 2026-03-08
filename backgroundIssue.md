CASE STUDY 4 — Deep Technical Explanation

The Inclusive Citizen: Multilingual AI for Public Services

The core idea is not simply translation. The system must perform four different NLP transformations on government documents.

Think of it as a multi-stage language pipeline.

Government document
↓
Retrieve relevant section
↓
Simplify legal language
↓
Summarize key actions
↓
Translate into dialect
↓
Deliver through accessible UI

Each stage corresponds to one of the technical challenges.

1. Real-World Context (Deeper Explanation)

ASEAN contains more than 1,000 languages and dialects.

Examples:

Malaysia

Bahasa Melayu

Kelantan dialect

Sabahan dialect

Chinese dialects

Tamil

Philippines

Filipino

Cebuano

Ilocano

Waray

Indonesia

Bahasa Indonesia

Javanese

Sundanese

Madurese

Government portals typically publish documents only in one official language (for example Bahasa Malaysia).

But many citizens:

elderly people

migrant workers

rural communities

low literacy users

cannot easily understand legal or bureaucratic language.

Example of a typical government sentence:

“Eligible beneficiaries must submit supporting documentation within the stipulated timeframe to qualify for financial assistance.”

For many citizens, this sentence is difficult.

The system should convert it to something like:

“You must send your documents before the deadline to receive government help.”

And then translate that into a dialect.

So the goal is information accessibility, not just translation.

This aligns with UN Sustainable Development Goal 10 (Reduced Inequalities). 

Varsity Hackathon 2026 Case Stu…

2. The Core AI Problem

The system must perform four NLP tasks simultaneously:

cross-lingual search

simplification

summarization

dialect translation

This is actually a multi-task NLP architecture.

Most hackathon teams fail because they only build:

Chatbot + translation

But the case explicitly requires information transformation.

3. Technical Challenges (Detailed)
3.1 Dialect-Aware Translation

Normal translation models work between standard languages.

Example:

English → Malay
English → Indonesian

But dialects are different.

Example (Malay):

Standard Malay
“Saya mahu pergi.”

Kelantan dialect
“Sayo nak gi.”

These dialects usually have very little training data.

This creates a low-resource language problem.

Typical techniques used in research:

Method 1 — Transfer learning

Use a large multilingual model and fine-tune with small dialect datasets.

Example models:

SEA-LION

Sailor2

NLLB

Method 2 — Lexical normalization

Convert dialect → standard language.

Example:

Kelantan
“demo gi mano?”

Normalized Malay
“awak pergi mana?”

Then run the NLP pipeline.

This technique appears in the MultiLexNorm++ benchmark referenced in the paper. 

Varsity Hackathon 2026 Case Stu…

3.2 Text Simplification

Government documents contain:

legal language

bureaucratic terms

medical terminology

Example:

“Applicants are required to furnish documentation verifying income eligibility.”

Simplified:

“You must show proof of your income.”

There are two types of simplification.

Lexical simplification

Replace difficult words.

Example:

“furnish” → “provide”

This is often done with:

frequency dictionaries

paraphrasing models

LLM rewriting

Syntactic simplification

Break complex sentences.

Example:

Original:

Applicants must furnish documentation verifying income eligibility prior to submission.

Simplified:

You must show proof of your income.
Do this before submitting your application.

Researchers often aim for Grade 5 readability.

This can be measured using metrics like:

Flesch Reading Ease

FKGL (Flesch–Kincaid Grade Level)

3.3 Recursive Summarization

Government policy documents can be 50–200 pages.

Users only need 3-5 actions.

Example:

Policy document
↓
Section summaries
↓
Final bullet points

This technique is called hierarchical summarization.

Pipeline example:

1 chunk document
2 summarize each chunk
3 summarize summaries

LLMs perform better when summarizing smaller chunks.

This is called recursive summarization.

3.4 Cross-Lingual Information Retrieval

User might ask:

Kelantan dialect
“Bantuan banjir ada tak?”

But the official document is written in:

Standard Malay

So the system must:

1 translate the query
2 retrieve the correct document
3 answer the question

Typical architecture:

User query
↓
embedding model
↓
vector search
↓
RAG
↓
LLM answer

The trick is using multilingual embeddings.

Examples:

LaBSE

multilingual E5

NLLB embeddings

These embeddings map different languages into the same vector space.

So:

English question
Malay document

can still match.

4. Controlling Hallucinations

Government information must be accurate.

The case explicitly requires RAG.

RAG = Retrieval Augmented Generation.

Pipeline:

User query
↓
Vector search
↓
Retrieve official documents
↓
LLM answers using retrieved text

The LLM must cite the source document.

Without RAG, the model may hallucinate government policies.

That would be dangerous.

5. Inclusivity UI Design

The system must be usable for low digital literacy users.

Typical design patterns:

WhatsApp-style interface

simple chat bubbles

big buttons

Voice interface

speech to text

text to speech

Example flow:

User voice input
↓
Speech-to-text
↓
AI processing
↓
Simplified answer
↓
Text-to-speech playback

Some teams even deploy through:

WhatsApp bot

Telegram bot

because many rural users already use messaging apps.

6. Data Sources Explained
NLLB-200

Model:

No Language Left Behind

Supports 200 languages.

Architecture:

Transformer-based multilingual model.

Use cases:

translation

cross-lingual embeddings

Size:

600M parameters.

It is small enough to run on a single GPU.

SEACrowd

A research initiative that collects Southeast Asian language datasets.

Goal:

Improve AI models for languages like:

Malay

Thai

Vietnamese

Tagalog

The datasets include:

speech

translation pairs

text corpora

This helps train models for low-resource languages.

SEALD (SEA Language Dataset)

Dataset containing Southeast Asian multilingual corpora.

Used to train:

SEA-LION model.

Includes:

Malay

Indonesian

Thai

Vietnamese

Filipino

Malay Dataset (Malaya)

A collection of Malay NLP datasets.

Includes:

sentiment datasets

translation pairs

conversational corpora

This is useful for fine-tuning Malay models.

7. Regional AI Models

These are specialized Southeast Asia LLMs.

SEA-LION

Developed by AI Singapore.

Purpose:

Large language model optimized for Southeast Asian languages.

Advantages:

better Malay understanding

better Indonesian understanding

trained on regional datasets

Sailor2

A multilingual model designed for Southeast Asia.

Focus:

cross-lingual reasoning

translation

regional language tasks

It performs better than general LLMs for:

Thai

Vietnamese

Malay

Typhoon 2.1

A Thai speech-language model.

Capabilities:

speech input

speech output

Thai NLP tasks

Useful for voice-based government assistants.

Llama-Sahabat-AI

Indonesian adaptation of Llama.

Trained with Indonesian datasets.

Better for Indonesian dialect tasks.

VinaLLaMA

Vietnamese-optimized LLM.

Designed for:

Vietnamese NLP

Vietnamese RAG systems

8. Evaluation Benchmarks
MultiLexNorm++

A benchmark for lexical normalization.

Goal:

Convert informal or dialect text into standardized language.

Example:

User input:

“gov help xde ke?”

Normalized:

“government help ada ke?”

This improves downstream NLP performance.

Cultural Awareness Benchmark

This research evaluates whether LLMs understand:

cultural context

regional language usage

social norms

Example:

A model trained mostly on Western data may misunderstand ASEAN contexts.

9. What Judges Actually Want

Based on the judging criteria. 

Hackathon-Judging-Criteria-Summ…

Your project will be evaluated on:

Technical depth
Data pipeline
Real deployment feasibility
Social impact

The strongest solution would include:

Strong AI pipeline

RAG + multilingual embeddings + simplification

Real data

Government documents

Working demo

User asks question → AI returns simplified answer

Inclusivity

Voice input + multilingual output

Scalability

Automatic document updates.

10. What a Winning Architecture Probably Looks Like

Since your tech stack already includes:

Next.js
LangChain
Supabase
Redis
OpenAI / embeddings

You could build something like:

Gov Website Scraper
        │
        ▼
Document Cleaner
        │
        ▼
Chunking + Embeddings
        │
        ▼
Vector DB (Supabase pgvector)
        │
        ▼
RAG Pipeline
        │
        ▼
Simplification Layer
        │
        ▼
Recursive Summarization
        │
        ▼
Dialect Translation
        │
        ▼
WhatsApp-style Chat UI
11. The Hidden Difficulty (Why This Case Is Hard)

Three research problems exist simultaneously:

1 multilingual NLP
2 low-resource dialects
3 hallucination-free government AI

Most teams only solve one.

Judges will reward teams that solve all three.