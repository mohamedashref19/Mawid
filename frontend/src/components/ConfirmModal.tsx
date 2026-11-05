import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
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

        <div
          className={`flex size-16 items-center justify-center rounded-full mb-4 border ${
            isDestructive
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-primary/10 text-primary border-primary/20"
          }`}
        >
          <AlertTriangle className="size-8" />
        </div>

        <h3 className="text-xl font-extrabold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>

        <div className="flex gap-3 w-full">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 rounded-2xl font-bold bg-muted hover:bg-muted/80 text-foreground border-border h-12"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 rounded-2xl font-bold h-12 text-primary-foreground ${
              isDestructive
                ? "bg-destructive hover:bg-destructive/90 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                : "bg-primary hover:bg-primary/90 shadow-glow"
            }`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
