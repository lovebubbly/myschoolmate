'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Minimize2, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface NoticeChatCitation {
  id: number;
  title: string;
  url: string;
  date: string;
  category: string;
}

export type NoticeChatAskResult = {
  answer: string;
  citations: NoticeChatCitation[];
  suggestedKeywords: string[];
} | null;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: NoticeChatCitation[];
  pending?: boolean;
};

type NoticeChatbotProps = {
  question: string;
  loading: boolean;
  answer: string;
  citations: NoticeChatCitation[];
  suggestedKeywords: string[];
  suggestions: string[];
  onQuestionChange: (value: string) => void;
  onAsk: (question: string) => Promise<NoticeChatAskResult>;
};

function buildMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultMessages(): ChatMessage[] {
  return [
    {
      id: buildMessageId('assistant'),
      role: 'assistant',
      content: '질문을 보내면 최근 공지에서만 근거를 찾아 답해줄게. 필요한 내용은 제목+링크로 같이 붙여서 보여줄게.',
    },
  ];
}

function getInitialMessages(answer: string, citations: NoticeChatCitation[]): ChatMessage[] {
  const initialAnswer = String(answer || '').trim();
  if (initialAnswer) {
    return [{ id: buildMessageId('assistant'), role: 'assistant', content: initialAnswer, citations }];
  }
  return getDefaultMessages();
}

