import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { Textarea } from "@/components/ui/textarea";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

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
