import { useEffect, useRef, useState } from "react";

/** A textarea that grows with its content and commits on blur when the text changed. */
export function AutoTextarea({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [text]);

  return (
    <textarea
      ref={ref}
      value={text}
      rows={1}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onCommit(text);
      }}
      className="w-full resize-none overflow-hidden rounded-md border border-input bg-white px-3 py-2 text-sm"
    />
  );
}
