'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSend: (payload: { text: string; clientId: string }) => void;
  disabled?: boolean;
}

const MAX_LENGTH = 5000;

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;

    onSend({ text, clientId: uuidv4() });
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value.slice(0, MAX_LENGTH));
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex items-end gap-2 border-t border-border bg-panel px-4 py-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        rows={1}
        disabled={disabled}
        className="max-h-[120px] flex-1 resize-none rounded-2xl border border-border bg-muted px-4 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
      />
      <Button
        size="icon"
        className="h-10 w-10 shrink-0 rounded-full"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
};
