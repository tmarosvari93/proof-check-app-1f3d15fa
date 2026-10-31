import { useEffect, useRef } from "react";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";

/** A textarea that grows with its content. */
export function AutoTextarea(props: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(resize, [props.value]);

  return <Textarea ref={ref} {...props} onInput={resize} />;
}
