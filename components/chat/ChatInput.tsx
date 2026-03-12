'use client';

import { useTranslations } from 'next-intl';
import VoiceInput from './VoiceInput';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  detectingLanguage: boolean;
  onSend: () => void;
  onVoiceTranscript: (transcript: string) => void;
  voiceLanguageCode: string;
  attachedFiles: File[];
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onAttachClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  getFileIcon: (file: File) => string;
  formatFileSize: (bytes: number) => string;
}

export default function ChatInput({
  input,
  setInput,
  sending,
  detectingLanguage,
  onSend,
  onVoiceTranscript,
  voiceLanguageCode,
  attachedFiles,
  onFileSelect,
  onRemoveFile,
  onAttachClick,
  fileInputRef,
  getFileIcon,
  formatFileSize
}: ChatInputProps) {
  const t = useTranslations();

  return (
    <div className="absolute bottom-0 left-0 w-full bg-linear-to-t from-(--color-bg-primary) via-(--color-bg-primary) to-transparent pt-6 pb-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Attached Files Display */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 animate-fadeIn">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-(--color-text-secondary)">
                {t('chat.attachments')} ({attachedFiles.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="group flex items-center gap-2 bg-(--color-bg-secondary) border border-(--color-border) rounded-lg px-3 py-2 shadow-sm hover:shadow-md hover:border-(--color-accent) transition-all"
                >
                  <span className="material-symbols-outlined text-lg text-(--color-accent)">
                    {getFileIcon(file)}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm text-(--color-text-primary) max-w-[150px] truncate font-medium">
                      {file.name}
                    </span>
                    <span className="text-xs text-(--color-text-secondary)">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveFile(index)}
                    className="ml-1 p-1 text-(--color-text-secondary) hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors cursor-pointer"
                    aria-label={t('chat.removeAttachment')}
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="relative flex items-center gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={onFileSelect}
            className="hidden"
          />
          
          <button
            onClick={onAttachClick}
            aria-label={t('chat.attachFile')}
            className="p-2 text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-(--color-bg-secondary) rounded-lg transition-colors shrink-0 border border-transparent hover:border-(--color-border) hover:shadow-sm cursor-pointer"
            disabled={sending}
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <div className="relative flex-1 bg-(--color-input-bg) border-2 border-(--color-input-border) rounded-xl shadow-sm focus-within:ring-0 focus-within:border-(--color-input-focus) transition-colors overflow-hidden min-h-[56px] flex items-center">
            <textarea
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 pl-4 pr-12 text-(--color-text-primary) placeholder-(--color-text-secondary) outline-none"
              placeholder={t('chat.messagePlaceholder')}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <VoiceInput
                onTranscript={onVoiceTranscript}
                disabled={sending}
                language={voiceLanguageCode}
              />
            </div>
          </div>
          <button
            aria-label={t('chat.sendMessage')}
            onClick={onSend}
            disabled={sending || detectingLanguage || !input.trim()}
            className="w-12 h-12 bg-(--color-button-primary-bg) text-(--color-button-primary-text) rounded-xl flex items-center justify-center hover:bg-(--color-button-primary-hover) transition-colors shrink-0 focus:outline-none shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending || detectingLanguage ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[20px]">send</span>
            )}
          </button>
        </div>
        <div className="text-center mt-3">
          <span className="text-xs font-medium text-(--color-text-secondary)">
            {t('chat.aiDisclaimer')}
          </span>
        </div>
      </div>
    </div>
  );
}
