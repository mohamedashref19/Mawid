import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  ScanLine,
  CheckCircle,
  XCircle,
  Camera,
  CameraOff,
  ImageUp,
  ShieldX, // إضافة أيقونة المنع
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-auth"; // استدعاء الهوك الخاص بالمستخدم
import * as api from "@/lib/api";

export const Route = createFileRoute("/admin/scanner")({
  component: AdminScanners,
});

function AdminScanners() {
  const { data: user, isLoading: authLoading } = useMe(); // التحقق من المستخدم الحالي
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("غير صالحة أو تم استخدامها");
  const [ticketData, setTicketData] = useState<api.Booking | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  // التحقق من أن المستخدم مسجل ولديه صلاحية موظف أو أدمن
  const isAuthorized = user && (user.role === "admin" || user.role === "employee");

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const handleScan = useCallback(
    async (code: string) => {
      // حماية إضافية قبل تنفيذ الطلب
      if (!isAuthorized) {
        toast.error("غير مصرح لك بفحص التذاكر");
        return;
      }

      const trimmed = code.trim();
      if (!trimmed || isProcessingRef.current) return;

      isProcessingRef.current = true;
      await stopCamera();

      try {
        setLoading(true);
        const res = await api.checkIn(trimmed);
        setTicketData(res);
        setScanStatus("success");
        setManualCode("");
        toast.success("تم تسجيل حضور العميل بنجاح!");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "تذكرة غير صالحة";
        setErrorMessage(msg);
        setScanStatus("error");
        toast.error(msg);
      } finally {
        setLoading(false);
        setTimeout(() => {
          setScanStatus("idle");
          isProcessingRef.current = false;
        }, 4000);
      }
    },
    [stopCamera, isAuthorized],
  );

  const startCamera = async () => {
    try {
      setCameraActive(true);
      // ننتظر لحظة حتى يظهر عنصر #qr-reader في الـ DOM
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("qr-reader");
          scannerRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
              void handleScan(decodedText);
            },
            () => {
              // تجاهل أخطاء الفريمات الفارغة أثناء البحث عن QR
            },
          );
        } catch {
          toast.error("تعذر فتح الكاميرا، تأكد من إعطاء صلاحية الكاميرا للمتصفح");
          setCameraActive(false);
        }
      }, 150);
    } catch {
      setCameraActive(false);
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await stopCamera();
      const html5QrCode = new Html5Qrcode("qr-file-reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      await handleScan(decodedText);
    } catch {
      toast.error("لم يتم العثور على رمز QR واضح داخل هذه الصورة");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  // عرض شاشة تحميل أثناء التأكد من هوية المستخدم
  if (authLoading) {
    return (
      <div
        className="p-8 text-center text-white min-h-screen flex items-center justify-center"
        dir="rtl"
      >
        جاري التحقق من الصلاحيات...
      </div>
    );
  }

  // منع المستخدم العادي (User) من رؤية واجهة الماسح الضوئي
  if (!isAuthorized) {
    return (
      <div
        className="p-8 text-center min-h-screen flex flex-col items-center justify-center"
        dir="rtl"
      >
        <div className="bg-card border border-red-900/50 rounded-3xl p-8 max-w-md w-full flex flex-col items-center shadow-lg">
          <ShieldX size={64} className="text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">غير مصرح بالدخول</h1>
          <p className="text-gray-400 text-sm mb-6">
            صفحة فحص التذاكر وتسجيل الحضور مخصصة لموظفي الاستقبال ومديري النظام فقط.
          </p>
          <Link
            to="/"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-xl transition-colors w-full"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-right pb-24 min-h-screen" dir="rtl">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 bg-card px-4 py-2 rounded-xl border border-border transition-colors"
      >
        <ArrowRight size={20} />
        <span>رجوع للوحة التحكم</span>
      </Link>

      <h1 className="text-3xl font-bold text-white mb-6">الماسح الضوئي للتذاكر</h1>

      <div id="qr-file-reader" className="hidden" />

      <div className="max-w-md mx-auto bg-card rounded-3xl p-8 border border-border flex flex-col items-center text-center">
        {scanStatus === "idle" && (
          <>
            <div className="w-72 h-72 border-2 border-dashed border-primary/50 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden bg-black/30">
              {cameraActive ? (
                <div id="qr-reader" className="w-full h-full" />
              ) : (
                <>
                  <ScanLine size={64} className="text-teal-500/30 absolute animate-pulse" />
                  <p className="text-primary/70 z-10 font-medium text-sm px-4">
                    اضغط على &quot;تشغيل الكاميرا&quot; بالأسفل لتوجيهها نحو الـ QR Code
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2 w-full mb-6">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm"
                >
                  <Camera size={18} />
                  <span>تشغيل الكاميرا</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void stopCamera()}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-900/50 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm"
                >
                  <CameraOff size={18} />
                  <span>إيقاف الكاميرا</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-teal-900/40 hover:bg-teal-900/60 text-teal-300 border border-teal-800/60 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-colors text-sm"
              >
                <ImageUp size={18} />
                <span>فحص صورة تذكرة</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleFileScan(e)}
              />
            </div>

            <div className="w-full border-t border-border pt-4">
              <p className="text-xs text-gray-400 mb-2">
                أو أدخل رقم الحجز يدوياً (مثال: MW-31A364)
              </p>
              <input
                type="text"
                dir="ltr"
                placeholder="MW-31A364"
                className="w-full p-3 rounded-xl bg-muted text-white border border-border text-center mb-2 font-mono uppercase tracking-wider"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void handleScan(manualCode)}
                disabled={loading || !manualCode.trim()}
                className="w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-500 font-bold transition-colors disabled:opacity-50"
              >
                {loading ? "جاري الفحص..." : "فحص الكود"}
              </button>
            </div>
          </>
        )}

        {scanStatus === "success" && ticketData && (
          <div className="py-12 flex flex-col items-center animate-in zoom-in duration-300">
            <CheckCircle size={100} className="text-green-500 mb-6" />
            <h2 className="text-3xl font-bold text-green-400 mb-2">تذكرة صالحة!</h2>
            <p className="text-white text-lg font-bold">{ticketData.userName}</p>
            <p className="text-gray-400 text-sm mt-1" dir="ltr">
              {ticketData.userPhone}
            </p>
            <p className="text-primary text-xs mt-2 font-mono">{ticketData.code}</p>
          </div>
        )}

        {scanStatus === "error" && (
          <div className="py-12 flex flex-col items-center animate-in zoom-in duration-300">
            <XCircle size={100} className="text-red-500 mb-6" />
            <h2 className="text-3xl font-bold text-red-400 mb-2">تذكرة مرفوضة</h2>
            <p className="text-red-300 text-base">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