export function NoticeChatbot({
  question,
  loading,
  answer,
  citations,
  suggestedKeywords,
  suggestions,
  onQuestionChange,
  onAsk,
}: NoticeChatbotProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keywordHints, setKeywordHints] = useState<string[]>(suggestedKeywords);
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(answer, citations));
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const node = messagesRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }, [isOpen, messages, prefersReducedMotion]);

  const handleAsk = async (questionOverride?: string) => {
    const nextQuestion = String(questionOverride ?? question).trim();
    if (!nextQuestion || loading) return;

    const userMessageId = buildMessageId('user');
    const assistantMessageId = buildMessageId('assistant');

    onQuestionChange(nextQuestion);
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', content: nextQuestion },
      { id: assistantMessageId, role: 'assistant', content: '근거를 찾는 중이야...', pending: true },
    ]);

    const result = await onAsk(nextQuestion);
    const resolvedAnswer = String(result?.answer || '').trim() || '해당 공지를 찾지 못했어.';
    const resolvedCitations = Array.isArray(result?.citations) ? result.citations : [];
    const resolvedKeywords = Array.isArray(result?.suggestedKeywords) ? result.suggestedKeywords : [];

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: resolvedAnswer,
              citations: resolvedCitations,
              pending: false,
            }
          : message,
      ),
    );
    if (resolvedKeywords.length > 0) {
      setKeywordHints(resolvedKeywords);
    }
  };

  const resetConversation = () => {
    setMessages(getDefaultMessages());
    setKeywordHints(suggestedKeywords);
    onQuestionChange('');
    if (inputRef.current) inputRef.current.focus();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[80] flex flex-col items-end gap-3">
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.section
            key="notice-chat-popover"
            data-testid="notice-chat-popover"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto w-[min(35rem,calc(100vw-1rem))] h-[min(78vh,760px)] rounded-[28px] border border-border/70 bg-background shadow-2xl overflow-hidden flex flex-col"
          >
            <header className="px-4 py-3 border-b border-border/60 bg-card/40 flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm">
                  ✦
                </span>
                <div>
                  <p className="text-sm font-semibold">공지 Q&A</p>
                  <p className="text-[11px] text-muted-foreground truncate">최근 공지 기반 답변만 제공</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-1 rounded-md text-[10px] font-semibold border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                  Grounded
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label="새 대화 시작"
                  onClick={resetConversation}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label="공지 챗봇 닫기"
                  onClick={() => setIsOpen(false)}
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </header>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 bg-muted/20">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'user' ? (
                      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-foreground text-background px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                            li: (props) => <li className="text-sm" {...props} />,
                            a: (props) => (
                              <a
                                {...props}
                                className="underline underline-offset-4"
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="w-full" data-testid="notice-chat-answer">
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[13px]">
                            AI
                          </span>
                          <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border/70 bg-background px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                            {message.pending ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:120ms]" />
                                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse [animation-delay:240ms]" />
                                <span className="text-xs ml-1">근거 찾는 중</span>
                              </div>
                            ) : (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                                  ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                                  li: (props) => <li className="text-sm" {...props} />,
                                  a: (props) => (
                                    <a
                                      {...props}
                                      className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4 font-medium"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    />
                                  ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            )}
                          </div>
                        </div>

                        {message.role === 'assistant' && (message.citations?.length || 0) > 0 && (
                          <div data-testid="notice-chat-citations" className="ml-9 mt-2 space-y-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground">근거 공지</p>
                            {message.citations?.map((citation) => (
                              <a
                                key={`${message.id}-citation-${citation.id}`}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-[11px] text-blue-600 dark:text-blue-400 hover:bg-muted/50"
                              >
                                {citation.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <footer className="px-3 py-3 border-t border-border/60 bg-card/55 space-y-2.5">
              {(keywordHints.length > 0 || suggestedKeywords.length > 0 || suggestions.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    messages.length <= 1
                      ? suggestions
                      : keywordHints.length > 0
                        ? keywordHints
                        : suggestedKeywords.length > 0
                          ? suggestedKeywords
                          : suggestions
                  ).slice(0, 4).map((keyword, index) => (
                    <Button
                      key={`notice-chat-keyword-${keyword}`}
                      data-testid={`notice-chat-suggestion-${index}`}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground bg-background hover:bg-muted/70"
                      onClick={() => {
                        onQuestionChange(keyword);
                        if (inputRef.current) inputRef.current.focus();
                      }}
                    >
                      {keyword}
                    </Button>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-background shadow-sm p-2">
                <textarea
                  ref={inputRef}
                  data-testid="notice-chat-input"
                  value={question}
                  onChange={(event) => onQuestionChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleAsk();
                    }
                  }}
                  placeholder="예: OCU 장학생 선발 공지 핵심만 알려줘"
                  aria-label="공지 질문 입력"
                  rows={2}
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/80"
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] text-muted-foreground">Enter 전송 · Shift+Enter 줄바꿈</p>
                  <Button
                    type="button"
                    data-testid="notice-chat-submit"
                    onClick={() => void handleAsk()}
                    disabled={loading || question.trim().length < 2}
                    className="h-9 rounded-full px-3 shrink-0"
                  >
                    <Send className="w-4 h-4 mr-1.5" />
                    보내기
                  </Button>
                </div>
              </div>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="공지 Q&A 열기"
        data-testid="notice-chat-toggle"
        className="pointer-events-auto relative cursor-pointer"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.08, rotate: [0, -4, 4, 0] }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {loading && (
          <motion.div
            aria-hidden="true"
            className="absolute -inset-1 rounded-full border-2 border-cyan-400/60 border-t-cyan-500"
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={prefersReducedMotion ? undefined : { duration: 1.1, ease: 'linear', repeat: Infinity }}
          />
        )}

        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 20px rgba(101, 116, 246, 0.28)',
              '0 0 32px rgba(139, 92, 246, 0.38)',
              '0 0 20px rgba(101, 116, 246, 0.28)',
            ],
          }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 3, repeat: prefersReducedMotion ? 0 : Infinity }}
        />

        <div className="relative w-16 h-16 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-xl flex items-center justify-center overflow-hidden">
          <motion.div
            animate={prefersReducedMotion ? undefined : { x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
          />
          <span className="text-2xl relative z-10">{hovered ? '🎓' : '💡'}</span>
        </div>
      </motion.button>
    </div>,
    document.body,
  );
}
