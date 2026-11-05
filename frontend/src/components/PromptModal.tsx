import { useState, useEffect } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  isOpen,
  title,
  message,
  defaultValue = "",
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  // تحديث القيمة الافتراضية عند فتح المودال
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
      dir="rtl"
    >
      <div
        className="bg-card p-6 rounded-3xl max-w-sm w-full border border-border shadow-glow relative flex flex-col items-center text-center animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute left-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-5" />
        </button>

        <div className="flex size-16 items-center justify-center rounded-full mb-4 border bg-destructive/10 text-destructive border-destructive/20">
          <MessageSquare className="size-8" />
        </div>

        <h3 className="text-xl font-extrabold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>

        <textarea
          className="w-full p-3 mb-6 rounded-xl bg-muted text-foreground border border-border focus:border-primary outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
          rows={3}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="اكتب سبب الرفض هنا..."
        />

        <div className="flex gap-3 w-full">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 rounded-2xl font-bold bg-muted hover:bg-muted/80 text-foreground border-border h-12"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => onConfirm(inputValue)}
            className="flex-1 rounded-2xl font-bold h-12 text-primary-foreground bg-destructive hover:bg-destructive/90 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
