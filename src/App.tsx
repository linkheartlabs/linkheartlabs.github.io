import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Shield, 
  MapPin, 
  MessageCircle, 
  Stethoscope, 
  Clock, 
  Users, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft,
  Gift,
  Trash2,
  Menu,
  X,
  Phone,
  Mail,
  Facebook,
  Instagram,
  ChevronDown,
  Star,
  Smartphone,
  Zap,
  Award,
  Mic,
  Gamepad2,
  BookOpen,
  Dumbbell,
  Plane,
  FileText,
  Activity,
  Baby,
  LogOut,
  CreditCard,
  Building2,
  Wallet,
  Calendar,
  LayoutDashboard,
  History,
  Navigation,
  Video,
  Send,
  User as UserIcon,
  Bot,
  Sparkles,
  Loader2,
  ShieldCheck,
  Lock,
  PlusCircle,
  ArrowDownToLine,
  Volume2,
  VolumeX,
  Square,
  RotateCcw
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type, FunctionDeclaration } from "@google/genai";
import { auth, db, handleFirestoreError, OperationType, FirestoreErrorInfo } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import LandingPage from "./components/LandingPage";
import Auth from "./components/Auth";

// --- Global Utilities for Linky AI ---
const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  // Xử lý thông minh cho đoạn chat dài: Chia nhỏ text thành từng câu hoặc đoạn ngắn để tránh bị browser ngắt giọng nửa chừng
  // Một số trình duyệt gặp lỗi nếu Utterance có độ dài quá lớn (> 200-300 ký tự)
  const chunks = text.match(/[^.?!]+[.?!]+|[^.?!]+/g) || [text];
  
  let delay = 0;
  chunks.forEach((chunk) => {
    const trimmedChunk = chunk.trim();
    if (trimmedChunk) {
      const utterance = new SpeechSynthesisUtterance(trimmedChunk);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  });
};

declare const process: any;

const getApiKey = (index?: number) => {
  // Use a fallback-safe check for environment variables
  // AI Studio automatically provides GEMINI_API_KEY in process.env
  if (index === undefined) return (process.env.GEMINI_API_KEY || "").trim();
  
  // Secondary keys from VITE_ for redundancy
  const env = (window as any).process?.env || {};
  if (index === 1) return (env.VITE_GEMINI_API_KEY_1 || env.GEMINI_API_KEY_1 || "").trim();
  if (index === 2) return (env.VITE_GEMINI_API_KEY_2 || env.GEMINI_API_KEY_2 || "").trim();
  if (index === 3) return (env.VITE_GEMINI_API_KEY_3 || env.GEMINI_API_KEY_3 || "").trim();
  if (index === 4) return (env.VITE_GEMINI_API_KEY_4 || env.GEMINI_API_KEY_4 || "").trim();
  if (index === 5) return (env.VITE_GEMINI_API_KEY_5 || env.GEMINI_API_KEY_5 || "").trim();
  return "";
};

// --- Tools for Linky AI ---
const createHelpRequestTool: FunctionDeclaration = {
  name: "createHelpRequest",
  description: "Tạo một yêu cầu giúp đỡ mới lên hệ thống.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      service: { type: Type.STRING, description: "Loại dịch vụ cần giúp (ví dụ: 'Đi chợ hộ', 'Dọn dẹp', 'Cấp cứu')" },
      location: { type: Type.STRING, description: "Địa điểm cần giúp đỡ (Nếu khẩn cấp, để trống hoặc ghi 'Vị trí đã định vị')" },
      time: { type: Type.STRING, description: "Thời gian thực hiện (ví dụ: 'Ngay bây giờ', 'Sáng mai')" },
      phoneNumber: { type: Type.STRING, description: "Số điện thoại liên hệ" }
    },
    required: ["service"]
  }
};

const searchHelpRequestsTool: FunctionDeclaration = {
  name: "searchHelpRequests",
  description: "Tìm kiếm các yêu cầu giúp đỡ xung quanh hoặc theo loại dịch vụ.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: "Từ khóa tìm kiếm (ví dụ: 'gần đây', 'y tế')" }
    }
  }
};

const callCompanionTool: FunctionDeclaration = {
  name: "callCompanion",
  description: "Gọi hoặc kết nối với một cộng tác viên (Linky) gần nhất.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: { type: Type.STRING, description: "Lý do cần gọi (ví dụ: 'Cần hỗ trợ y tế khẩn cấp')" }
    },
    required: ["reason"]
  }
};

const updateHelpStatusTool: FunctionDeclaration = {
  name: "updateHelpStatus",
  description: "Cập nhật trạng thái của một yêu cầu giúp đỡ (Chấp nhận, hoàn thành, hủy).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      requestId: { type: Type.STRING, description: "ID của yêu cầu" },
      status: { type: Type.STRING, enum: ["matched", "completed", "open"], description: "Trạng thái mới" }
    },
    required: ["requestId", "status"]
  }
};

// --- Execution Handlers for Linky AI ---
const handleToolCall = async (call: { name: string, args: any }) => {
  console.log("Linky AI calling tool:", call.name, call.args);
  const user = auth.currentUser;

  try {
    switch (call.name) {
      case "createHelpRequest": {
        if (!user) return "Vui lòng đăng nhập để thực hiện hành động này.";
        window.dispatchEvent(new CustomEvent('linky-action', { 
          detail: { title: "Tạo yêu cầu", type: "create", detail: call.args.service } 
        }));

        // Mock coordinates for visual map
        const mockCoords = { 
          x: Math.floor(Math.random() * 60) + 20, 
          y: Math.floor(Math.random() * 60) + 20 
        };

        const docRef = await addDoc(collection(db, "helpRequests"), {
          userId: user?.uid || "anonymous",
          userName: user?.displayName || "Người dùng LinkHeart",
          userImg: user?.photoURL || "https://picsum.photos/seed/user/100/100",
          service: call.args.service,
          location: call.args.location || "Đã định vị qua GPS",
          coords: mockCoords,
          time: call.args.time || "Ngay lập tức",
          phoneNumber: call.args.phoneNumber || "Chưa cung cấp",
          status: "open",
          createdAt: serverTimestamp()
        });
        
        window.dispatchEvent(new CustomEvent('linky-action', { 
          detail: { title: "Cứu hộ khẩn cấp", type: "emergency", detail: `Đang liên hệ viện gần nhất cho yêu cầu: ${call.args.service}` } 
        }));

        return `Đã xác nhận yêu cầu ${call.args.service}. Linky đã tự động lấy định vị GPS của bạn và đang liên hệ trực tiếp với nhân viên hoặc bệnh viện gần nhất. Hãy giữ bình tĩnh, trợ giúp đang đến ngay! (ID: ${docRef.id})`;
      }

      case "searchHelpRequests": {
        window.dispatchEvent(new CustomEvent('linky-action', { 
          detail: { title: "Tìm trợ giúp", type: "search", detail: call.args.query || "quanh đây" } 
        }));
        const q = query(collection(db, "helpRequests"), where("status", "==", "open"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (results.length === 0) return "Hiện tại không có yêu cầu giúp đỡ nào mới xung quanh bạn.";
        return `Linky tìm thấy ${results.length} người đang cần giúp đỡ: ` + results.map((r: any) => `- ${r.userName} cần ${r.service} tại ${r.location}`).join("\n");
      }

      case "callCompanion": {
        window.dispatchEvent(new CustomEvent('linky-action', { 
          detail: { title: "Kết nối khẩn cấp", type: "emergency", detail: call.args.reason } 
        }));
        // Mock finding the nearest companion
        return `Linky đã định vị được cộng tác viên 'Nguyễn Văn A' ở cách bạn 200m. Một cuộc gọi khẩn cấp đang được khởi tạo. Xin hãy giữ bình tĩnh!`;
      }

      case "updateHelpStatus": {
        window.dispatchEvent(new CustomEvent('linky-action', { 
          detail: { title: "Cập nhật yêu cầu", type: "update", detail: `Trạng thái: ${call.args.status}` } 
        }));
        const docRef = doc(db, "helpRequests", call.args.requestId);
        await updateDoc(docRef, { status: call.args.status, updatedAt: serverTimestamp() });
        const statusMap: any = { matched: "đã được chấp nhận", completed: "đã hoàn thành", open: "đã được mở lại" };
        return `Yêu cầu giúp đỡ ${call.args.requestId} hiện ${statusMap[call.args.status] || call.args.status}.`;
      }

      default:
        return "Xin lỗi, Linky không hỗ trợ hành động này ngay lúc này.";
    }
  } catch (err) {
    console.error("Tool execution error:", err);
    return "Đã có lỗi xảy ra khi thực hiện hành động. Linky rất tiếc!";
  }
};

// --- Linky AI Response with Key Rotation and Tool Handling ---
const getLinkyAIResponse = async (userPrompt: string, systemContext: string) => {
  const keysToTry = [undefined, 1, 2, 3, 4, 5]; 
  let lastError = null;

  const systemInstruction = `${systemContext}
    
    BẠN LÀ LINKY - TRỢ LÝ THÔNG MINH CỦA LINKHEART.
    Dịch vụ: Trẻ em, Người già, Gia đình.
    Hành động: createHelpRequest, searchHelpRequests, callCompanion, updateHelpStatus.
    
    QUY TẮC QUAN TRỌNG:
    1. Khi có tình huống KHẨN CẤP (cấp cứu, tai nạn, đau tim): KHÔNG ĐƯỢC hỏi địa chỉ. Hãy nói rằng Linky ĐÃ XÁC ĐỊNH ĐƯỢC VỊ TRÍ qua GPS và đang liên hệ ngay với BỆNH VIỆN hoặc NHÂN VIÊN y tế gần nhất.
    2. Phản hồi cực kỳ ngắn gọn, ấm áp, tập trung vào hành động cứu hỗ.
    3. Luôn ưu tiên an toàn tính mạng.
  `;

  for (const keyIndex of keysToTry) {
    const geminiApiKey = getApiKey(keyIndex);
    if (!geminiApiKey) continue;

    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const modelName = "gemini-3-flash-preview"; 
      
      const response = await ai.models.generateContent({
        model: modelName, 
        config: {
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [createHelpRequestTool, searchHelpRequestsTool, callCompanionTool, updateHelpStatusTool] }],
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
      });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const toolResponses = [];
        for (const call of functionCalls) {
          const result = await handleToolCall(call as any);
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { content: result }
            }
          });
        }

        const finalResponse = await ai.models.generateContent({
          model: modelName,
          config: { systemInstruction: systemInstruction },
          contents: [
            { role: "user", parts: [{ text: userPrompt }] },
            { role: "model", parts: response.candidates[0].content.parts },
            { role: "user", parts: toolResponses as any }
          ]
        });

        return finalResponse.text || "Linky đã hoàn thành yêu cầu của bạn.";
      }

      return response.text || "Linky đã nhận được thông tin.";
    } catch (error: any) {
      console.warn(`Linky API Key Error (${keyIndex || 'Primary'}):`, error.message);
      lastError = error;
      // If it's a quota or safety error, try next key immediately
      if (error.message?.includes('429') || error.message?.includes('safety')) continue;
      // If it's a fatal error but we have more keys, try one more
    }
  }

  if (lastError) {
    if (lastError.message?.includes('429')) return "Linky đang hơi quá tải một xíu do có nhiều người cùng hỏi, bạn đợi mình 5-10 giây rồi hỏi lại nhé! Cảm ơn bạn.";
    throw lastError;
  }
  return "Linky đang bảo trì hệ thống não bộ một chút. Bạn hãy thử tải lại trang hoặc nhắn lại cho mình sau vài phút nhé!";
};

(window as any).getLinkyAIResponse = getLinkyAIResponse;

// --- Types ---
type UserType = 'portal' | 'kids' | 'pro' | 'elderly' | 'pricing' | 'payment';
type ProView = 'home' | 'dashboard' | 'management' | 'appointments' | 'wallet' | 'tracking' | 'footer-page' | 'reviews' | 'dating' | 'plans';

interface Plan {
  id: string;
  name: string;
  price: string;
  rawPrice: number;
  period: string;
  features: string[];
  color: string;
  button: string;
  highlight?: boolean;
  isCurrent?: boolean;
}

interface Appointment {
  id: string;
  service: string;
  companion: typeof COMPANIONS[0];
  status: 'pending' | 'active' | 'completed';
  time: string;
  location: string;
}

interface KidRequest {
  id: number;
  kidName: string;
  item: string;
  price: string;
  status: 'pending' | 'approved' | 'rejected';
  category?: string;
}

// --- Portal Component ---
const Portal = ({ onSelect }: { onSelect: (type: UserType) => void }) => {
  const [searchValue, setSearchValue] = useState('');

  const handleAskLinky = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    
    // Dispatch custom event to trigger LinkyAI component
    const event = new CustomEvent('ask-linky', { detail: searchValue });
    window.dispatchEvent(event);
    setSearchValue('');
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center p-4 py-12 md:py-24 relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[140px] -ml-80 -mb-80" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 max-w-4xl relative z-10 w-full"
      >
        <div className="inline-block px-4 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-6 uppercase tracking-widest">
          Kết nối tâm giao - Lan tỏa yêu thương
        </div>
        <h1 
          className="text-5xl md:text-7xl font-normal mb-8 leading-tight font-display"
        >
          LinkHeart: Đồng hành <br className="hidden md:block" />
          <span className="text-colorful italic font-bold">đa thế hệ</span>
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto font-medium">
          Dịch vụ chăm sóc và đồng hành tin cậy cho mọi thành viên trong gia đình bạn.
        </p>
        
        {/* New Redesigned "ASK LINKY" Center Bar */}
        <div className="max-w-2xl mx-auto mb-12 relative">
          <form 
            onSubmit={handleAskLinky}
            className="group relative flex items-center bg-white rounded-[32px] p-2 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] border-2 border-gray-100 hover:border-blue-400 transition-all focus-within:ring-8 focus-within:ring-blue-100"
          >
            <div className="pl-6 text-blue-500">
               <Bot className="w-8 h-8 animate-pulse" />
            </div>
            <input 
              type="text" 
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Bạn muốn tìm ai cho bé, hay hỗ trợ cho cha mẹ? Hỏi Linky ngay..."
              className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-lg font-bold text-gray-800 placeholder:text-gray-300"
            />
            <button 
              type="submit"
              className="bg-gray-900 text-white p-4 rounded-[24px] hover:bg-blue-600 transition-colors shadow-lg active:scale-95"
            >
              <Send className="w-6 h-6" />
            </button>
          </form>
          
          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Gợi ý cho bạn:</span>
             {['Anh chị dạy kèm', 'Bạn tập gym', 'Bác sĩ thăm khám', 'Kể chuyện đêm muộn'].map(s => (
               <button 
                 key={s}
                 onClick={() => {
                   const event = new CustomEvent('ask-linky', { detail: s });
                   window.dispatchEvent(event);
                 }}
                 className="px-4 py-1.5 bg-white border border-gray-100 rounded-full text-xs font-bold text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
               >
                 {s}
               </button>
             ))}
          </div>
        </div>

      </motion.div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl w-full relative z-10">
        {[
          { 
            id: 'kids', 
            title: 'Cho bé yêu', 
            desc: 'Dưới 18 tuổi. Tìm anh chị sinh viên dạy kèm, chơi thể thao, kể chuyện.',
            icon: <Baby className="w-12 h-12 text-kids-orange" />,
            color: 'border-kids-orange hover:bg-kids-orange/5',
            tag: 'The Bright Theme'
          },
          { 
            id: 'pro', 
            title: 'Cho chính tôi', 
            desc: 'Người trưởng thành. Tìm bạn tập gym, du lịch, hoặc đặt dịch vụ cho cha mẹ.',
            icon: <Users className="w-12 h-12 text-pro-green" />,
            color: 'border-pro-green hover:bg-pro-green/5',
            tag: 'The Professional Theme'
          },
          { 
            id: 'elderly', 
            title: 'Cho cha mẹ', 
            desc: 'Người cao tuổi. Chế độ hỗ trợ đặc biệt với giao diện siêu đơn giản.',
            icon: <Heart className="w-12 h-12 text-primary" />,
            color: 'border-primary hover:bg-primary/5',
            tag: 'The Comfort Theme'
          }
        ].map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onSelect(item.id as UserType)}
            className={`p-10 rounded-[48px] border-4 bg-white text-left transition-all group ${item.color} shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_40px_60px_-20px_rgba(0,0,0,0.15)] hover:-translate-y-2`}
          >
            <div className="mb-8 p-4 bg-gray-50 rounded-2xl w-fit group-hover:scale-110 transition-transform">{item.icon}</div>
            <h3 className="text-3xl font-bold mb-3">{item.title}</h3>
            <p className="text-gray-500 text-lg mb-6 leading-relaxed">{item.desc}</p>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
               {item.tag} <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};
// --- Action Notification Popup ---
const LinkyActionPopup = () => {
  const [action, setAction] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      setAction(e.detail);
      setTimeout(() => setAction(null), 5000);
    };
    window.addEventListener('linky-action', handler);
    return () => window.removeEventListener('linky-action', handler);
  }, []);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] w-full max-w-sm"
        >
          <div className="mx-4 bg-white/90 backdrop-blur-xl border-4 border-blue-100 rounded-[32px] p-6 shadow-2xl flex items-center gap-5">
             <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
               action.type === 'emergency' ? 'bg-red-500 text-white animate-pulse' : 
               action.type === 'create' ? 'bg-green-500 text-white' : 
               'bg-blue-500 text-white'
             }`}>
               {action.type === 'emergency' ? <Activity size={32} /> : 
                action.type === 'create' ? <PlusCircle size={32} /> : 
                <Bot size={32} />}
             </div>
             <div className="flex-1">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Linky AI Action</p>
                <h4 className="text-xl font-black text-gray-900 leading-tight">{action.title}</h4>
                <p className="text-xs font-bold text-gray-500 italic mt-1">{action.detail}</p>
             </div>
             <button onClick={() => setAction(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-300" />
             </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- LinkyAI Persistent Assistant Component ---
const LinkyAI = ({ user }: { user: FirebaseUser | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { 
      role: 'ai', 
      text: user 
        ? `Chào ${user.displayName || 'bạn'}, Linky đây! Mình có thể giúp gì cho gia đình bạn hôm nay?` 
        : "Chào bạn! Mình là Linky, trợ lý ảo của LinkHeart. Bạn cần mình tư vấn gì về dịch vụ cho bé, gia đình hay cha mẹ không?" 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthesisRef.current = window.speechSynthesis;
  }, []);

  // Giọng nói Linky
  const speak = (text: string) => {
    if (!synthesisRef.current || !isVoiceEnabled) return;
    synthesisRef.current.cancel();
    
    // Xóa markdown và làm sạch văn bản
    const cleanText = text.replace(/[*#_`]/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    if (!cleanText) return;
    
    // Chia văn bản thành các câu nhỏ để tránh treo trình duyệt (limit 160 chars)
    const chunks = cleanText.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [cleanText];
    let chunkIndex = 0;

    const processNextChunk = () => {
      if (chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].trim());
      const voices = synthesisRef.current?.getVoices() || [];
      const viVoice = voices.find(v => v.lang.startsWith('vi')) || voices.find(v => v.name.includes('Vietnamese'));
      
      if (viVoice) utterance.voice = viVoice;
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        chunkIndex++;
        processNextChunk();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        // Fallback: try next chunk anyway
        chunkIndex++;
        processNextChunk();
      };

      synthesisRef.current?.speak(utterance);
    };

    processNextChunk();
  };

  const stopSpeaking = () => {
    synthesisRef.current?.cancel();
    setIsSpeaking(false);
  };

  // Khởi động hệ thống giọng nói khi người dùng tương tác lần đầu
  useEffect(() => {
    const handleAskLinky = (e: any) => {
      const text = e.detail;
      if (text) {
        setIsOpen(true);
        handleSend(text);
      }
    };
    
    window.addEventListener('ask-linky', handleAskLinky);

    const unlockAudio = () => {
      if (synthesisRef.current) {
        const u = new SpeechSynthesisUtterance("");
        synthesisRef.current.speak(u);
      }
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    
    const loadVoices = () => synthesisRef.current?.getVoices();
    if (synthesisRef.current) {
      synthesisRef.current.addEventListener('voiceschanged', loadVoices);
      loadVoices();
    }
    
    // Khởi tạo Speech Recognition
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'vi-VN';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript) handleSend(transcript);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
    
    return () => {
      window.removeEventListener('ask-linky', handleAskLinky);
      window.removeEventListener('click', unlockAudio);
      if (synthesisRef.current) {
        synthesisRef.current.removeEventListener('voiceschanged', loadVoices);
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      stopSpeaking();
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  const handleSend = async (manualInput?: string) => {
    const textToSend = manualInput || input.trim();
    if (!textToSend || isTyping) return;

    // Detect emergency keywords for immediate UI feedback
    const lowText = textToSend.toLowerCase();
    const isEmergency = lowText.includes('cấp cứu') || lowText.includes('khẩn cấp') || lowText.includes('ngất') || lowText.includes('đau tim') || lowText.includes('tai nạn');
    
    if (isEmergency) {
      // Instant UI response for life-threatening situations
      const emergencyMsg = "🚨 KHẨN CẤP! Linky đã xác định được vị trí của bạn qua GPS. Tôi đang gọi trực tiếp cho bệnh viện gần nhất và cử nhân viên y tế đến ngay lập tức! Bạn hãy giữ bình tĩnh và giữ máy nhé.";
      setMessages(prev => [...prev, { role: 'ai', text: emergencyMsg }]);
      speak(emergencyMsg);
      
      // Dispatch immediate action event for UI feedback
      window.dispatchEvent(new CustomEvent('linky-action', { 
        detail: { title: "CỨU HỘ KHẨN CẤP", type: "emergency", detail: "Đang gọi trung tâm trợ giúp và bệnh viện gần nhất..." } 
      }));
      
      setIsTyping(true);
      try {
        await getLinkyAIResponse(textToSend, "HÀNH ĐỘNG KHẨN CẤP: GỌI CỨU HỘ NGAY. Không được hỏi thêm thông tin, hãy gọi tool createHelpRequest với service='Cấp cứu'.");
      } catch (e) {
        console.error("Emergency tool call failed", e);
      } finally {
        setIsTyping(false);
      }
      return; 
    }

    if (!manualInput) setInput('');
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setIsTyping(true);

    try {
      const systemInstruction = `Bạn là Linky, trợ lý AI của LinkHeart. Ưu tiên hành động nhanh, ngắn gọn. 
        Nếu người dùng cần giúp đỡ, hãy giả định bạn đã biết vị trí của họ qua hệ thống định vị của ứng dụng.`;

      const aiText = await getLinkyAIResponse(textToSend, systemInstruction);
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
      speak(aiText);
    } catch (error: any) {
      console.error("Linky error:", error);
      const errorMsg = error.message?.includes('429') 
        ? "Linky đang hơi quá tải một xíu do có nhiều người cùng hỏi, bạn đợi mình 5-10 giây rồi hỏi lại nhé! Cảm ơn bạn."
        : "Linky đang gặp chút trục trặc mạng. Hãy thử lại trong giây lát!";
      setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    stopSpeaking();
    setMessages([{ 
      role: 'ai', 
      text: "Đã làm mới hội thoại! Linky sẵn sàng cho câu hỏi tiếp theo của bạn." 
    }]);
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[500]">
      {/* Cửa sổ chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className={`
              fixed bottom-24 right-4 w-[calc(100vw-32px)] md:w-[450px]
              h-[calc(100vh-140px)] max-h-[600px]
              bg-white rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] 
              flex flex-col overflow-hidden border border-gray-200 z-[510]
            `}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shadow-inner">
                  <Heart className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <h4 className="font-bold text-xl leading-none">Linky AI Assistant</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                    <span className="text-[11px] uppercase font-black tracking-widest opacity-90">Sẵn sàng hỗ trợ</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  className={`p-2.5 rounded-full transition-all active:scale-90 ${isVoiceEnabled ? 'text-white hover:bg-white/10' : 'text-white/40 hover:bg-white/5'}`}
                  title={isVoiceEnabled ? "Tắt giọng nói" : "Bật giọng nói"}
                >
                  {isVoiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
                <button 
                  onClick={clearChat}
                  className="p-2.5 hover:bg-white/10 rounded-full transition-all active:scale-90"
                  title="Làm mới cuộc hội thoại"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsImmersive(true)}
                  className="p-2.5 hover:bg-white/10 rounded-full transition-all active:scale-90"
                  title="Chế độ cuộc gọi AI"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 hover:bg-white/10 rounded-full transition-all active:scale-90"
                >
                  <X className="w-7 h-7" />
                </button>
              </div>
            </div>

            {/* Chat Content */}
            <div 
              ref={scrollRef} 
              className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50 custom-scrollbar"
            >
              {messages.map((m, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
                >
                  {m.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className={`
                      p-4 rounded-[24px] shadow-sm relative group
                      ${m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white text-gray-800 border-2 border-slate-100 rounded-bl-none'}
                    `}>
                      <div className="markdown-body prose-sm">
                        <ReactMarkdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                        >
                          {m.text}
                        </ReactMarkdown>
                      </div>
                      
                      {m.role === 'ai' && (
                        <button 
                          onClick={() => speak(m.text)}
                          className="absolute -right-10 bottom-0 p-2 bg-white rounded-full shadow-md text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                          title="Phát lại giọng nói"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0" />
                  <div className="bg-white p-4 rounded-3xl rounded-bl-none border-2 border-slate-100 flex gap-1.5 shadow-sm">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Panel */}
            <div className="p-5 bg-white border-t border-gray-100 space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] shrink-0">
              {isSpeaking && (
                <div className="flex items-center justify-between bg-blue-50/80 backdrop-blur px-4 py-3 rounded-2xl border border-blue-200">
                  <div className="flex items-center gap-3 text-blue-700 text-[11px] font-black tracking-widest uppercase">
                    <div className="flex gap-0.5 items-end h-3">
                      <div className="w-1 bg-blue-600 rounded-full animate-[voice-wave_0.5s_infinite_alternate]" />
                      <div className="w-1 bg-blue-600 rounded-full animate-[voice-wave_0.7s_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1 bg-blue-600 rounded-full animate-[voice-wave_0.6s_infinite_alternate]" style={{ animationDelay: '0.2s' }} />
                    </div>
                    Đang phát giọng nói...
                  </div>
                  <button 
                    onClick={stopSpeaking} 
                    className="text-[10px] text-red-500 font-black uppercase hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors border border-red-100"
                  >
                    Dừng
                  </button>
                </div>
              )}
              
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Hỏi Linky bất cứ điều gì..."
                  className="flex-1 bg-gray-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm focus:ring-4 focus:ring-blue-100 focus:bg-white focus:border-blue-400 transition-all outline-none text-gray-800 placeholder:text-gray-400 font-medium"
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={isTyping || !input.trim()}
                  className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center hover:shadow-xl hover:shadow-blue-200 active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  <Send className="w-7 h-7" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode Immersive (Hội thoại AI kiểu Gemini/ChatGPT) */}
      <AnimatePresence>
        {isImmersive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 overflow-hidden"
          >
            {/* Background Animations */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
               <motion.div 
                 animate={{ 
                   scale: [1, 1.2, 1],
                   rotate: [0, 90, 0]
                 }}
                 transition={{ duration: 20, repeat: Infinity }}
                 className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-blue-600 rounded-full blur-[100px]" 
               />
               <motion.div 
                 animate={{ 
                   scale: [1, 1.3, 1],
                   rotate: [0, -45, 0]
                 }}
                 transition={{ duration: 15, repeat: Infinity }}
                 className="absolute -bottom-[20%] -right-[10%] w-[80%] h-[80%] bg-indigo-600 rounded-full blur-[100px]" 
               />
            </div>

            {/* Close Button */}
            <button 
              onClick={() => {
                setIsImmersive(false);
                stopSpeaking();
                setIsListening(false);
              }}
              className="absolute top-8 right-8 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Central Visualizer */}
            <div className="relative z-10 flex flex-col items-center gap-16">
               <div className="relative w-64 h-64 flex items-center justify-center">
                  {/* Aura rings */}
                  <AnimatePresence>
                    {(isSpeaking || isTyping || isListening) && (
                      <>
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 border-4 border-blue-400/30 rounded-full"
                        />
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 2.5, opacity: 0 }}
                          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                          className="absolute inset-0 border-2 border-indigo-400/20 rounded-full"
                        />
                      </>
                    )}
                  </AnimatePresence>

                  {/* The actual dot/circle */}
                  <motion.div
                    animate={
                      isSpeaking ? { 
                        scale: [1, 1.15, 1],
                        backgroundColor: ['#2563eb', '#6366f1', '#2563eb'],
                        boxShadow: [
                          '0 0 40px rgba(37, 99, 235, 0.5)',
                          '0 0 80px rgba(99, 102, 241, 0.8)',
                          '0 0 40px rgba(37, 99, 235, 0.5)'
                        ]
                      } : isListening ? {
                        scale: [1, 1.25, 1],
                        backgroundColor: '#ef4444',
                        boxShadow: '0 0 60px rgba(239, 68, 68, 0.6)'
                      } : isTyping ? {
                        scale: [0.95, 1.05, 0.95],
                        backgroundColor: '#94a3b8'
                      } : {
                        scale: 1,
                        backgroundColor: '#2563eb',
                        boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)'
                      }
                    }
                    transition={{ 
                      duration: isSpeaking ? 0.4 : isListening ? 1.5 : 2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-48 h-48 rounded-full flex items-center justify-center relative cursor-pointer group"
                    onClick={toggleListening}
                  >
                    {isListening ? (
                       <Square className="w-16 h-16 text-white" />
                    ) : (
                       <Mic className="w-16 h-16 text-white group-hover:scale-110 transition-transform" />
                    )}
                  </motion.div>
               </div>

               {/* Status Text */}
               <div className="text-center space-y-4 max-w-xl">
                  <h2 className="text-4xl font-black text-white tracking-tighter uppercase">
                    {isSpeaking ? 'Linky đang nói...' : 
                     isListening ? 'Đang lắng nghe bạn...' : 
                     isTyping ? 'Linky đang suy nghĩ...' : 
                     'Chạm vào để bắt đầu nói'}
                  </h2>
                  <p className="text-blue-200 text-lg font-medium opacity-70 italic px-4">
                    {messages[messages.length - 1].role === 'ai' ? 
                      messages[messages.length - 1].text.substring(0, 100) + (messages[messages.length - 1].text.length > 100 ? '...' : '') :
                      `" ${messages[messages.length - 1].text} "`
                    }
                  </p>
               </div>
            </div>

            {/* Voice Control Buttons */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-8 z-10">
               <button 
                 onClick={toggleListening}
                 className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-white/10 hover:bg-white/20'}`}
               >
                 <Mic className={`w-8 h-8 text-white ${isListening ? 'animate-pulse' : ''}`} />
               </button>
               {isSpeaking && (
                 <button 
                   onClick={stopSpeaking}
                   className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-500 transition-all text-white"
                 >
                   <Square className="w-6 h-6" />
                 </button>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-600 rounded-full shadow-[0_15px_30px_rgba(37,99,235,0.4)] flex items-center justify-center text-white relative z-[600] group"
      >
        <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20 pointer-events-none" />
        {isOpen ? <X className="w-8 h-8 sm:w-10 sm:h-10" /> : <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10" />}
        
        {!isOpen && (
          <div className="absolute right-24 bg-white px-6 py-3 rounded-[24px] shadow-2xl border border-blue-50 hidden md:block pointer-events-none whitespace-nowrap animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Linky AI</p>
            </div>
            <p className="text-sm font-bold text-gray-800">Cần Linky trợ giúp gì không?</p>
          </div>
        )}
      </motion.button>
    </div>
  );
};

const VoiceAssistant = ({ mode, onResponse }: { mode: 'kids' | 'elderly', onResponse: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      window.speechSynthesis.cancel(); // Dừng nói khi bắt đầu nghe
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResponse(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    // Chỉ expose nếu mode khớp (để tránh xung đột giữa các mode nếu có)
    (window as any).triggerLinkyVoice = startListening;
    return () => { (window as any).triggerLinkyVoice = null; };
  }, []);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={startListening}
      className={`flex items-center gap-2 px-6 py-3 rounded-full font-black text-sm transition-all shadow-lg ${
        isListening 
          ? 'bg-red-500 text-white animate-pulse' 
          : mode === 'kids' ? 'bg-kids-blue text-white hover:bg-opacity-90' : 'bg-primary text-white hover:bg-opacity-90'
      }`}
    >
      <Mic className={`w-5 h-5 ${isListening ? 'animate-bounce' : ''}`} />
      <span>{isListening ? 'ĐANG NGHE...' : 'HỎI LINKY'}</span>
    </motion.button>
  );
};

// --- Mock Data ---
interface Companion {
  id: string;
  name: string;
  age: number;
  school: string;
  rating: number;
  bio: string;
  img: string;
  skills: string[];
  price?: number;
}

const COMPANIONS: Companion[] = [
  { id: 'c1', name: 'Nguyễn Minh Anh', age: 21, school: 'ĐH Ngoại Thương', rating: 4.9, bio: 'Năng động, yêu trẻ em, có chứng chỉ sơ cứu.', img: 'https://picsum.photos/seed/c1/200/200', skills: ['Tiếng Anh', 'Dạy vẽ'] },
  { id: 'c2', name: 'Trần Hoàng Nam', age: 22, school: 'ĐH Bách Khoa', rating: 4.8, bio: 'Giỏi toán, thích chơi thể thao, nhiệt tình.', img: 'https://picsum.photos/seed/c2/200/200', skills: ['Toán', 'Bóng rổ'] },
  { id: 'c3', name: 'Lê Thị Thanh', age: 20, school: 'ĐH Sư Phạm', rating: 5.0, bio: 'Kỹ năng kể chuyện tốt, kiên nhẫn và chu đáo.', img: 'https://picsum.photos/seed/c3/200/200', skills: ['Kể chuyện', 'Âm nhạc'] },
  { id: 'c4', name: 'Phạm Đức Hiếu', age: 23, school: 'ĐH Y Dược', rating: 4.7, bio: 'Kiến thức y tế tốt, điềm đạm, hỗ trợ người già tốt.', img: 'https://picsum.photos/seed/c4/200/200', skills: ['Sơ cứu', 'Y tế'] }
];

const PRICES = {
  kids: 149000,
  social: 119000,
  senior: 179000
};

const HIEU_THAO_PACKAGES = [
  { id: 's', title: 'Hiếu Thảo S', hours: 20, price: 3390000, desc: 'Phù hợp dùng thử, làm quen với Companion.' },
  { id: 'm', title: 'Hiếu Thảo M', hours: 40, price: 6390000, desc: 'Tặng máy đo huyết áp điện tử + Báo cáo.' },
  { id: 'l', title: 'Hiếu Thảo L', hours: 60, price: 8990000, desc: 'Companion cố định + Nút SOS 24/7 + Miễn phí Tech-Tutor.' }
];

const KIDS_MISSIONS = [
  { id: 1, title: 'Nhà toán học nhí', task: 'Giải 5 bài toán cùng Companion', badge: '🧮' },
  { id: 2, title: 'Kình ngư nhỏ', task: 'Hoàn thành buổi tập bơi', badge: '🏊' },
  { id: 3, title: 'Họa sĩ tài ba', task: 'Vẽ một bức tranh về gia đình', badge: '🎨' }
];

const HANDBOOK_CONTENT = {
  kids: [
    { title: '3 Quy tắc vàng', content: '1. Luôn đi cùng anh chị Companion. 2. Không nhận quà người lạ. 3. Gọi bố mẹ ngay khi cần.' },
    { title: 'Nhận diện LinkHeart', content: 'Anh chị luôn mặc áo đồng hồ xanh, có thẻ tên và mã QR xác minh trên ngực.' },
    { title: 'Cách dùng nút SOS', content: 'Nhấn giữ nút đỏ trên màn hình 3 giây để gọi cứu hộ và bố mẹ ngay lập tức.' }
  ],
  elderly: [
    { title: 'An toàn đi dạo', content: 'Luôn mang theo điện thoại, đi giày êm và thông báo cho người thân trước khi đi.' },
    { title: 'Dùng trợ lý ảo', content: 'Chỉ cần nhấn nút Mic và nói "Gọi con" hoặc "Tìm người đi dạo", cháu sẽ hỗ trợ ngay.' },
    { title: 'Bảo mật thông tin', content: 'Không cung cấp mật khẩu ngân hàng cho bất kỳ ai, kể cả người đồng hành.' }
  ]
};

// --- Dating View Component ---
const DatingView = ({ onBack, showToast }: { onBack: () => void; showToast: (msg: string) => void }) => {
  const [profiles, setProfiles] = useState([
    { id: 1, name: 'Minh Thư', age: 24, job: 'Thiết kế đồ họa', bio: 'Thích du lịch và chụp ảnh phim.', img: 'https://picsum.photos/seed/d1/400/600' },
    { id: 2, name: 'Quốc Bảo', age: 26, job: 'Kỹ sư phần mềm', bio: 'Yêu âm nhạc, guitar và chạy bộ buổi sáng.', img: 'https://picsum.photos/seed/d2/400/600' },
    { id: 3, name: 'Hân Nguyễn', age: 23, job: 'Marketing', bio: 'Năng động, thích mèo và latte đá.', img: 'https://picsum.photos/seed/d3/400/600' },
    { id: 4, name: 'Đức Anh', age: 27, job: 'Bác sĩ', bio: 'Thích đi bơi và đọc sách cuối tuần.', img: 'https://picsum.photos/seed/d4/400/600' },
    { id: 5, name: 'Thanh Thảo', age: 22, job: 'Sinh viên', bio: 'Thích vẽ tranh và đi dạo phố.', img: 'https://picsum.photos/seed/d5/400/600' },
    { id: 6, name: 'Hoàng Long', age: 25, job: 'Kiến trúc sư', bio: 'Yêu thiên nhiên và các công trình cổ.', img: 'https://picsum.photos/seed/d6/400/600' },
  ]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedProfiles, setLikedProfiles] = useState<any[]>([]);
  const [view, setView] = useState<'discover' | 'liked' | 'chat'>('discover');
  const [selectedChat, setSelectedChat] = useState<any>(null);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (currentIndex >= profiles.length) return;
    if (direction === 'right') {
      const profile = profiles[currentIndex];
      setLikedProfiles(prev => [...prev, profile]);
      showToast(`Đã thích ${profile.name}!`);
    }
    setCurrentIndex(prev => prev + 1);
  };

  const startChat = (profile: any) => {
    setSelectedChat(profile);
    setView('chat');
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-8 min-h-[80vh] flex flex-col items-center">
      <div className="w-full flex flex-col md:flex-row justify-between items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">Hẹn hò</h2>
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Heart className="text-red-500 fill-current w-10 h-10" />
          </motion.div>
        </div>
        
        <div className="flex bg-gray-100 p-1.5 rounded-3xl gap-1">
          {[
            { id: 'discover', label: 'Khám phá', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'liked', label: 'Đã thích', icon: <Heart className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as any)}
              className={`px-6 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${view === tab.id ? 'bg-white shadow-md text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {tab.icon} {tab.label}
              {tab.id === 'liked' && likedProfiles.length > 0 && (
                <span className="ml-1 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px]">
                  {likedProfiles.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'discover' && (
          <motion.div 
            key="discover" 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full h-full flex flex-col items-center"
          >
            <div className="relative w-full aspect-[3/4] max-w-sm">
              <AnimatePresence mode="popLayout">
                {currentIndex < profiles.length ? (
                  <motion.div
                    key={profiles[currentIndex].id}
                    initial={{ scale: 0.9, opacity: 0, x: 0 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    exit={{ 
                      x: 300, 
                      opacity: 0, 
                      rotate: 20,
                      transition: { duration: 0.4 } 
                    }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 100) handleSwipe('right');
                      else if (info.offset.x < -100) handleSwipe('left');
                    }}
                    className="absolute inset-0 bg-white rounded-[48px] shadow-2xl border-4 border-white overflow-hidden cursor-grab active:cursor-grabbing"
                  >
                    <img 
                      src={profiles[currentIndex].img} 
                      className="w-full h-full object-cover pointer-events-none" 
                      alt={profiles[currentIndex].name}
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/90 to-transparent text-white">
                      <div className="flex items-end gap-3 mb-2">
                        <h3 className="text-4xl font-black">{profiles[currentIndex].name}</h3>
                        <span className="text-2xl font-bold opacity-80 mb-1">{profiles[currentIndex].age}</span>
                      </div>
                      <p className="font-black text-red-400 mb-4 uppercase text-xs tracking-[0.2em]">{profiles[currentIndex].job}</p>
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                        <p className="text-sm font-bold leading-relaxed">"{profiles[currentIndex].bio}"</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-gray-50 rounded-[48px] border-4 border-dashed border-gray-200">
                     <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-8">
                       <Heart className="w-12 h-12 text-gray-300" />
                     </div>
                     <h4 className="text-3xl font-black text-gray-400 uppercase tracking-tighter mb-4">Hết lượt!</h4>
                     <p className="text-sm text-gray-400 font-bold mb-8">Bạn đã xem hết hồ sơ ngày hôm nay. Hãy quay lại vào ngày mai nhé!</p>
                     <button 
                      onClick={() => setCurrentIndex(0)}
                      className="px-10 py-5 bg-gray-900 text-white rounded-[24px] font-black uppercase text-sm shadow-xl active:scale-95 transition-all"
                     >
                       Tải lại danh sách
                     </button>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {currentIndex < profiles.length && (
              <div className="flex gap-10 items-center justify-center pt-8">
                  <button 
                    onClick={() => handleSwipe('left')}
                    className="w-20 h-20 bg-white shadow-xl rounded-full flex items-center justify-center text-gray-400 border-4 border-gray-50 hover:scale-110 active:scale-95 transition-all group"
                  >
                    <Zap className="w-8 h-8 rotate-180 group-hover:text-yellow-500" />
                  </button>
                  <button 
                    onClick={() => handleSwipe('right')}
                    className="w-24 h-24 bg-red-500 shadow-2xl rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all"
                  >
                    <Heart className="w-10 h-10 fill-current" />
                  </button>
              </div>
            )}
          </motion.div>
        )}

        {view === 'liked' && (
          <motion.div 
            key="liked" 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -20 }}
            className="w-full grid grid-cols-2 md:grid-cols-3 gap-6"
          >
            {likedProfiles.length === 0 ? (
              <div className="col-span-full py-20 text-center opacity-40">
                <Heart className="w-20 h-20 mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest italic">Chưa thích ai cả...</p>
              </div>
            ) : likedProfiles.map(p => (
              <motion.div 
                key={p.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[32px] overflow-hidden shadow-lg border border-gray-100 group"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img src={p.img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                    <p className="font-black text-white text-lg">{p.name}, {p.age}</p>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{p.job}</p>
                  </div>
                </div>
                <div className="p-4">
                  <button 
                    onClick={() => startChat(p)}
                    className="w-full py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-pro-green transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> Nhắn tin ngay
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {view === 'chat' && selectedChat && (
          <motion.div 
            key="chat" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg bg-white rounded-[48px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[600px]"
          >
            <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('liked')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <img src={selectedChat.img} className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-md mx-auto" alt={selectedChat.name} referrerPolicy="no-referrer" />
                <div>
                  <h4 className="font-black text-gray-900 leading-none">{selectedChat.name}</h4>
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mt-1 italic">Đang hoạt động</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-3 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-pro-green transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="p-3 bg-white rounded-2xl shadow-sm text-gray-400 hover:text-pro-green transition-colors"><Video className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="flex-1 p-6">
              <ChatSimulation onBack={() => setView('liked')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Staff Board Component (Senior Mode) ---
const StaffSection = ({ onSelectStaff, showSimulation, mode = 'elderly' }: { onSelectStaff: (staff: any) => void, showSimulation: (title: string, content: string, type: any, data?: any) => void, mode?: 'elderly' | 'kids' | 'pro' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const staffMembers = [
    { 
      id: 's1', 
      name: 'Trần Văn Mạnh', 
      role: mode === 'elderly' ? 'Y tá sơ cấp' : mode === 'kids' ? 'Gia sư năng động' : 'Trợ lý gia đình', 
      status: mode === 'elderly' ? 'Đang nấu ăn cho ông bà' : mode === 'kids' ? 'Đang chuẩn bị bài giảng' : 'Đang sắp xếp lịch trình', 
      location: 'Cách 200m - Phố Nguyễn Du', 
      schedule: mode === 'elderly' ? 'Tiếp theo: Kiểm tra sức khỏe (5:30 PM)' : mode === 'kids' ? 'Tiếp theo: Dạy kèm Toán lớp 5' : 'Tiếp theo: Hỗ trợ dọn dẹp nhà cửa', 
      img: 'https://picsum.photos/seed/s1/200/200',
      tasks: [
        'Kiểm tra huyết áp buổi sáng (Hệ thống tự động)',
        'Chuẩn bị bữa ăn nhẹ dinh dưỡng (Ít muối)',
        'Hỗ trợ tập các bài tập vận động nhẹ tại chỗ',
        'Nhắc nhở uống thuốc vào khung giờ 08:00 AM',
        'Kiểm tra vệ sinh cá nhân và môi trường xung quanh',
        'Trò chuyện và đọc báo cùng ông/bà (Tin tức sáng)',
        'Kiểm tra độ an toàn của các thiết bị trong nhà',
        'Ghi chép nhật ký sức khỏe hàng ngày lên App',
        'Hỗ trợ đi dạo công viên gần nhà (30 phút)',
        'Tổng hợp báo cáo sức khỏe gửi cho gia đình buổi tối'
      ]
    },
    { 
      id: 's2', 
      name: 'Lê Thu Trang', 
      role: mode === 'elderly' ? 'Điều dưỡng' : mode === 'kids' ? 'Huấn luyện viên' : 'Bạn đồng hành thể thao', 
      status: mode === 'elderly' ? 'Đang kiểm tra sức khỏe' : mode === 'kids' ? 'Đang hướng dẫn khởi động' : 'Đang chuẩn bị thảm tập Yoga', 
      location: 'Tại nhà - Quận 1', 
      schedule: mode === 'elderly' ? 'Tiếp theo: Đi dạo công viên (6:30 PM)' : mode === 'kids' ? 'Tiếp theo: Tập bơi sáng' : 'Tiếp theo: Chạy bộ cùng chủ hộ', 
      img: 'https://picsum.photos/seed/s2/200/200',
      tasks: [
        'Kiểm tra chỉ số đường huyết sau bữa sáng',
        'Chuẩn bị nước uống thảo mộc thanh lọc cơ thể',
        'Hướng dẫn bài tập thở và điều hòa nhịp tim',
        'Phân chia thuốc theo liều lượng bác sĩ chỉ định',
        'Kiểm tra tủ thuốc và hạn sử dụng dược phẩm',
        'Tư vấn chế độ dinh dưỡng lành mạnh tuần mới',
        'Vệ sinh dụng cụ y tế cá nhân cho gia đình',
        'Ghi nhận các triệu chứng bất thường (nếu có)',
        'Đồng hành cùng ông bà đi khám sức khỏe định kỳ',
        'Báo cáo tình trạng sức khỏe chi tiết cho con cháu'
      ]
    },
    { 
      id: 's3', 
      name: 'Nguyễn Văn Nam', 
      role: mode === 'elderly' ? 'Companion' : mode === 'kids' ? 'Người kể chuyện' : 'Quản gia cao cấp', 
      status: mode === 'elderly' ? 'Đang trò chuyện cùng ông' : mode === 'kids' ? 'Đang đọc truyện cổ tích' : 'Đang kiểm tra an ninh căn hộ', 
      location: 'Phòng khách - Khu đô thị xanh', 
      schedule: mode === 'elderly' ? 'Đã hoàn thành kiểm tra sáng nay' : mode === 'kids' ? 'Tiếp theo: Kể chuyện Doremon' : 'Tiếp theo: Hỗ trợ đặt tiệc tối', 
      img: 'https://picsum.photos/seed/s3/200/200',
      tasks: [
        'Kiểm tra an ninh toàn bộ khu vực sinh hoạt',
        'Sắp xếp kệ sách và tài liệu cho gia chủ',
        'Hỗ trợ kết nối video call với người thân ở xa',
        'Đọc sách/truyện theo sở thích của ông bà',
        'Kiểm tra các vật dụng nguy hiểm trong tầm tay',
        'Chuẩn bị trà sen thư giãn buổi chiều',
        'Hỗ trợ ghi chú các việc quan trọng vào lịch treo tường',
        'Chụp ảnh kỷ niệm các khoảnh khắc trong ngày',
        'Kiểm tra nhiệt độ phòng và ánh sáng phù hợp',
        'Bảo trì các thiết bị thông minh LinkHeart trong nhà'
      ]
    }
  ];

  if (selectedStaff) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[56px] border-4 border-pro-green/20 shadow-2xl relative overflow-hidden"
      >
        <button 
          onClick={() => setSelectedStaff(null)}
          className="absolute top-8 right-8 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col md:flex-row gap-8 mb-10">
          <div className="relative shrink-0">
             <img src={selectedStaff.img} className="w-40 h-40 rounded-[48px] object-cover shadow-2xl border-4 border-white" alt={selectedStaff.name} referrerPolicy="no-referrer" />
             <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
             </div>
          </div>
          <div className="flex-1 space-y-4">
             <h3 className="text-4xl font-black text-gray-900 leading-tight">{selectedStaff.name}</h3>
             <div className="flex flex-wrap gap-2">
                <span className="px-4 py-1.5 bg-pro-green/10 text-pro-green font-black rounded-xl text-xs uppercase tracking-widest">{selectedStaff.role}</span>
                <span className="px-4 py-1.5 bg-gray-100 text-gray-500 font-black rounded-xl text-xs uppercase tracking-widest flex items-center gap-2">
                   <Navigation className="w-3 h-3" /> {selectedStaff.location}
                </span>
             </div>
             <p className="text-gray-500 font-bold italic leading-relaxed">"{selectedStaff.status}"</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
           <div className="space-y-6">
              <h4 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                 <LayoutDashboard className="text-pro-green w-6 h-6" /> Danh sách việc làm hôm nay
              </h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 no-scrollbar">
                 {selectedStaff.tasks.map((task: string, i: number) => (
                   <div key={i} className="flex gap-4 p-5 bg-gray-50 rounded-3xl border border-gray-100 items-start group hover:bg-white hover:border-pro-green transition-all shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-black text-xs group-hover:bg-pro-green group-hover:text-white transition-colors">
                        {i + 1}
                      </div>
                      <p className="text-sm font-bold text-gray-700 leading-relaxed">{task}</p>
                   </div>
                 ))}
              </div>
           </div>

           <div className="space-y-8">
              <div className="bg-gray-900 p-8 rounded-[40px] text-white space-y-6 shadow-2xl">
                 <div className="flex justify-between items-center">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Trạng thái khẩn cấp</p>
                    <Zap className="text-yellow-400 fill-current w-5 h-5" />
                 </div>
                 <p className="text-lg font-bold leading-relaxed">Bạn cần nhân viên tiếp cận ngay lập tức? Chúng tôi sẽ điều phối lộ trình nhanh nhất cho bạn.</p>
                 <button 
                  onClick={() => showSimulation('Yêu cầu di chuyển', `Nhân viên ${selectedStaff.name} đã nhận được lệnh điều phối khẩn cấp và đang hướng về phía bạn.`, 'success')}
                  className="w-full py-6 bg-red-600 hover:bg-red-700 text-white rounded-[32px] font-black text-xl shadow-xl shadow-red-900/40 active:scale-95 transition-all flex items-center justify-center gap-4"
                 >
                   <MapPin className="w-8 h-8" /> YÊU CẦU TỚI NGAY
                 </button>
              </div>

              <div className="bg-pro-green/5 p-8 rounded-[40px] border-4 border-dashed border-pro-green/20 space-y-4">
                 <p className="font-black text-pro-green uppercase tracking-widest text-xs">Phản hồi từ gia đình</p>
                 <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-6 h-6 text-yellow-500 fill-current" />)}
                 </div>
                 <p className="text-sm font-bold text-gray-600 italic">"Nhân viên rất nhiệt tình và chu đáo, ông bà rất thích được trò chuyện cùng cháu Mạnh."</p>
              </div>
           </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-4xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-4">
            <ShieldCheck className="text-pro-green w-10 h-10" /> Đội ngũ LinkHeart
          </h3>
          <p className="text-lg font-bold text-gray-400 mt-1 italic">Những người bạn đồng hành tin cậy cho mọi gia đình</p>
        </div>
        {!isExpanded && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="px-10 py-5 bg-gray-900 text-white rounded-[24px] font-black uppercase text-sm shadow-xl hover:bg-pro-green transition-all active:scale-95 flex items-center gap-3"
          >
            <Users className="w-6 h-6" /> XEM DANH SÁCH NHÂN VIÊN
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 pt-4 pb-12 border-t-4 border-pro-green/10">
              {staffMembers.map(staff => (
                <div key={staff.id} className="bg-white p-8 rounded-[48px] border-4 border-gray-50 shadow-sm hover:border-pro-green/20 transition-all group relative overflow-hidden flex flex-col justify-between h-full">
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                     <ShieldCheck className="w-32 h-32 text-pro-green" />
                  </div>
                  
                  <div className="flex items-center gap-5 mb-8 relative z-10">
                    <div className="relative">
                      <img src={staff.img} className="w-20 h-20 rounded-[28px] object-cover shadow-xl border-2 border-white" alt={staff.name} referrerPolicy="no-referrer" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-xl text-gray-900">{staff.name}</p>
                      <div className="inline-block px-3 py-1 bg-pro-green/10 rounded-lg">
                        <p className="text-[10px] font-black text-pro-green uppercase tracking-widest">{staff.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-4 text-sm font-bold text-gray-600 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-pro-green">
                        <Navigation className="w-5 h-5" />
                      </div>
                      <span className="truncate">{staff.location}</span>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedStaff(staff)}
                      className="w-full py-5 bg-gray-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest hover:bg-pro-green transition-all shadow-xl flex items-center justify-center gap-2 group/btn"
                    >
                      CHI TIẾT & TƯƠNG TÁC <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                    
                    <button 
                      onClick={() => setIsExpanded(false)}
                      className="w-full py-3 text-[10px] font-black text-gray-400 uppercase hover:text-red-500 transition-colors"
                    >
                      Thu gọn danh sách
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompanionDetail = ({ companion, onConfirm, mode = 'senior', userData }: { 
  companion: typeof COMPANIONS[0] & { service?: string }; 
  onConfirm?: (discount: number) => void;
  mode?: 'elderly' | 'kids' | 'pro' | 'senior';
  userData?: any;
}) => {
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [useVoucher, setUseVoucher] = useState(false);

  const basePrice = 150000;
  const discountRate = useVoucher ? 0.2 : 0; // 20% discount
  const finalPrice = basePrice * (1 - discountRate);

  return (
    <div className="space-y-6">
      {/* ... header as before ... */}
      <div className="flex items-center gap-6">
        <div className="relative">
          <img src={companion.img} className="w-24 h-24 rounded-full border-4 border-pro-green/20 object-cover" alt={companion.name} referrerPolicy="no-referrer" />
          <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg border-2 border-pro-green">
             <Shield className="w-4 h-4 text-pro-green" />
          </div>
        </div>
        <div className="flex-1">
          <h4 className="text-2xl font-black text-gray-900">{companion.name}</h4>
          <p className="text-sm font-bold text-pro-green uppercase tracking-tighter">{companion.school}</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-yellow-500">
              {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-4 h-4 ${i <= Math.floor(companion.rating) ? 'fill-current' : ''}`} />)}
              <span className="font-black text-gray-900 ml-2">{companion.rating}</span>
            </div>
            {mode === 'pro' && (
              <button 
                onClick={() => setShowQuickChat(!showQuickChat)}
                className={`p-2 rounded-xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${showQuickChat ? 'bg-pro-green text-white shadow-lg' : 'bg-pro-green/10 text-pro-green hover:bg-pro-green/20'}`}
              >
                <MessageCircle className="w-4 h-4" /> 
                {showQuickChat ? 'Đóng Chat' : 'Nhắn tin nhanh'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Voucher Selector */}
      {userData?.voucherSubscriptionActive && userData?.vouchers > 0 && mode === 'pro' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-6 rounded-3xl border-4 transition-all cursor-pointer flex items-center justify-between ${useVoucher ? 'border-colorful bg-colorful/5' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
          onClick={() => setUseVoucher(!useVoucher)}
        >
          <div className="flex items-center gap-4">
             <div className={`p-4 rounded-2xl ${useVoucher ? 'bg-colorful text-white' : 'bg-gray-100 text-gray-400'}`}>
                <Wallet className="w-6 h-6" />
             </div>
             <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">LinkHeart Wallet Voucher</p>
                <p className="text-sm font-black text-gray-900">Giảm giá 20% cho ca làm</p>
                <p className="text-[10px] font-bold text-colorful italic mt-1">Sẵn có: {userData.vouchers} Voucher</p>
             </div>
          </div>
          <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all ${useVoucher ? 'border-colorful bg-colorful text-white' : 'border-gray-200'}`}>
             {useVoucher && <CheckCircle2 className="w-4 h-4" />}
          </div>
        </motion.div>
      )}
      
      <AnimatePresence mode="wait">
        {showQuickChat ? (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-50 border-2 border-pro-green/20 rounded-[32px] p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-black uppercase text-gray-400">Đang trực tuyến - Phản hồi trong giây lát</p>
              </div>
              <ChatSimulation onBack={() => setShowQuickChat(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase">Độ tuổi</p>
                  <p className="font-bold text-gray-900">{companion.age} tuổi</p>
               </div>
               <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-black uppercase">Dịch vụ</p>
                  <p className="font-bold text-pro-green uppercase">{companion.service || 'Đồng hành'}</p>
               </div>
            </div>

            <div className="space-y-3">
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Kỹ năng nổi bật</p>
               <div className="flex flex-wrap gap-2">
                  {companion.skills.map(skill => (
                    <span key={skill} className="px-3 py-1 bg-pro-green/5 text-pro-green text-[10px] font-black rounded-full border border-pro-green/10">#{skill}</span>
                  ))}
               </div>
            </div>

            <p className="text-sm text-gray-600 font-medium italic border-l-4 border-pro-green pl-4 py-2 bg-pro-green/5 rounded-r-2xl">
              "{companion.bio}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!showQuickChat && onConfirm && (
        <div className="pt-4 border-t border-gray-100 space-y-4">
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
             <p className="font-bold text-gray-500">Giá thanh toán:</p>
             <div className="text-right">
                {useVoucher ? (
                  <>
                    <p className="text-2xl font-black text-colorful">{finalPrice.toLocaleString()}đ</p>
                    <p className="text-xs font-bold text-gray-300 line-through italic">{basePrice.toLocaleString()}đ</p>
                  </>
                ) : (
                  <p className="text-2xl font-black text-gray-900">{basePrice.toLocaleString()}đ</p>
                )}
             </div>
          </div>
          <button 
            onClick={() => onConfirm(discountRate)}
            className="w-full bg-pro-green text-white py-6 rounded-[32px] font-black text-xl shadow-xl hover:bg-pro-green-dark transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            {useVoucher ? <Sparkles className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
            {useVoucher ? 'DÙNG VOUCHER & ĐẶT NGAY' : 'XÁC NHẬN & ĐẶT LỊCH NGAY'}
          </button>
        </div>
      )}
    </div>
  );
};

const ChatSimulation = ({ onBack }: { onBack: () => void }) => {
  const [messages, setMessages] = useState([
    { role: 'companion', text: 'Chào bạn, mình đang trên đường đến. Bạn cần mình chuẩn bị thêm gì không?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'companion', text: 'Vâng ạ, mình đã nắm rõ. Hẹn gặp bạn sau ít phút nữa!' }]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 p-2 scrollbar-hide">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-3xl font-medium ${m.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
              <div className="markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {m.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-6 flex gap-3">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Nhập tin nhắn..."
          className="flex-1 bg-gray-100 border-none rounded-2xl px-6 font-medium focus:ring-2 focus:ring-pro-green"
        />
        <button onClick={handleSend} className="p-4 bg-pro-green text-white rounded-2xl shadow-lg shadow-pro-green/20 active:scale-95 transition-all">
          <Send className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

const PaymentSimulation = ({ onComplete }: { onComplete: (method: string) => void }) => {
  const [method, setMethod] = useState<'visa' | 'bank' | null>(null);
  const [step, setStep] = useState(1);

  if (step === 2) {
    return (
      <div className="text-center py-8 space-y-6">
        <div className="w-24 h-24 border-8 border-pro-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="font-black text-2xl uppercase tracking-tighter text-pro-green">Đang xác thực giao dịch...</p>
        <p className="text-gray-500 font-bold italic">Vui lòng không tắt ứng dụng</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2">
      <p className="text-sm text-gray-500 font-black uppercase tracking-widest text-center border-b pb-4">Chọn phương thức thanh toán</p>
      <div className="grid grid-cols-2 gap-6">
        <button 
          onClick={() => setMethod('visa')}
          className={`p-8 rounded-[40px] border-4 transition-all flex flex-col items-center gap-3 shadow-sm ${method === 'visa' ? 'border-pro-green bg-pro-green/5' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className={`p-4 rounded-2xl ${method === 'visa' ? 'bg-pro-green text-white' : 'bg-gray-100 text-gray-400'}`}>
            <CreditCard className="w-10 h-10" />
          </div>
          <span className="font-black text-lg">THE VISA</span>
        </button>
        <button 
          onClick={() => setMethod('bank')}
          className={`p-8 rounded-[40px] border-4 transition-all flex flex-col items-center gap-3 shadow-sm ${method === 'bank' ? 'border-pro-green bg-pro-green/5' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className={`p-4 rounded-2xl ${method === 'bank' ? 'bg-pro-green text-white' : 'bg-gray-100 text-gray-400'}`}>
            <Building2 className="w-10 h-10" />
          </div>
          <span className="font-black text-lg">CHUYỂN KHOẢN</span>
        </button>
      </div>

      {method === 'visa' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-gray-50 rounded-[40px] border-4 border-gray-100 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-black text-gray-400 uppercase">Thẻ đã lưu (Ưu tiên)</p>
            <span className="px-3 py-1 bg-green-100 text-green-600 text-[8px] font-black rounded-full">SECURE</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-white rounded-3xl border-2 border-pro-green">
             <div className="flex items-center gap-4">
               <div className="w-12 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-[10px] text-white font-black">VISA</div>
               <p className="font-black text-xl tracking-tighter">**** **** **** 8888</p>
             </div>
             <CheckCircle2 className="text-pro-green w-8 h-8" />
          </div>
          <p className="text-[10px] text-gray-400 italic font-bold">Thanh toán 1 chạm an toàn qua LinkHeart Secure Hub.</p>
        </motion.div>
      )}

      {method === 'bank' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-blue-50 rounded-[40px] border-4 border-dashed border-blue-200 text-center space-y-6">
          <p className="font-black text-2xl text-blue-800 uppercase tracking-tight">Quét mã QR Napas 24/7</p>
          <div className="w-48 h-48 bg-white mx-auto flex items-center justify-center border-8 border-white shadow-2xl rounded-3xl relative overflow-hidden">
             <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=LinkHeartPayment" className="w-full h-full p-2" alt="QR" />
             <div className="absolute inset-0 flex items-center justify-center opacity-10">
               <Zap className="w-32 h-32 text-blue-800" />
             </div>
          </div>
          <div className="bg-white/50 p-4 rounded-2xl">
             <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1">Vietcombank • 1022334455</p>
             <p className="text-sm text-gray-900 font-bold uppercase">LINKHEART GLOBAL TECHNOLOGY</p>
          </div>
        </motion.div>
      )}

      <button 
        disabled={!method}
        onClick={() => {
          setStep(2);
          setTimeout(() => onComplete(method!), 2500);
        }}
        className="w-full bg-gray-900 text-white py-10 rounded-[64px] font-black text-3xl shadow-2xl disabled:opacity-30 disabled:grayscale hover:bg-black transition-all active:scale-95"
      >
        TIẾP TỤC
      </button>
    </div>
  );
};

// --- Simulation Modal ---
const SimulationModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  type = 'info' 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  type?: 'info' | 'success' | 'loading' | 'emergency' | 'companion';
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 ${
              type === 'emergency' ? 'border-red-600' : 
              type === 'success' ? 'border-green-500' : 
              type === 'companion' ? 'border-primary' : 'border-gray-100'
            }`}
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Toast System ---
const Toast = ({ message, isVisible, onClose }: { message: string; isVisible: boolean; onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10"
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold">{message}</span>
          <button onClick={onClose} className="ml-2 hover:text-primary transition-colors"><X className="w-4 h-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Map Simulation ---
const MapSimulation = ({ coords }: { coords?: { x: number, y: number } }) => {
  return (
    <div className="w-full h-full bg-gray-100 rounded-2xl relative overflow-hidden border border-gray-200 min-h-[150px]">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-10 left-10 w-full h-1 bg-gray-300 rotate-45" />
        <div className="absolute top-20 left-0 w-full h-1 bg-gray-300 -rotate-12" />
        <div className="absolute top-0 left-40 w-1 h-full bg-gray-300" />
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200" />
        <div className="absolute top-0 left-1/3 w-0.5 h-full bg-gray-200" />
      </div>
      
      {coords ? (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute z-10"
          style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
        >
          <div className="relative -translate-x-1/2 -translate-y-full">
             <div className="bg-red-500 p-2 rounded-full shadow-2xl animate-bounce">
                <MapPin className="text-white w-6 h-6" />
             </div>
             <div className="w-4 h-4 bg-red-500/20 rounded-full blur-md absolute -bottom-1 left-1/2 -translate-x-1/2" />
          </div>
        </motion.div>
      ) : (
        <motion.div 
          animate={{ 
            x: [20, 100, 50, 20],
            y: [20, 50, 80, 20]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-4 h-4 bg-pro-green rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)] flex items-center justify-center"
        >
          <div className="w-2 h-2 bg-white rounded-full" />
        </motion.div>
      )}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg text-[10px] font-black shadow-sm uppercase tracking-widest text-gray-900 border border-gray-100">
        {coords ? "Vị trí yêu cầu" : "Đang di chuyển: 15km/h"}
      </div>
    </div>
  );
};

// --- Footer Component ---
const Footer = ({ theme = 'default', onToast }: { theme?: 'kids' | 'pro' | 'elderly' | 'default', onToast: (msg: string, content?: string) => void }) => {
  const colors = {
    kids: 'bg-kids-orange text-white',
    pro: 'bg-gray-900 text-white',
    elderly: 'bg-white text-gray-900 border-t-8 border-gray-900',
    default: 'bg-gray-900 text-white'
  };

  return (
    <footer className={`py-12 px-8 ${colors[theme]}`}>
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6" fill="currentColor" />
            <span className="text-xl font-bold">LinkHeart</span>
          </div>
          <p className="text-sm opacity-70">Kết nối yêu thương trong mọi hành trình đồng hành.</p>
        </div>
        {[
          { title: 'Về chúng tôi', links: ['Sứ mệnh', 'Đội ngũ', 'Tuyển dụng'] },
          { title: 'Dịch vụ', links: ['Cho trẻ em', 'Cho người lớn', 'Cho người già'] },
          { title: 'Hỗ trợ', links: ['Trung tâm trợ giúp', 'Điều khoản', 'Bảo mật'] }
        ].map((col, i) => (
          <div key={i} className="space-y-4">
            <h4 className="font-bold">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((link, j) => (
                <li key={j}>
                  <button 
                    onClick={() => onToast(`Đang chuyển đến trang ${link}...`)}
                    className="text-sm opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {link}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-center text-xs opacity-50">
        © 2026 LinkHeart. All rights reserved.
      </div>
    </footer>
  );
};

// --- Kids Mode ---
const KidsMode = ({ onBack, onAddRequest }: { onBack: () => void, onAddRequest: (req: any) => void }) => {
  const [activeView, setActiveView] = useState<'home' | 'footer-page' | 'tracking' | 'explore'>('home');
  const [exploreCategory, setExploreCategory] = useState<string | null>(null);
  const [serviceFlow, setServiceFlow] = useState<{ type: 'tutor' | 'sports' | 'stories' | null; step: number; data: any }>({ type: null, step: 1, data: {} });
  const [customRequest, setCustomRequest] = useState('');
  const [footerPage, setFooterPage] = useState<{ title: string; content: string } | null>(null);
  const [activeCompanion, setActiveCompanion] = useState<Companion | null>(null);
  const [modal, setModal] = useState<{ open: boolean; title: string; content: React.ReactNode; type: any; data?: any }>({
    open: false,
    title: '',
    content: '',
    type: 'info'
  });
  const [toast, setToast] = useState({ show: false, msg: '' });

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const showSimulation = (title: string, content: React.ReactNode, type: any = 'success', data?: any) => {
    setModal({ open: true, title, content, type, data });
  };

  const showRandomCompanion = async () => {
    const path = "companions";
    showSimulation('Tìm kiếm', '', 'loading');
    try {
      const companionsRef = collection(db, path);
      const snapshot = await getDocs(companionsRef);
      const companionsData = snapshot.docs.map(doc => doc.data() as Companion);
      
      if (companionsData.length === 0) {
        showSimulation('Opps!', 'Hiện chưa có Companion nào đăng ký dịch vụ này.', 'info');
        return;
      }

      const randomComp = companionsData[Math.floor(Math.random() * companionsData.length)];
      showSimulation('Đã tìm thấy Companion!', '', 'companion', randomComp);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const showHandbook = () => {
    showSimulation('Cẩm nang cho bé', '', 'info', { handbook: HANDBOOK_CONTENT.kids });
  };

  const renderFooterPage = (title: string) => {
    const contentMap: Record<string, string> = {
      'Sứ mệnh': 'LinkHeart Kids mang đến môi trường an toàn, vui vẻ cho bé và sự an tâm tuyệt đối cho bố mẹ.',
      'Đội ngũ': 'Các anh chị Companion là sinh viên ưu tú từ các trường đại học hàng đầu, yêu trẻ và năng động.',
      'Tuyển dụng': 'Gia nhập đội ngũ Companion để cùng bé kiến tạo những kỷ niệm đẹp!',
      'Cho trẻ em': 'Dịch vụ vui chơi, học tập và rèn luyện kỹ năng cho bé.',
      'Cho người lớn': 'Dịch vụ hỗ trợ người trưởng thành trong cuộc sống hàng ngày.',
      'Cho người già': 'Dịch vụ chăm sóc và đồng hành cùng người cao tuổi.',
      'Trung tâm trợ giúp': 'Liên hệ 1900 1234 để được hỗ trợ nhanh nhất.',
      'Điều khoản': 'Quy định sử dụng dịch vụ an toàn cho bé.',
      'Bảo mật': 'Cam kết bảo mật thông tin gia đình và bé.'
    };
    setFooterPage({ title, content: contentMap[title] || 'Nội dung đang được cập nhật...' });
    setActiveView('footer-page');
    window.scrollTo(0, 0);
  };

  return (
    <div className="theme-kids min-h-screen flex flex-col">
      <Toast message={toast.msg} isVisible={toast.show} onClose={() => setToast({ ...toast, show: false })} />
      <SimulationModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })}
        title={modal.title}
        type={modal.type}
      >
        <div className="text-center space-y-4">
          {modal.data?.isAI ? (
            <div className="space-y-6">
               <Bot className="w-16 h-16 text-kids-blue mx-auto animate-bounce" />
               <div className="text-left text-gray-700 font-medium text-lg bg-blue-50 p-6 rounded-3xl border-2 border-blue-100 markdown-body">
                  <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    children={(modal.content as string) || ''}
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      setModal({ ...modal, open: false });
                      window.speechSynthesis.cancel();
                    }}
                    className="py-4 bg-gray-100 text-gray-500 font-black rounded-2xl border-2 border-gray-200 uppercase text-sm"
                  >
                    Thoát
                  </button>
                  <button 
                    onClick={() => {
                      setModal({ ...modal, title: 'Linky đang lắng nghe bé...', type: 'loading', content: '', data: { isAI: true } });
                      if ((window as any).triggerLinkyVoice) (window as any).triggerLinkyVoice();
                    }}
                    className="py-4 bg-kids-blue text-white font-black rounded-2xl shadow-[4px_4px_0px_0px_#2B5EA7] uppercase text-sm"
                  >
                    Tiếp tục Chat
                  </button>
               </div>
            </div>
          ) : modal.type === 'companion' ? (
            <div className="text-left">
              <CompanionDetail companion={modal.data} />
              <button 
                onClick={() => {
                  setActiveCompanion(modal.data);
                  setModal({ ...modal, open: false });
                  setActiveView('tracking');
                  showToast(`Đã bắt đầu hành trình cùng ${modal.data.name}!`);
                }}
                className="w-full mt-6 bg-kids-orange text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#CC7E16]"
              >
                CHỌN ANH/CHỊ NÀY
              </button>
            </div>
          ) : modal.data?.handbook ? (
            <div className="text-left space-y-4">
              {modal.data.handbook.map((item: any, i: number) => (
                <div key={i} className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100">
                  <h4 className="font-black text-blue-600 mb-1">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.content}</p>
                </div>
              ))}
              <button 
                onClick={() => setModal({ ...modal, open: false })}
                className="w-full bg-kids-orange text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#CC7E16]"
              >
                ĐÃ HIỂU!
              </button>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <p className="text-gray-600 leading-relaxed">{modal.content}</p>
              <button 
                onClick={() => setModal({ ...modal, open: false })}
                className="w-full bg-kids-orange text-white py-4 rounded-2xl font-black text-lg shadow-[4px_4px_0px_0px_#CC7E16]"
              >
                TUYỆT VỜI!
              </button>
            </>
          )}
        </div>
      </SimulationModal>

      <nav className="p-4 md:p-6 flex justify-between items-center bg-white border-b-4 border-kids-orange sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('home')}>
          <div className="w-10 h-10 bg-gradient-to-tr from-kids-orange to-kids-yellow rounded-xl flex items-center justify-center shadow-lg shadow-kids-orange/20">
            <Baby className="text-white w-6 h-6 shrink-0" />
          </div>
          <span className="text-xl md:text-2xl font-black text-kids-orange font-display italic">LinkHeart<span className="hidden sm:inline"> Kids</span></span>
        </div>
        <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar">
          <VoiceAssistant 
            mode="kids" 
            onResponse={async (text) => {
              showSimulation('Linky đang lắng nghe bé...', `"${text}"`, 'loading');
              const res = await (window as any).getLinkyAIResponse(text, "Bạn là Linky - Bảo mẫu AI ấm áp và thông thái cho trẻ nhỏ. Hãy trả lời bé như một người chị/người bạn thân thiết. Luôn động viên, khích lệ và giải thích mọi thứ một cách kỳ diệu, dễ hiểu. Hãy tâm sự và hỏi lại bé để cuộc trò chuyện tiếp tục.");
              showSimulation('Linky tâm sự cùng bé', res, 'success', { isAI: true });
            }} 
          />
          <div className="hidden md:flex gap-6 mr-4 md:mr-8 shrink-0">
            <button onClick={() => { setActiveView('home'); showToast('Bạn đang ở Trang Chủ'); }} className="font-black text-gray-400 hover:text-kids-orange transition-colors">TRANG CHỦ</button>
            <button onClick={() => showToast('Chưa có bạn bè trực tuyến')} className="font-black text-gray-400 hover:text-kids-orange transition-colors">BẠN BÈ</button>
            <button onClick={() => showToast('Nhật ký đang trống')} className="font-black text-gray-400 hover:text-kids-orange transition-colors">NHẬT KÝ</button>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors font-black text-xs text-gray-600 shrink-0">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="hidden sm:inline">QUAY LẠI</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <AnimatePresence mode="wait">
          {activeView === 'home' ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center mb-10 md:mb-20">
                <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                  <div className="inline-block bg-kids-orange/10 text-kids-orange px-4 py-2 rounded-full font-black text-sm mb-6">
                    AN TOÀN & VUI VẺ 100%
                  </div>
                  <h2 className="text-4xl md:text-6xl font-normal font-display text-kids-orange mb-4 md:mb-6 leading-tight">Cùng bé <br /> <span className="text-colorful font-black">vui chơi & học tập!</span></h2>
                  <p className="text-xl text-gray-600 mb-8">Tìm anh chị sinh viên năng động để cùng bé khám phá thế giới qua các hoạt động bổ ích.</p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setActiveView('explore')}
                      className="bg-kids-orange text-white px-10 py-5 rounded-full font-black text-2xl shadow-[6px_6px_0px_0px_#CC7E16] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_#CC7E16] active:scale-95 transition-all"
                    >
                      TÌM NGAY!
                    </button>
                  </div>
                </motion.div>
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative group cursor-pointer"
                  onClick={() => showSimulation('Video giới thiệu', 'Đang tải video giới thiệu về các hoạt động vui chơi tại LinkHeart Kids...')}
                >
                  <div className="absolute inset-0 bg-kids-blue rounded-[40px] rotate-3 group-hover:rotate-1 transition-transform" />
                  <img src="https://picsum.photos/seed/kids/800/600" className="relative rounded-[40px] border-8 border-white shadow-2xl w-full h-[400px] object-cover" alt="Kids" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Zap className="w-10 h-10 text-kids-orange fill-current" />
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="mb-20">
                <StaffSection 
                  onSelectStaff={(s) => showSimulation('Anh chị Companion', `Bạn đã chọn ${s.name} để đồng hành cùng bé!`, 'success')} 
                  showSimulation={showSimulation}
                  mode="kids" 
                />
              </div>

              <div className="grid md:grid-cols-3 gap-8 mb-20">
                {[
                  { title: 'Gia sư vui vẻ', icon: <BookOpen />, color: 'bg-blue-100 text-blue-500', desc: 'Học mà chơi, chơi mà học cùng các anh chị ĐH Ngoại Thương, Bách Khoa.' },
                  { title: 'Bạn chơi thể thao', icon: <Gamepad2 />, color: 'bg-green-100 text-green-500', desc: 'Cùng đá bóng, cầu lông hoặc chạy bộ tại công viên an toàn.' },
                  { title: 'Kể chuyện đêm khuya', icon: <MessageCircle />, color: 'bg-purple-100 text-purple-500', desc: 'Những câu chuyện nhân văn giúp bé ngủ ngon và phát triển tư duy.' }
                ].map((item, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -10 }}
                    onClick={() => showSimulation(item.title, `Bạn đã chọn dịch vụ ${item.title}. Chúng tôi sẽ gửi danh sách các Companion phù hợp nhất cho bố mẹ duyệt!`)}
                    className="card-bouncy p-8 bg-white text-center cursor-pointer"
                  >
                    <div className={`w-20 h-20 ${item.color} rounded-full flex items-center justify-center mx-auto mb-6`}>
                      {item.icon}
                    </div>
                    <h3 className="text-2xl font-black mb-4">{item.title}</h3>
                    <p className="text-gray-500 leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-8 mb-20">
                <div className="bg-kids-blue/10 p-8 rounded-[40px] border-4 border-kids-blue/20 cursor-pointer hover:bg-kids-blue/20 transition-colors" onClick={() => showToast('Bảng vàng vinh danh các bé ngoan!')}>
                  <h3 className="text-3xl font-black text-kids-blue mb-6 flex items-center gap-3">
                    <Award className="w-10 h-10" /> Bảng vàng tuần này
                  </h3>
                  <div className="space-y-4">
                    {[
                      { name: 'Bé Na', task: 'Hoàn thành 5 bài tập toán', points: '+500' },
                      { name: 'Bé Tí', task: 'Đọc xong 2 cuốn sách', points: '+300' }
                    ].map((b, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm hover:scale-105 transition-transform">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black">{i + 1}</div>
                          <div>
                            <p className="font-black">{b.name}</p>
                            <p className="text-xs text-gray-500">{b.task}</p>
                          </div>
                        </div>
                        <span className="text-kids-orange font-black">{b.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-kids-orange/10 p-8 rounded-[40px] border-4 border-kids-orange/20 cursor-pointer hover:bg-kids-orange/20 transition-colors" onClick={() => showToast('Gói an toàn cho bé yêu!')}>
                  <h3 className="text-3xl font-black text-kids-orange mb-6 flex items-center gap-3">
                    <Shield className="w-10 h-10" /> Bảo vệ chủ động
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={(e) => { e.stopPropagation(); showSimulation('QR Check-in', 'Hệ thống yêu cầu quét mã QR bảo mật từ Companion để xác nhận ca làm việc bắt đầu.', 'info'); }}
                      className="bg-white p-6 rounded-3xl flex flex-col items-center gap-3 shadow-md hover:scale-105 transition-all text-gray-700"
                    >
                      <Zap className="w-8 h-8 text-kids-orange" />
                      <span className="font-black text-xs uppercase">Mã QR Bảo Mật</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); showSimulation('Safe-Word', 'Bé đã kích hoạt mật mã an toàn! Hệ thống đã gửi thông báo khẩn cấp (Alarm Red) cho bố mẹ ngay lập tức!', 'danger'); }}
                      className="bg-red-100 p-6 rounded-3xl flex flex-col items-center gap-3 shadow-md border-4 border-red-500 hover:scale-105 transition-all text-red-600"
                    >
                      <Mic className="w-8 h-8" />
                      <span className="font-black text-xs uppercase">Nút "Safe-Word"</span>
                    </button>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); showHandbook(); }}
                    className="w-full mt-4 bg-white text-kids-orange py-3 rounded-2xl font-black border-2 border-kids-orange hover:bg-kids-orange hover:text-white transition-all"
                  >
                    XEM CẨM NANG
                  </button>
                </div>
              </div>

              {/* Học mà chơi - Gamified Learning (Page 2) */}
              <div className="mb-20">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-4xl font-black text-kids-orange flex items-center gap-4">
                    <Award className="w-12 h-12" /> Học mà chơi - Thử thách ngày
                  </h2>
                  <span className="px-6 py-2 bg-kids-orange text-white rounded-full font-black text-lg">
                    GEMS: 1,250 💎
                  </span>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                  {KIDS_MISSIONS.map((mission) => (
                    <motion.div 
                      key={mission.id}
                      whileHover={{ scale: 1.05 }}
                      className="p-8 bg-white rounded-[40px] border-4 border-dashed border-kids-orange/30 relative overflow-hidden group cursor-pointer"
                      onClick={() => showSimulation(mission.title, `Bạn đang bắt đầu nhiệm vụ: ${mission.task}. Hãy cùng Companion hoàn thành để nhận huy hiệu ${mission.badge} nhé!`, 'success')}
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-8xl">{mission.badge}</span>
                      </div>
                      <span className="inline-block px-3 py-1 bg-kids-orange/10 text-kids-orange rounded-lg text-xs font-black mb-4 uppercase">
                        Cấp độ: Dễ
                      </span>
                      <h4 className="text-2xl font-black mb-2">{mission.title}</h4>
                      <p className="text-gray-500 font-bold mb-6">{mission.task}</p>
                      <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: mission.id === 1 ? '70%' : '10%' }}
                          className="h-full bg-kids-orange"
                        />
                      </div>
                      <p className="text-right text-xs font-black text-kids-orange mt-2">TIẾN ĐỘ: {mission.id === 1 ? '70' : '10'}%</p>
                    </motion.div>
                  ))}
                </div>
              </div>
              {/* Đổi quà - Reward Redemption */}
              <div className="mb-20 bg-kids-orange p-10 rounded-[60px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                   <Zap className="w-64 h-64 text-white" fill="currentColor" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-white">
                    <h3 className="text-4xl font-black mb-4 flex items-center gap-4">
                      <Gift className="w-12 h-12" /> Đổi quà từ GEMS 💎
                    </h3>
                    <p className="text-xl font-bold opacity-90">Dùng GEMS bé kiếm được từ nhiệm vụ để đổi lấy các phần quà hấp dẫn!</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                     {[
                        { title: 'Thẻ ROBLOX', cost: 1000, color: 'bg-gray-900', icon: '🎮' },
                        { title: 'Thẻ LIÊN QUÂN', cost: 1200, color: 'bg-red-800', icon: '⚔️' },
                        { title: 'VOUCHER TRÀ SỮA', cost: 800, color: 'bg-yellow-600', icon: '🧋' }
                     ].map((reward, i) => (
                       <button 
                         key={i}
                         onClick={() => showSimulation('Đổi quà', `Chúc mừng bé đã đổi thành công ${reward.title}. Mã thẻ đã gửi vào hòm thư của bố mẹ nhé!`, 'success')}
                         className={`${reward.color} text-white p-6 rounded-[32px] flex flex-col items-center gap-2 hover:scale-105 transition-all shadow-xl min-w-[150px]`}
                       >
                          <span className="text-4xl">{reward.icon}</span>
                          <span className="font-black text-sm">{reward.title}</span>
                          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">{reward.cost} GEMS</span>
                       </button>
                     ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeView === 'explore' ? (
            <motion.div 
              key="explore"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                 <div>
                    <button onClick={() => { setActiveView('home'); setServiceFlow({ type: null, step: 1, data: {} }); }} className="flex items-center gap-2 text-kids-orange font-black mb-2 hover:underline">
                      <ArrowLeft className="w-4 h-4" /> QUAY LẠI
                    </button>
                    <h2 className="text-5xl font-black text-kids-orange uppercase">Bé muốn gì hôm nay?</h2>
                 </div>
                 <div className="w-full md:w-96 relative">
                    <input 
                      type="text" 
                      placeholder="Tìm dịch vụ khác (ví dụ: tâm sự...)" 
                      value={customRequest}
                      onChange={(e) => setCustomRequest(e.target.value)}
                      className="w-full h-16 bg-white border-4 border-kids-orange rounded-full px-8 font-bold text-lg shadow-[4px_4px_0px_0px_#CC7E16] outline-none" 
                    />
                    <button 
                      onClick={() => {
                        if (!customRequest.trim()) return;
                        onAddRequest({ kidName: 'Bé Bo', item: customRequest, price: '--- (Thoả thuận)', category: 'Đặc biệt' });
                        showSimulation('Đã gửi yêu cầu', `Yêu cầu "${customRequest}" của bé đã được gửi tới bố mẹ. Chờ bố mẹ duyệt nhé!`, 'success');
                        setCustomRequest('');
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-kids-orange text-white rounded-full flex items-center justify-center"
                    >
                       <Send className="w-5 h-5" />
                    </button>
                 </div>
              </div>

              {!serviceFlow.type ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { id: 'tutor', label: 'Gia sư vui vẻ', icon: <BookOpen />, color: 'bg-blue-400', desc: 'Dạy kèm, học môn ưa thích' },
                      { id: 'sports', label: 'Bạn chơi thể thao', icon: <Dumbbell />, color: 'bg-green-400', desc: 'Bóng đá, bơi lội, võ thuật' },
                      { id: 'stories', label: 'Kể chuyện đêm khuya', icon: <Mic />, color: 'bg-purple-400', desc: 'Cổ tích, Doraemon, v.v.' },
                      { id: 'confide', label: 'Tâm sự bối rối', icon: <MessageCircle />, color: 'bg-pink-400', desc: 'Trò chuyện cùng anh chị' }
                    ].map((cat) => (
                      <button 
                        key={cat.id}
                        onClick={() => {
                          if (['tutor', 'sports', 'stories'].includes(cat.id)) {
                            setServiceFlow({ type: cat.id as any, step: 1, data: {} });
                          } else {
                            setExploreCategory(cat.id);
                          }
                        }}
                        className={`p-8 rounded-[40px] text-white flex flex-col items-center gap-4 transition-all hover:scale-105 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)] ${cat.color}`}
                      >
                        <div className="p-4 bg-white/20 rounded-2xl">{cat.icon}</div>
                        <span className="text-xl md:text-2xl font-black uppercase text-center">{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-3 gap-8">
                    {(exploreCategory === 'confide' ? [
                      { title: 'Tâm sự cùng anh chị', price: '99.000đ', icon: <MessageCircle className="text-pink-500" /> },
                      { title: 'Hỏi đáp kỹ năng', price: '119.000đ', icon: <Sparkles className="text-pink-500" /> }
                    ] : [
                      { title: 'Tìm Companion gần đây', price: 'Thỏa thuận', icon: <Sparkles className="text-kids-orange" /> }
                    ]).map((item, i) => (
                      <motion.div 
                        key={i}
                        whileHover={{ y: -5 }}
                        className="p-8 bg-white rounded-[40px] border-4 border-gray-100 shadow-xl flex flex-col items-center text-center group transition-all hover:border-kids-orange cursor-pointer"
                        onClick={() => {
                          onAddRequest({ kidName: 'Bé Bo', item: item.title, price: item.price, category: exploreCategory || 'Dịch vụ' });
                          showSimulation('Yêu cầu đã gửi', `Bé đã chọn "${item.title}". Bố mẹ sẽ sớm phản hồi nhé!`, 'success');
                        }}
                      >
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-gray-100 group-hover:bg-kids-orange/10 group-hover:border-kids-orange group-hover:text-kids-orange transition-all">{item.icon}</div>
                        <h4 className="text-2xl font-black mb-2">{item.title}</h4>
                        <p className="text-xl font-black text-kids-orange mb-6">{item.price}</p>
                        <div className="w-full py-4 bg-gray-50 rounded-2xl font-black text-gray-400 uppercase tracking-widest group-hover:bg-kids-orange group-hover:text-white transition-all">Gửi yêu cầu</div>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="bg-white p-10 rounded-[48px] border-8 border-kids-orange shadow-2xl space-y-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-3xl font-black text-kids-orange uppercase">
                      {serviceFlow.type === 'tutor' && 'Gia sư vui vẻ'}
                      {serviceFlow.type === 'sports' && 'Bạn chơi thể thao'}
                      {serviceFlow.type === 'stories' && 'Kể chuyện đêm khuya'}
                    </h3>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Bước {serviceFlow.step} / 4</span>
                  </div>

                  <div className="space-y-6">
                    {serviceFlow.type === 'tutor' && (
                      <>
                        {serviceFlow.step === 1 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Bé cần học môn gì?</p>
                            <div className="grid grid-cols-2 gap-4">
                              {['Toán học', 'Tiếng Anh', 'Robotics', 'Tiếng Việt', 'Lập trình', 'Nghệ thuật'].map(m => (
                                <button key={m} onClick={() => setServiceFlow({...serviceFlow, step: 2, data: {...serviceFlow.data, subject: m}})} className="p-6 border-4 border-gray-100 rounded-3xl font-black hover:border-kids-orange transition-all">{m}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {serviceFlow.step === 2 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Bé học lớp mấy?</p>
                            <div className="grid grid-cols-3 gap-4">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(m => (
                                <button key={m} onClick={() => setServiceFlow({...serviceFlow, step: 3, data: {...serviceFlow.data, grade: m}})} className="p-6 border-4 border-gray-100 rounded-3xl font-black hover:border-kids-orange transition-all">Lớp {m}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {serviceFlow.step === 3 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Khu vực sinh sống?</p>
                            <div className="grid grid-cols-2 gap-4">
                              {['Quận 1', 'Quận 7', 'Quận Bình Thạnh', 'Quận Thủ Đức', 'Hà Nội', 'Đà Nẵng'].map(m => (
                                <button key={m} onClick={() => setServiceFlow({...serviceFlow, step: 4, data: {...serviceFlow.data, area: m}})} className="p-6 border-4 border-gray-100 rounded-3xl font-black hover:border-kids-orange transition-all">{m}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {serviceFlow.step === 4 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Trình độ gia sư?</p>
                            <div className="grid grid-cols-1 gap-4">
                              {[
                                { id: 'std', label: 'Sinh viên tiêu chuẩn', desc: 'Có trình độ chuyên môn tốt' },
                                { id: 'pro', label: 'Sinh viên ưu tú (GPA > 3.6)', desc: 'Năng lực sư phạm xuất sắc' },
                                { id: 'top', label: 'Chuyên gia LinkHeart', desc: 'Đã có kinh nghiệm > 2 năm' }
                              ].map(m => (
                                <button key={m.id} onClick={() => {
                                  onAddRequest({ 
                                    kidName: 'Bé Bo', 
                                    item: `Gia sư ${serviceFlow.data.subject} lớp ${serviceFlow.data.grade}`, 
                                    price: m.id === 'std' ? '149.000đ' : (m.id === 'pro' ? '199.000đ' : '299.000đ'),
                                    category: 'Gia sư'
                                  });
                                  showSimulation('Yêu cầu đã gửi', 'Bố mẹ sẽ nhận được yêu cầu gia sư của bé ngay bây giờ!', 'success');
                                  setServiceFlow({ type: null, step: 1, data: {} });
                                }} className="p-8 border-4 border-gray-100 rounded-[32px] text-left hover:border-kids-orange transition-all">
                                  <p className="font-black text-xl">{m.label}</p>
                                  <p className="text-gray-500 font-bold">{m.desc}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {serviceFlow.type === 'sports' && (
                      <>
                         {serviceFlow.step === 1 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Môn thể thao ưa thích?</p>
                            <div className="grid grid-cols-2 gap-4">
                              {['Bóng đá', 'Bóng rổ', 'Cầu lông', 'Bơi lội', 'Võ thuật', 'Nhảy'].map(m => (
                                <button key={m} onClick={() => setServiceFlow({...serviceFlow, step: 2, data: {...serviceFlow.data, sport: m}})} className="p-6 border-4 border-gray-100 rounded-3xl font-black hover:border-kids-orange transition-all">{m}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        {serviceFlow.step === 2 && (
                          <div className="space-y-4 py-10 text-center">
                            <p className="text-2xl font-black text-gray-900 mb-4">Hệ thống đang match với đội ngũ sinh viên thể thao...</p>
                            <div className="w-20 h-20 border-8 border-kids-orange border-t-transparent rounded-full animate-spin mx-auto mb-8" />
                            <div className="bg-green-50 p-6 rounded-3xl border-2 border-green-200">
                               <p className="text-green-800 font-bold italic">"Đã tìm thấy 12 sinh viên đạt chuẩn năng động và có bằng cấp thi đấu phù hợp với môn {serviceFlow.data.sport}!"</p>
                            </div>
                            <button onClick={() => {
                               onAddRequest({ 
                                 kidName: 'Bé Bo', 
                                 item: `Đồng đội chơi ${serviceFlow.data.sport}`, 
                                 price: '129.000đ',
                                 category: 'Thể thao'
                               });
                               showSimulation('Kết nối thành công', 'Yêu cầu tìm đồng đội chơi thể thao đã được gửi đi!', 'success');
                               setServiceFlow({ type: null, step: 1, data: {} });
                            }} className="w-full mt-8 bg-kids-orange text-white py-6 rounded-3xl font-black text-xl shadow-xl">GỬI YÊU CẦU ĐẶT LỊCH</button>
                          </div>
                        )}
                      </>
                    )}

                    {serviceFlow.type === 'stories' && (
                      <>
                         {serviceFlow.step === 1 && (
                          <div className="space-y-4">
                            <p className="font-bold text-gray-500 uppercase text-xs">Bé muốn nghe truyện gì?</p>
                            <div className="grid grid-cols-2 gap-4">
                              {[
                                { id: 'fairy', label: 'Truyện cổ tích', badge: '🏰' },
                                { id: 'dino', label: 'Thế giới động vật (Khủng long)', badge: '🦖' },
                                { id: 'doraemon', label: 'Doraemon & Friends', badge: '🤖' },
                                { id: 'marvel', label: 'Siêu anh hùng', badge: '⚡' }
                              ].map(m => (
                                <button key={m.id} onClick={() => setServiceFlow({...serviceFlow, step: 2, data: {...serviceFlow.data, story: m.label}})} className="p-8 border-4 border-gray-100 rounded-[40px] text-center hover:border-kids-orange transition-all">
                                   <span className="text-5xl block mb-2">{m.badge}</span>
                                   <span className="font-black text-lg">{m.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {serviceFlow.step === 2 && (
                          <div className="space-y-4 py-10 text-center">
                            <p className="text-2xl font-black text-gray-900 mb-4">Đang match nhân viên kể chuyện truyền cảm...</p>
                            <div className="w-20 h-20 border-8 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-8" />
                            <div className="bg-purple-50 p-6 rounded-3xl border-2 border-purple-200">
                               <p className="text-purple-800 font-bold italic">"LinkHeart đang chọn lọc những anh chị có giọng nói truyền cảm, khả năng diễn thuyết thu hút để kể bé nghe truyện {serviceFlow.data.story}."</p>
                            </div>
                            <button onClick={() => {
                               onAddRequest({ 
                                 kidName: 'Bé Bo', 
                                 item: `Kể chuyện đêm khuya: ${serviceFlow.data.story}`, 
                                 price: '89.000đ',
                                 category: 'Kể chuyện'
                               });
                               showSimulation('Đã gửi yêu cầu', 'Yêu cầu kể chuyện đã được gửi tới bố mẹ!', 'success');
                               setServiceFlow({ type: null, step: 1, data: {} });
                            }} className="w-full mt-8 bg-purple-500 text-white py-6 rounded-3xl font-black text-xl shadow-xl">GỬI YÊU CẦU CHO BỐ MẸ</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Guarantees Section */}
              <div className="mt-20 pt-16 border-t-4 border-dashed border-gray-200 grid md:grid-cols-3 gap-8">
                 {[
                   { icon: <ShieldCheck className="w-10 h-10" />, title: '100% Gia sư được đào tạo sơ cấp cứu', desc: 'An toàn tuyệt đối cho bé' },
                   { icon: <History className="w-10 h-10" />, title: 'Hoàn tiền nếu không hài lòng sau buổi đầu', desc: 'Chất lượng là ưu tiên hàng đầu' },
                   { icon: <Shield className="w-10 h-10" />, title: 'Bảo hiểm trách nhiệm cho mỗi ca làm việc', desc: 'Yên tâm hoàn toàn cho phụ huynh' }
                 ].map((g, i) => (
                   <div key={i} className="flex gap-4 items-center p-6 bg-white rounded-3xl shadow-md">
                      <div className="p-3 bg-kids-orange/10 text-kids-orange rounded-2xl">{g.icon}</div>
                      <div>
                         <p className="font-black text-gray-900 leading-tight">{g.title}</p>
                         <p className="text-xs font-bold text-gray-400 uppercase mt-1">{g.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
            </motion.div>
          ) : activeView === 'tracking' && activeCompanion ? (
            <motion.div 
              key="tracking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-7xl mx-auto py-12"
            >
              <button onClick={() => setActiveView('home')} className="mb-8 flex items-center gap-2 text-kids-orange font-black hover:underline">
                <ArrowRight className="w-4 h-4 rotate-180" /> QUAY LẠI
              </button>
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <div className="bg-white p-4 rounded-[40px] shadow-2xl border-8 border-kids-orange/20 relative overflow-hidden h-[500px]">
                    <MapSimulation />
                    <div className="absolute top-6 left-6 bg-white/90 p-3 rounded-2xl shadow-lg border-2 border-kids-orange">
                      <p className="text-[10px] font-black text-kids-orange uppercase">Vị trí của bé</p>
                      <p className="font-black text-gray-800">Công viên Lê Văn Tám</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-xl border-4 border-kids-orange text-center">
                    <img src={activeCompanion.img} className="w-24 h-24 rounded-full border-4 border-kids-orange mx-auto mb-4 object-cover" alt="Comp" referrerPolicy="no-referrer" />
                    <h3 className="text-2xl font-black mb-1">{activeCompanion.name}</h3>
                    <p className="text-sm font-bold text-gray-500 mb-6">Đang vui chơi cùng bé</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => showSimulation('Gọi cho anh/chị', `Đang kết nối cuộc gọi với ${activeCompanion.name}...`, 'info')} className="p-4 bg-blue-100 text-blue-600 rounded-2xl flex flex-col items-center gap-2 font-black text-xs">
                        <Phone className="w-6 h-6" /> GỌI
                      </button>
                      <button onClick={() => showSimulation('Nhắn tin', '', 'info', { chat: true })} className="p-4 bg-green-100 text-green-600 rounded-2xl flex flex-col items-center gap-2 font-black text-xs">
                        <MessageCircle className="w-6 h-6" /> CHAT
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="footer-page"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-3xl mx-auto py-12"
            >
              <button onClick={() => setActiveView('home')} className="mb-8 flex items-center gap-2 text-kids-orange font-black hover:underline">
                <ArrowRight className="w-4 h-4 rotate-180" /> QUAY LẠI
              </button>
              <h2 className="text-3xl md:text-5xl font-black mb-6 md:mb-8 text-kids-orange uppercase">{footerPage?.title}</h2>
              <div className="bg-white p-6 md:p-10 rounded-[40px] border-8 border-kids-orange shadow-2xl space-y-6">
                <p className="text-2xl font-bold text-gray-800">{footerPage?.content}</p>
                <p className="text-gray-600">LinkHeart Kids luôn đồng hành cùng sự phát triển của bé yêu. Chúng tôi cam kết mang lại những trải nghiệm tuyệt vời nhất, giúp bé vừa học vừa chơi một cách hiệu quả.</p>
                <div className="grid grid-cols-2 gap-4 pt-8">
                  <img src="https://picsum.photos/seed/kids1/400/300" className="rounded-3xl border-4 border-kids-blue" alt="Kids 1" referrerPolicy="no-referrer" />
                  <img src="https://picsum.photos/seed/kids2/400/300" className="rounded-3xl border-4 border-kids-orange" alt="Kids 2" referrerPolicy="no-referrer" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SimulationModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        title={modal.title}
        type={modal.type}
      >
        {modal.data?.chat ? <ChatSimulation onBack={() => setModal({ ...modal, open: false })} /> : (
          modal.data?.handbook ? (
            <div className="space-y-6">
              {modal.data.handbook.map((h: any, i: number) => (
                <div key={i} className="p-6 bg-gray-50 rounded-3xl border-4 border-gray-200">
                  <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">{h.title}</h4>
                  <p className="text-lg font-bold text-gray-600">{h.content}</p>
                </div>
              ))}
            </div>
          ) : modal.type === 'companion' ? <CompanionDetail companion={modal.data} onConfirm={() => {
             setActiveCompanion(modal.data);
             setActiveView('tracking');
             setModal({ ...modal, open: false });
             showToast('Đã kết nối với anh/chị companion!');
          }} /> : 
          modal.content || <p className="text-gray-600 font-medium italic">Tính năng này đang được phát triển.</p>
        )}
      </SimulationModal>

      <Toast message={toast.msg} isVisible={toast.show} onClose={() => setToast({ show: false, msg: '' })} />
      <Footer theme="kids" onToast={renderFooterPage} />
    </div>
  );
};

// --- Pro Mode ---
// --- Create Help Form Component ---
const CreateHelpForm = ({ onPost, onCancel, mode = 'pro' }: { onPost: (data: any) => void, onCancel: () => void, mode?: 'pro' | 'elderly' }) => {
  const [formData, setFormData] = useState({
    service: '',
    price: '',
    location: '',
    description: '',
    phoneNumber: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.service || !formData.location) return;
    onPost(formData);
  };

  const themeColor = mode === 'elderly' ? 'bg-primary' : 'bg-gray-900';
  const textColor = mode === 'elderly' ? 'text-primary' : 'text-pro-green';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">Bạn cần giúp việc gì?</label>
          <input 
            required
            type="text" 
            placeholder="Ví dụ: Đi chợ giúp, Lau kính, Sửa điện..."
            className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-[24px] font-black text-lg focus:border-pro-green outline-none transition-all placeholder:text-gray-300"
            value={formData.service}
            onChange={e => setFormData({...formData, service: e.target.value})}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">Giá đề xuất (VNĐ)</label>
            <div className="relative">
              <input 
                type="number" 
                placeholder="50000"
                className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-[24px] font-black text-lg focus:border-pro-green outline-none transition-all"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300">đ</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">Số điện thoại liên hệ</label>
            <input 
              type="tel" 
              placeholder="0901 xxx xxx"
              className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-[24px] font-black text-lg focus:border-pro-green outline-none transition-all"
              value={formData.phoneNumber}
              onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">Địa điểm cụ thể</label>
          <div className="relative">
            <input 
              required
              type="text" 
              placeholder="Số nhà, tên đường, quận/huyện..."
              className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-[24px] font-black text-lg focus:border-pro-green outline-none transition-all pr-12"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
            />
            <MapPin className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
          </div>
        </div>

        <div>
           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">Mô tả thêm (Không bắt buộc)</label>
           <textarea 
             placeholder="Ghi chú thêm cho người giúp đỡ..."
             className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-[32px] font-bold text-sm focus:border-pro-green outline-none transition-all min-h-[120px] resize-none"
             value={formData.description}
             onChange={e => setFormData({...formData, description: e.target.value})}
           ></textarea>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button 
          type="button"
          onClick={onCancel}
          className="flex-1 py-5 bg-gray-100 text-gray-600 rounded-[24px] font-black text-sm uppercase hover:bg-gray-200 transition-all"
        >
          Hủy bỏ
        </button>
        <button 
          type="submit"
          className={`flex-1 py-5 ${themeColor} text-white rounded-[24px] font-black text-sm uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all`}
        >
          ĐĂNG NGAY
        </button>
      </div>
    </form>
  );
};

const HelpDetailCard = ({ helpDetail, onChat, onCall }: { helpDetail: any; onChat: () => void; onCall: () => void }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-pro-green/5 rounded-[32px] border border-pro-green/10">
        <div className="w-16 h-16 bg-pro-green text-white rounded-[24px] flex items-center justify-center shadow-lg">
          <UserIcon className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-2xl font-black text-gray-900">{helpDetail.userName}</h4>
          <p className="text-sm font-bold text-pro-green uppercase tracking-wider">{helpDetail.service}</p>
        </div>
      </div>

      <div className="h-48 rounded-[32px] overflow-hidden border-4 border-white shadow-xl">
        <MapSimulation coords={helpDetail.coords || { x: 50, y: 50 }} />
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-[28px] border border-gray-100">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <MapPin className="text-pro-green w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Địa điểm cần hỗ trợ</p>
            <p className="font-bold text-gray-900">{helpDetail.location}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-5 bg-gray-50 rounded-[28px] border border-gray-100">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <Phone className="text-pro-green w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Thông tin liên hệ</p>
            <p className="font-bold text-gray-900">{helpDetail.phoneNumber || '0901 234 567'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={onChat}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 text-blue-600 rounded-[32px] border border-blue-100 hover:bg-blue-600 hover:text-white transition-all group"
        >
          <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-blue-500 transition-colors">
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="font-black text-xs uppercase tracking-widest">Nhắn tin</span>
        </button>

        <button 
          onClick={onCall}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-green-50 text-green-600 rounded-[32px] border border-green-100 hover:bg-green-600 hover:text-white transition-all group"
        >
          <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-green-500 transition-colors">
            <Phone className="w-6 h-6" />
          </div>
          <span className="font-black text-xs uppercase tracking-widest">Gọi điện</span>
        </button>
      </div>

      <button 
        onClick={() => {
           window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(helpDetail.location)}`, '_blank');
        }}
        className="w-full flex items-center justify-center gap-3 p-5 bg-gray-900 text-white rounded-[28px] hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
      >
        <Navigation className="w-5 h-5" />
        <span className="font-black text-xs uppercase tracking-widest">Mở bản đồ chỉ đường</span>
      </button>
    </div>
  );
};

const ProMode = ({ 
  onBack, 
  walletBalance, 
  handleUpdateBalance, 
  kidRequests, 
  setKidRequests,
  trialDaysLeft,
  userData,
  onSelectPlan,
  initialView = 'home'
}: { 
  onBack: () => void, 
  walletBalance: number, 
  handleUpdateBalance: (amount: number) => void, 
  kidRequests: KidRequest[], 
  setKidRequests: React.Dispatch<React.SetStateAction<KidRequest[]>>,
  trialDaysLeft: number | null,
  userData: any,
  onSelectPlan: (plan: Plan) => void,
  initialView?: ProView
}) => {
  const [activeView, setActiveView] = useState<ProView>(initialView);
  const [footerPage, setFooterPage] = useState<{ title: string; content: string } | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; request: KidRequest | null; processing: boolean; method?: 'visa' | 'bank' }>({ open: false, request: null, processing: false });
  const [withdrawalModal, setWithdrawalModal] = useState({ open: false, amount: 0, processing: false });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [helpRequests, setHelpRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [acceptedHelp, setAcceptedHelp] = useState<any[]>([]);
  const [skippedHelpIds, setSkippedHelpIds] = useState<string[]>([]);
  const [rechargeState, setRechargeState] = useState<{ step: 'select' | 'amount' | 'detail'; method: 'visa' | 'bank' | null; amount: number }>({ step: 'select', method: null, amount: 0 });
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [useVoucherForPayment, setUseVoucherForPayment] = useState(false);

  // Seed Mock Help Requests if empty
  useEffect(() => {
    const seedMockHelp = async () => {
      const helpRef = collection(db, 'helpRequests');
      try {
        const snap = await getDocs(helpRef);
        if (snap.empty) {
          const mockRequests = [
            { userName: 'Bà Năm', service: 'Đi chợ giúp', location: 'Chung cư EcoHome', time: '10:00 AM', phoneNumber: '0901234567', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Chị Mai', service: 'Trông trẻ 2h', location: 'Phố Cổ', time: '02:00 PM', phoneNumber: '0912345678', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Ông Tư', service: 'Sửa vòi nước', location: 'Quận 7', time: '04:00 PM', phoneNumber: '0923456789', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Anh Tuấn', service: 'Dắt chó đi dạo', location: 'Linh Đàm', time: '05:00 PM', phoneNumber: '0934567890', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Bà Hoa', service: 'Đọc báo cho nghe', location: 'Cầu Giấy', time: '09:00 AM', phoneNumber: '0945678901', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Cô Diệp', service: 'Tưới cây giúp', location: 'Royal City', time: '11:00 AM', phoneNumber: '0956789012', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Bác Hùng', service: 'Tải app điện thoại', location: 'Hồ Tây', time: '03:00 PM', phoneNumber: '0967890123', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Chị Lan', service: 'Mua thuốc giúp', location: 'Trương Định', time: '08:00 AM', phoneNumber: '0978901234', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Anh Bình', service: 'Vận chuyển đồ', location: 'Thanh Xuân', time: '01:00 PM', phoneNumber: '0989012345', status: 'open', createdAt: serverTimestamp() },
            { userName: 'Em Bé Ngọt', service: 'Lấy hộ bưu kiện', location: 'Time City', time: '10:30 AM', phoneNumber: '0990123456', status: 'open', createdAt: serverTimestamp() }
          ];
          for (const req of mockRequests) {
            await addDoc(helpRef, { ...req, userId: 'mock-user-' + Math.random().toString(36).substr(2, 9) });
          }
        }
      } catch (error) {
        console.warn("Seeding help requests skipped or failed:", error);
      }
    };
    seedMockHelp();
  }, []);

  // Sync Accepted Help
  useEffect(() => {
    if (!auth.currentUser) return;
    const acceptedRef = collection(db, 'users', auth.currentUser!.uid, 'acceptedHelp');
    const unsubscribe = onSnapshot(acceptedRef, (snap) => {
      setAcceptedHelp(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, 'list', `users/${auth.currentUser?.uid}/acceptedHelp`));
    return () => unsubscribe();
  }, []);

  // Analytics helper: spending by day (last 7 days)
  const [spendingStats, setSpendingStats] = useState<{ date: string; spending: number; earning: number }[]>([]);

  const [elderlyStatus, setElderlyStatus] = useState({
    name: 'Mẹ Lan',
    healthScore: 88,
    heartRate: 74,
    mood: 'Vui vẻ',
    activeService: 'Đang đi dạo cùng Companion'
  });
  
  // Sync User Profile
  useEffect(() => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser!.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data());
      } else {
        // Initialize if not exists
        setDoc(userRef, {
          uid: auth.currentUser!.uid,
          email: auth.currentUser!.email,
          displayName: auth.currentUser!.displayName,
          walletBalance: 0,
          totalTrips: 0,
          rating: 0,
          createdAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, 'create', `users/${auth.currentUser?.uid}`));
      }
    }, (err) => handleFirestoreError(err, 'get', `users/${auth.currentUser?.uid}`));

    const reviewsRef = collection(db, 'users', auth.currentUser!.uid, 'reviews');
    const unsubscribeReviews = onSnapshot(reviewsRef, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, 'list', `users/${auth.currentUser?.uid}/reviews`));

    return () => {
      unsubscribe();
      unsubscribeReviews();
    };
  }, []);

  // Sync Public Help Requests
  useEffect(() => {
    const helpRef = collection(db, 'helpRequests');
    const q = query(helpRef, where('status', '==', 'open'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setHelpRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, 'list', 'helpRequests'));
    return () => unsubscribe();
  }, []);

  const [appointments, setAppointments] = useState<Appointment[]>([
    { id: 'LH-992', service: 'Đồng hành y tế', companion: COMPANIONS[0], status: 'active', time: '08:00 - 10:00', location: 'BV Chợ Rẫy' }
  ]);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  
  // Sync Elderly Status from Firestore
  useEffect(() => {
    if (!auth.currentUser) return;
    const statsRef = doc(db, 'users', auth.currentUser!.uid, 'status', 'elderly');
    const unsubscribe = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setElderlyStatus(snap.data() as any);
      }
    }, (err) => handleFirestoreError(err, 'get', `users/${auth.currentUser?.uid}/status/elderly`));
    return () => unsubscribe();
  }, []);

  // Sync Transactions & Logs from Firestore
  useEffect(() => {
    if (!auth.currentUser) return;
    const txRef = collection(db, 'users', auth.currentUser!.uid, 'transactions');
    const qTx = query(txRef, orderBy('date', 'desc'));
    const unsubscribeTx = onSnapshot(qTx, (snap) => {
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(txs);
      
      // Calculate daily stats for Recharts
      const last7Days: Record<string, { spending: number; earning: number }> = {};
      const now = new Date();
      for(let i=0; i<7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last7Days[d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })] = { spending: 0, earning: 0 };
      }

      txs.forEach((tx: any) => {
        if (tx.date) {
            const dateStr = (tx.date.toDate ? tx.date.toDate() : new Date(tx.date)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            if (last7Days[dateStr] !== undefined) {
              if (tx.type === 'payment') last7Days[dateStr].spending += tx.amount;
              if (tx.type === 'earning') last7Days[dateStr].earning += tx.amount;
            }
        }
      });

      const stats = Object.entries(last7Days)
        .map(([date, val]) => ({ date, spending: val.spending, earning: val.earning }))
        .reverse();
      setSpendingStats(stats);
    }, (err) => handleFirestoreError(err, 'list', `users/${auth.currentUser?.uid}/transactions`));

    const logsRef = collection(db, 'users', auth.currentUser!.uid, 'logs');
    const qLogs = query(logsRef, orderBy('createdAt', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      setSystemLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, 'list', `users/${auth.currentUser?.uid}/logs`));

    return () => {
      unsubscribeTx();
      unsubscribeLogs();
    };
  }, []);

  const recordTransaction = async (tx: { type: 'deposit' | 'payment' | 'earning' | 'withdrawal', title: string, amount: number }) => {
    if (!auth.currentUser) return;
    try {
      const txRef = collection(db, 'users', auth.currentUser!.uid, 'transactions');
      await addDoc(txRef, {
        ...tx,
        date: serverTimestamp()
      }).catch(err => handleFirestoreError(err, 'create', `users/${auth.currentUser?.uid}/transactions`));
      
      // Also record to logs
      let actionMsg = "";
      let logType: any = "financial";
      if(tx.type === 'deposit') actionMsg = `Nạp tiền: +${tx.amount.toLocaleString()}đ`;
      else if(tx.type === 'payment') actionMsg = `Thanh toán: ${tx.title} (-${tx.amount.toLocaleString()}đ)`;
      else if(tx.type === 'earning') actionMsg = `Thu nhập: ${tx.title} (+${tx.amount.toLocaleString()}đ)`;
      else if(tx.type === 'withdrawal') actionMsg = `Rút tiền: -${tx.amount.toLocaleString()}đ`;

      await addSystemLog(actionMsg, logType);
    } catch (err) {
      console.error('Error recording transaction:', err);
    }
  };

  const addSystemLog = async (action: string, type: 'kid' | 'senior' | 'financial' | 'system') => {
    if (!auth.currentUser) return;
    try {
      const logsRef = collection(db, 'users', auth.currentUser!.uid, 'logs');
      await addDoc(logsRef, {
        action,
        type,
        createdAt: serverTimestamp(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }).catch(err => handleFirestoreError(err, 'create', `users/${auth.currentUser?.uid}/logs`));
    } catch (err) {
      console.error('Error adding system log:', err);
    }
  };

  const [modal, setModal] = useState<{ open: boolean; title: string; content: React.ReactNode; type: any; data?: any }>({
    open: false,
    title: '',
    content: '',
    type: 'info'
  });
  const [toast, setToast] = useState({ show: false, msg: '' });

  const showSimulation = (title: string, content: React.ReactNode = '', type: any = 'success', data?: any) => {
    setModal({ open: true, title, content, type, data });
  };

  const showRandomCompanion = async (service: string) => {
    showSimulation(`Đặt lịch ${service}`, '', 'loading');
    try {
      const companionsRef = collection(db, "companions");
      const snapshot = await getDocs(companionsRef).catch(err => handleFirestoreError(err, 'list', 'companions'));
      const companionsData = snapshot.docs.map(doc => doc.data() as Companion);
      
      if (companionsData.length === 0) {
        showSimulation('Opps!', 'Hiện chưa có Companion nào đăng ký dịch vụ này.', 'info');
        return;
      }

      const randomComp = companionsData[Math.floor(Math.random() * companionsData.length)];
      showSimulation('Đã tìm thấy Companion!', '', 'companion', { ...randomComp, service });
    } catch (error) {
      console.error("Fetch Companions Error:", error);
      showSimulation('Lỗi', 'Không thể kết nối với cơ sở dữ liệu để tìm Companion.', 'danger');
    }
  };

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const handlePayment = async (amount: number, method: 'visa' | 'bank') => {
    try {
      if (!auth.currentUser) throw new Error("Chưa đăng nhập");
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const newBalance = (userProfile?.walletBalance || 0) + amount;
      await updateDoc(userRef, { walletBalance: newBalance }).catch(err => handleFirestoreError(err, 'update', `users/${auth.currentUser?.uid}`));
      await recordTransaction({
        type: 'deposit',
        title: `Nạp tiền qua ${method === 'visa' ? 'Visa' : 'Chuyển khoản'}`,
        amount: amount
      });
      setRechargeState({ ...rechargeState, amount: 0 });
      showSimulation('Thanh toán thành công', `Bạn đã nạp thành công ${amount.toLocaleString()}đ vào ví thông qua thẻ mặc định.`, 'success');
      showToast('Số dư ví đã được cập nhật!');
    } catch (err) {
      console.error("Payment Error:", err);
      showSimulation('Lỗi giao dịch', 'Không thể xử lý giao dịch lúc này. Vui lòng thử lại sau.', 'info');
    }
  };

  const handleWithdrawal = async (amount: number) => {
    if ((userProfile?.walletBalance || 0) < amount) {
      showToast('Số dư không đủ để rút!');
      return;
    }
    setWithdrawalModal({ ...withdrawalModal, processing: true });
    setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const newBalance = (userProfile?.walletBalance || 0) - amount;
        await updateDoc(userRef, { walletBalance: newBalance });
        await recordTransaction({
          type: 'withdrawal',
          title: `Rút tiền về thẻ **** 8888`,
          amount: amount
        });
        setWithdrawalModal({ open: false, amount: 0, processing: false });
        showSimulation('Rút tiền thành công', `Yêu cầu rút ${amount.toLocaleString()}đ đã được xử lý thành công về tài khoản ngân hàng của bạn.`, 'success');
      } catch (err) {
        handleFirestoreError(err, 'update', `users/${auth.currentUser?.uid}`);
      }
    }, 2000);
  };

  const skipHelp = (requestId: string) => {
    setSkippedHelpIds(prev => [...prev, requestId]);
    showToast('Đã bỏ qua yêu cầu này.');
  };

  const matchToHelp = async (request: any) => {
    showSimulation('Đang kết nối...', '', 'loading');
    setTimeout(async () => {
      try {
        if (!auth.currentUser) return;
        
        // Update request status
        const helpRef = doc(db, 'helpRequests', request.id);
        await updateDoc(helpRef, { status: 'matched' });

        // Add to user's accepted help list
        const acceptedRef = collection(db, 'users', auth.currentUser!.uid, 'acceptedHelp');
        await addDoc(acceptedRef, { ...request, status: 'accepted', acceptedAt: serverTimestamp() });

        // Update user stats
        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const newBalance = (userProfile?.walletBalance || 0) + 50000; // Gift for helping
        const newTrips = (userProfile?.totalTrips || 0) + 1;
        await updateDoc(userRef, { 
          walletBalance: newBalance,
          totalTrips: newTrips 
        });

        await recordTransaction({
          type: 'earning',
          title: `Giúp đỡ ${request.userName}: ${request.service}`,
          amount: 50000
        });

        showSimulation('Ghép nối thành công!', '', 'success', { helpDetail: request });
        showToast('Đã thêm 1 chuyến giúp đỡ!');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `helpRequests/${request.id}`);
      }
    }, 800);
  };

  const startTracking = (appointment: Appointment) => {
    setActiveAppointment(appointment);
    setActiveView('tracking');
    showToast('Đang mở chế độ theo dõi thời gian thực...');
  };

  const handleCreateHelpRequest = async (formData: any) => {
    if (!auth.currentUser) return;
    showSimulation('Đang đăng yêu cầu...', '', 'loading');
    try {
      const mockCoords = { 
        x: Math.floor(Math.random() * 60) + 20, 
        y: Math.floor(Math.random() * 60) + 20 
      };

      const helpRef = collection(db, 'helpRequests');
      await addDoc(helpRef, {
        ...formData,
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Người dùng LinkHeart',
        userImg: auth.currentUser.photoURL || 'https://picsum.photos/seed/user/100/100',
        coords: mockCoords,
        status: 'open',
        createdAt: serverTimestamp()
      });

      setModal({ open: false, title: '', content: '', type: 'info' });
      showSimulation('Đăng thành công!', 'Yêu cầu của bạn đã được gửi tới bảng tin "Tổng chuyến" của cộng đồng LinkHeart.', 'success');
      showToast('Đã đăng yêu cầu giúp đỡ!');
    } catch (err) {
      console.error('Error creating help request:', err);
      showToast('Lỗi khi đăng yêu cầu!');
    }
  };

  const renderHome = () => {
    return (
      <div className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
             onClick={() => setActiveView('appointments')}
             className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
              <History className="text-blue-500 w-6 h-6" />
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Lịch hẹn đã đặt</p>
            <p className="text-3xl font-black text-gray-900">{appointments.length}</p>
          </div>

          <div 
             onClick={() => setActiveView('reviews')}
             className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-100 transition-colors">
              <Star className="text-yellow-500 w-6 h-6" />
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Đánh giá hiện tại</p>
            <p className="text-3xl font-black text-gray-900">{userProfile?.rating || '0.0'}/5.0</p>
          </div>

          <div 
             onClick={() => setActiveView('wallet')}
             className="bg-gray-900 p-8 rounded-[32px] shadow-xl text-white cursor-pointer hover:scale-[1.02] transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-pro-green/10 rounded-full -mr-12 -mt-12" />
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <Wallet className="text-pro-green w-6 h-6" />
            </div>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider mb-1">Số dư ví LinkHeart</p>
            <p className="text-3xl font-black">{ (userProfile?.walletBalance || 0).toLocaleString() }đ</p>
          </div>
        </div>

        <div className="bg-pro-green/10 p-8 rounded-[48px] border-4 border-dashed border-pro-green/30 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-pro-green text-white rounded-3xl flex items-center justify-center shadow-lg shadow-pro-green/20">
                 <PlusCircle className="w-8 h-8" />
              </div>
              <div>
                 <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Bạn cần giúp đỡ ngay?</h4>
                 <p className="text-sm font-bold text-gray-500 italic">Đăng yêu cầu của bạn lên bảng tin cộng đồng LinkHeart</p>
              </div>
           </div>
           <button 
             onClick={() => showSimulation('Đăng yêu cầu giúp đỡ', <CreateHelpForm onPost={handleCreateHelpRequest} onCancel={() => setModal({...modal, open: false})} />, 'info')}
             className="px-10 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-sm shadow-xl hover:bg-pro-green transition-all active:scale-95 whitespace-nowrap"
           >
              ĐĂNG YÊU CẦU NGAY
           </button>
        </div>

        <StaffSection 
          onSelectStaff={(s) => showSimulation('Nhân viên hỗ trợ', `Bạn đã chọn ${s.name} để hỗ trợ các công việc gia đình!`, 'success')} 
          showSimulation={showSimulation}
          mode="pro" 
        />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-black mb-8 uppercase tracking-widest flex items-center gap-3">
              <Activity className="text-pro-green" /> Thống kê Tài chính (7 ngày)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingStats}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" fontSize={10} fontWeight="black" axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f8f9fa' }}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '16px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="spending" name="Chi tiêu (Dịch vụ)" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="earning" name="Thu nhập (Hỗ trợ)" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-xl font-black mb-8 uppercase tracking-widest flex items-center gap-3">
              <Heart className="text-red-500" /> Tổng chuyến: Cơ hội giúp đỡ
            </h3>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-2 no-scrollbar">
              {helpRequests.filter(r => !skippedHelpIds.includes(r.id)).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                   <Users className="w-12 h-12 text-gray-200 mb-4" />
                   <p className="text-gray-400 font-bold italic">Hiện chưa có yêu cầu hỗ trợ nào trong khu vực của bạn.</p>
                </div>
              ) : helpRequests.filter(r => !skippedHelpIds.includes(r.id)).map((req) => (
                <div key={req.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-pro-green transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                       <MapPin className="text-pro-green w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-gray-900">{req.userName}</p>
                      <p className="text-xs font-bold text-gray-500 uppercase">{req.service}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => skipHelp(req.id)}
                      className="px-4 py-3 bg-white border border-gray-200 text-gray-400 rounded-xl font-black text-[10px] uppercase hover:bg-gray-50"
                    >
                      BỎ QUA
                    </button>
                    <button 
                      onClick={() => matchToHelp(req)}
                      className="px-6 py-3 bg-pro-green text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-pro-green/20"
                    >
                      GIÚP ĐỠ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {acceptedHelp.length > 0 && (
          <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
            <h3 className="text-xl font-black mb-8 uppercase tracking-widest flex items-center gap-3 text-pro-green">
              <CheckCircle2 className="w-6 h-6" /> Danh sách giúp đỡ của tôi
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {acceptedHelp.map((item) => (
                <div key={item.id} className="p-6 border-4 border-pro-green/10 rounded-[32px] bg-white hover:border-pro-green/30 transition-all flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-pro-green text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black text-lg text-gray-900">{item.userName}</p>
                      <p className="text-xs font-bold text-pro-green uppercase">{item.service}</p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-8 flex-1">
                    <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                      <MapPin className="w-4 h-4" /> <span>{item.location}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                      <Clock className="w-4 h-4" /> <span>{item.time}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => showSimulation('Chỉ đường', `Đang mở bản đồ chỉ đường tới ${item.location}...`, 'info')} className="p-3 bg-gray-50 text-gray-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-pro-green hover:text-white transition-all">
                      <Navigation className="w-4 h-4" /> CHỈ ĐƯỜNG
                    </button>
                    <button onClick={() => showSimulation('Thông tin chi tiết', '', 'info', { helpDetail: item })} className="p-3 bg-gray-50 text-gray-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-pro-green hover:text-white transition-all">
                      <FileText className="w-4 h-4" /> CHI TIẾT
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => showSimulation('Nhắn tin', `Kết nối chat với ${item.userName}...`, 'info', { chat: true })} className="p-3 bg-blue-50 text-blue-500 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all">
                      <MessageCircle className="w-4 h-4" /> CHAT
                    </button>
                    <button onClick={() => showSimulation('Gọi điện', `Đang gọi điện cho ${item.userName}...`, 'info')} className="p-3 bg-green-50 text-green-500 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-green-500 hover:text-white transition-all">
                      <Phone className="w-4 h-4" /> GỌI ĐIỆN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFooterPage = (title: string) => {
    const contentMap: Record<string, string> = {
      'Sứ mệnh': 'LinkHeart ra đời với sứ mệnh xóa nhòa khoảng cách thế hệ, mang lại sự an tâm cho gia đình và tạo thu nhập ý nghĩa cho sinh viên. Chúng tôi khao khát xây dựng một cộng đồng nơi sự tử tế được lan tỏa và mỗi cá nhân đều cảm thấy được đồng hành.',
      'Đội ngũ': 'Chúng tôi là tập hợp những chuyên gia công nghệ, y tế và giáo dục hàng đầu Việt Nam. Với hơn 10 năm kinh nghiệm trong lĩnh vực chăm sóc sức khỏe và phát triển cộng đồng, đội ngũ LinkHeart cam kết mang lại dịch vụ tốt nhất.',
      'Tuyển dụng': 'LinkHeart luôn chào đón các bạn sinh viên năng động và có tâm hồn nhân hậu gia nhập đội ngũ Companion. Chúng tôi cung cấp môi trường làm việc linh hoạt, thu nhập hấp dẫn và cơ hội phát triển kỹ năng mềm tuyệt vời.',
      'Cho trẻ em': 'Dịch vụ dành riêng cho các bé dưới 18 tuổi. Các anh chị Companion sẽ hỗ trợ học tập, vui chơi và rèn luyện kỹ năng sống trong môi trường an toàn tuyệt đối.',
      'Cho người lớn': 'Dịch vụ dành cho người trưởng thành bận rộn. Tìm bạn đồng hành tập gym, đi du lịch, hoặc đơn giản là người hỗ trợ các công việc hàng ngày.',
      'Cho người già': 'Chế độ chăm sóc đặc biệt cho người cao tuổi. Companion được đào tạo kỹ năng y tế cơ bản, tâm lý học và luôn sẵn sàng lắng nghe, chia sẻ.',
      'Trung tâm trợ giúp': 'Bạn cần hỗ trợ? Liên hệ hotline 1900 1234 hoặc chat trực tiếp với chúng tôi 24/7. Chúng tôi luôn sẵn sàng giải đáp mọi thắc mắc của bạn về dịch vụ và kỹ thuật.',
      'Điều khoản': 'Sử dụng dịch vụ LinkHeart đồng nghĩa với việc bạn đồng ý với các quy định về an toàn, bảo mật và trách nhiệm của chúng tôi. Vui lòng đọc kỹ trước khi sử dụng.',
      'Bảo mật': 'Dữ liệu của bạn và người thân được mã hóa đầu cuối và bảo vệ bởi các tiêu chuẩn an ninh mạng cao nhất. Chúng tôi cam kết không chia sẻ thông tin cá nhân cho bên thứ ba.'
    };
    setFooterPage({ title, content: contentMap[title] || 'Nội dung đang được cập nhật...' });
    setActiveView('footer-page');
    window.scrollTo(0, 0);
  };

  return (
    <div className="theme-pro min-h-screen bg-pro-white flex flex-col">
      <Toast message={toast.msg} isVisible={toast.show} onClose={() => setToast({ ...toast, show: false })} />
      
      <SimulationModal 
        isOpen={paymentModal.open} 
        onClose={() => setPaymentModal({ open: false, request: null, processing: false })}
        title="Thanh toán & Phê duyệt"
        type="info"
      >
        {paymentModal.request && (() => {
          const rawPrice = parseInt(paymentModal.request.price.replace(/\D/g, '')) || 0;
          const hasDiscount = trialDaysLeft !== null && trialDaysLeft > 0;
          const discountAmount = hasDiscount ? rawPrice * 0.3 : 0;
          const finalPrice = rawPrice - discountAmount - (useVoucherForPayment ? rawPrice * 0.2 : 0);
          const isEnough = walletBalance >= finalPrice;

          return (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="font-bold text-gray-900 mb-2">Chi tiết yêu cầu:</p>
                <p className="text-gray-600">Bé: <span className="font-black text-kids-orange">{paymentModal.request.kidName}</span></p>
                <p className="text-gray-600">Món quà: <span className="font-black text-kids-orange">{paymentModal.request.item}</span></p>
              </div>

              {/* Voucher Wallet Option */}
              {userData?.voucherSubscriptionActive && userData?.vouchers > 0 && (
                <div 
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${useVoucherForPayment ? 'border-colorful bg-colorful/5' : 'border-gray-100'}`}
                  onClick={() => setUseVoucherForPayment(!useVoucherForPayment)}
                >
                  <div className="flex items-center gap-3">
                     <Wallet className={`w-5 h-5 ${useVoucherForPayment ? 'text-colorful' : 'text-gray-400'}`} />
                     <div>
                        <p className="text-[10px] font-black uppercase text-gray-400">Dùng LinkHeart Voucher</p>
                        <p className="text-xs font-bold">Giảm giá 20% thanh toán</p>
                     </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${useVoucherForPayment ? 'border-colorful bg-colorful text-white' : 'border-gray-300'}`}>
                    {useVoucherForPayment && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-gray-500 font-bold">
                  <span>Giá gốc:</span>
                  <span>{rawPrice.toLocaleString()}đ</span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-pro-green font-bold flex-wrap">
                     <span>Ưu đãi Dùng thử (30%):</span>
                     <span>-{discountAmount.toLocaleString()}đ</span>
                  </div>
                )}
                {useVoucherForPayment && (
                  <div className="flex justify-between text-colorful font-bold flex-wrap">
                     <span>Voucher LinkHeart (20%):</span>
                     <span>-{(rawPrice * 0.2).toLocaleString()}đ</span>
                  </div>
                )}
                <div className="flex justify-between text-xl md:text-2xl font-black text-gray-900 pt-2 border-t border-gray-200">
                  <span>Tổng thanh toán:</span>
                  <span>{finalPrice.toLocaleString()}đ</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span className="text-gray-500">Số dư ví hiện tại:</span>
                  <span className={walletBalance >= finalPrice ? 'text-gray-900' : 'text-red-500'}>
                    {walletBalance.toLocaleString()}đ
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setPaymentModal({ open: false, request: null, processing: false })}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Huỷ
                </button>
                <button 
                  onClick={async () => {
                     setPaymentModal(prev => ({ ...prev, processing: true }));
                     if (!isEnough) {
                       showToast('Số dư thanh toán không đủ!');
                       setPaymentModal(prev => ({ ...prev, processing: false }));
                       return;
                     }
                     try {
                        const userRef = doc(db, 'users', auth.currentUser!.uid);
                        const reqRef = doc(db, 'users', auth.currentUser!.uid, 'requests', paymentModal.request!.id.toString());
                        
                        const updates: any = { walletBalance: walletBalance - finalPrice };
                        if (useVoucherForPayment) {
                          updates.vouchers = (userData?.vouchers || 1) - 1;
                        }

                        await updateDoc(userRef, updates);
                        await updateDoc(reqRef, { 
                          status: 'approved', 
                          finalPrice: finalPrice,
                          approvedAt: serverTimestamp() 
                        });
                        
                        await recordTransaction({
                          type: 'payment',
                          title: `Mua quà cho bé: ${paymentModal.request!.item}`,
                          amount: finalPrice
                        });

                        setUseVoucherForPayment(false);
                        setPaymentModal({ open: false, request: null, processing: false });
                        showSimulation('Duyệt thành công', `Đã mua ${paymentModal.request!.item} cho ${paymentModal.request!.kidName}!`, 'success');
                     } catch(err) {
                        console.error('Approve error:', err);
                        showToast('Lỗi thanh toán!');
                        setPaymentModal(prev => ({ ...prev, processing: false }));
                     }
                  }}
                  disabled={paymentModal.processing}
                  className={`flex-1 py-3 px-4 font-bold rounded-xl transition-colors ${
                    !isEnough 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-pro-green text-white hover:bg-green-600'
                  }`}
                >
                  {paymentModal.processing ? 'Đang xử lý...' : (isEnough ? 'Xác nhận' : 'Nạp thêm')}
                </button>
              </div>
            </div>
          );
        })()}
      </SimulationModal>

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-50 w-full">
        <div className="flex items-center gap-4 cursor-pointer shrink-0 mr-2 md:mr-8" onClick={() => setActiveView('home')}>
          <div className="w-12 h-12 bg-gradient-to-r from-pro-green to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-pro-green/30">
            <Heart className="text-white w-6 h-6" fill="currentColor" />
          </div>
          <div className="hidden sm:block">
            <span className="text-2xl font-normal font-display block leading-none text-gray-900">LinkHeart <span className="font-bold text-pro-green italic">Pro</span></span>
            <span className="text-[10px] font-bold text-pro-green uppercase tracking-[0.2em]">Trung tâm Quản lý gia đình</span>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar py-2">
          {[
            { id: 'home', label: 'Bảng điều khiển', icon: <LayoutDashboard className="w-5 h-5 md:w-4 md:h-4" /> },
            { id: 'management', label: 'Trung tâm quản trị', icon: <ShieldCheck className="w-5 h-5 md:w-4 md:h-4" /> },
            { id: 'appointments', label: 'Lịch hẹn', icon: <Calendar className="w-5 h-5 md:w-4 md:h-4" /> },
            { id: 'wallet', label: 'Ví tiền', icon: <Wallet className="w-5 h-5 md:w-4 md:h-4" /> },
            { id: 'dating', label: 'Hẹn hò', icon: <Heart className="w-5 h-5 md:w-4 md:h-4" /> },
            { id: 'plans', label: 'Gói dịch vụ', icon: <Gift className="w-5 h-5 md:w-4 md:h-4" /> }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveView(item.id as ProView)}
              className={`text-sm font-bold flex items-center gap-2 transition-colors relative shrink-0 ${activeView === item.id ? 'text-pro-green' : 'text-gray-400 hover:text-pro-green'}`}
            >
              {item.icon}
              <span className="hidden lg:inline">{item.label}</span>
              {item.id === 'management' && kidRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-kids-orange text-white text-[8px] flex items-center justify-center rounded-full animate-bounce">
                  {kidRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
          <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-gray-50 text-gray-400 hover:text-pro-green transition-all rounded-xl font-bold text-sm shrink-0 ml-auto">
            <ArrowLeft className="w-5 h-5 md:w-5 md:h-5 shrink-0" />
            <span className="hidden sm:inline">QUAY LẠI</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        <AnimatePresence mode="wait">
          {activeView === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="mb-12 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2 leading-tight uppercase">Bảng điều khiển <br /> Master Dashboard</h1>
                  <p className="text-gray-500 font-medium italic">"Mọi thành viên trong tầm mắt, mọi hành trình trọn niềm tin"</p>
                </div>
                <div className="flex gap-4">
                  {kidRequests.filter(r => r.status === 'pending').length > 0 && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => setActiveView('management')}
                      className="bg-kids-orange/10 border-2 border-kids-orange p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-kids-orange/20 transition-all mr-4"
                    >
                       <div className="w-10 h-10 bg-kids-orange text-white rounded-full flex items-center justify-center animate-bounce">
                          <MessageCircle className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-xs font-black text-kids-orange uppercase">Thông báo mới</p>
                          <p className="text-sm font-bold text-gray-900">{kidRequests.filter(r => r.status === 'pending').length} yêu cầu đang chờ duyệt</p>
                       </div>
                    </motion.div>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Ví Gia Đình</p>
                    <p className="text-3xl font-black text-pro-green">{(userProfile?.walletBalance || 0).toLocaleString()}đ</p>
                  </div>
                  <button 
                    onClick={() => setModal({ open: true, title: 'Nạp tiền vào ví', type: 'info', content: '' })}
                    className="w-12 h-12 bg-white border-4 border-pro-green text-pro-green rounded-full flex items-center justify-center shadow-[4px_4px_0_0_rgba(45,106,79,1)] active:translate-y-1 active:shadow-none transition-all font-black text-2xl"
                  >
                    +
                  </button>
                </div>
              </div>
              {renderHome()}
            </motion.div>
          )}

          {activeView === 'plans' && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <div className="mb-12">
                <h1 className="text-4xl font-black text-gray-900 mb-2 leading-tight uppercase">Gói dịch vụ & <br /> Ưu đãi hội viên</h1>
                <p className="text-gray-500 font-medium italic">"Lựa chọn sự an tâm cho gia đình bạn"</p>
              </div>
              <div className="bg-white rounded-[48px] shadow-xl border-8 border-white overflow-hidden p-0 -mx-6 md:mx-0">
                <Pricing 
                  onBack={() => setActiveView('home')}
                  activePlanId={userData?.activePlanId}
                  isEmbedded={true}
                  trialDaysLeft={trialDaysLeft}
                  userData={userData}
                  onSelectPlan={onSelectPlan}
                />
              </div>
            </motion.div>
          )}

          {activeView === 'dating' && (
            <motion.div 
               key="dating"
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
            >
               <DatingView onBack={() => setActiveView('home')} showToast={showToast} />
            </motion.div>
          )}

          {activeView === 'management' && (
            <motion.div 
              key="management"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-4xl font-black text-gray-900 flex items-center gap-4">
                  <ShieldCheck className="w-10 h-10 text-pro-green" />
                  TRUNG TÂM QUẢN TRỊ
                </h2>
                <div className="flex items-center gap-2 px-6 py-3 bg-pro-green/10 text-pro-green rounded-full font-bold text-sm">
                   <div className="w-2 h-2 bg-pro-green rounded-full animate-ping" />
                   GIA ĐÌNH ĐANG ĐƯỢC BẢO VỆ
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Kid Request Monitoring */}
                <div className="bg-white p-8 rounded-[48px] shadow-xl border-2 border-gray-100 flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight">
                       <MessageCircle className="text-kids-orange" /> Duyệt yêu cầu từ bé
                    </h3>
                    <span className="bg-kids-orange text-white px-3 py-1 rounded-full text-xs font-black">{kidRequests.filter(r => r.status === 'pending').length} MỚI</span>
                  </div>
                  <div className="space-y-4 flex-1">
                    {kidRequests.filter(r => r.status === 'pending').length === 0 ? (
                       <p className="text-center py-10 text-gray-400 font-bold italic">Không có yêu cầu nào mới</p>
                    ) : kidRequests.filter(r => r.status === 'pending').map((req) => (
                      <div key={req.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 hover:border-kids-orange transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-kids-orange/20 rounded-full flex items-center justify-center text-kids-orange">
                              <Bot className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="font-extrabold text-gray-900">{req.kidName} muốn: <span className="text-kids-orange">{req.item}</span></p>
                              <p className="text-xs font-bold text-gray-500 uppercase">GIÁ: {req.price}</p>
                           </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                           <button 
                             onClick={async () => {
                               try {
                                 const reqRef = doc(db, 'users', auth.currentUser!.uid, 'requests', req.id.toString());
                                 await deleteDoc(reqRef);
                                 await addSystemLog(`Từ chối yêu cầu từ ${req.kidName}: ${req.item}`, 'kid');
                                 showToast(`Đã xoá yêu cầu từ ${req.kidName}`);
                               } catch (err) {
                                  console.error('Reject error:', err);
                                }
                             }}
                             className="flex-1 sm:px-4 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold text-xs"
                           >
                             TỪ CHỐI
                           </button>
                           <button 
                             onClick={() => {
                               setPaymentModal({ open: true, request: req, processing: false });
                             }}
                             className="flex-1 sm:px-4 py-2 bg-pro-green text-white rounded-xl font-bold text-xs"
                           >
                             PHÊ DUYỆT
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Senior Health Monitoring */}
                <div className="bg-gray-900 p-8 rounded-[48px] text-white shadow-2xl space-y-8 relative overflow-hidden">
                   <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-pro-green/10 rounded-full blur-3xl" />
                   <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tight">
                       <Heart className="text-primary animate-pulse" /> Sức khoẻ cha mẹ
                    </h3>
                    <Activity className="text-primary" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-2">Điểm sức khoẻ</p>
                        <p className="text-4xl font-black text-pro-green">{elderlyStatus.healthScore}</p>
                     </div>
                     <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-2">Nhịp tim</p>
                        <p className="text-4xl font-black text-primary">{elderlyStatus.heartRate} <span className="text-xs">BPM</span></p>
                     </div>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex items-center gap-4">
                     <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-500">
                        <Star />
                     </div>
                     <div>
                        <p className="text-xs text-gray-400 font-bold uppercase">Tâm trạng hiện tại</p>
                        <p className="text-xl font-bold">{elderlyStatus.mood}</p>
                     </div>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                     <div className="flex justify-between items-center mb-4">
                        <p className="text-sm font-bold uppercase text-gray-400">Dịch vụ đang sử dụng</p>
                        <span className="px-2 py-0.5 bg-pro-green/20 text-pro-green rounded text-[10px] font-black">LIVE</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                           <Navigation className="text-primary w-5 h-5" />
                        </div>
                        <p className="font-bold italic text-pro-green">"{elderlyStatus.activeService}"</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* Message to Parents */}
              <div className="bg-white p-10 rounded-[48px] shadow-sm border-2 border-primary/10">
                <h3 className="text-2xl font-black mb-6 uppercase tracking-tight flex items-center gap-3">
                   <MessageCircle className="text-primary w-8 h-8" /> Gửi lời nhắn tới bố mẹ
                </h3>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    id="parentMessageInput"
                    placeholder="Nhắn nhủ bố mẹ hôm nay..."
                    className="flex-1 bg-gray-50 border-none rounded-[28px] px-8 font-bold text-gray-700 focus:ring-4 focus:ring-primary/5 transition-all outline-none text-lg" 
                  />
                  <button 
                    onClick={async () => {
                      const input = document.getElementById('parentMessageInput') as HTMLInputElement;
                      if (!input.value.trim()) return;
                      try {
                        const remindersRef = collection(db, 'users', auth.currentUser!.uid, 'reminders');
                        await addDoc(remindersRef, {
                          from: userProfile?.name || 'Con cháu',
                          content: input.value,
                          type: 'message',
                          createdAt: serverTimestamp()
                        });
                        showToast('Đã gửi lời nhắn!');
                        input.value = '';
                      } catch (err) {
                        console.error('Send message error:', err);
                      }
                    }}
                    className="bg-primary text-white p-6 rounded-[28px] shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   <p className="text-xs font-bold text-gray-400 italic">Lời nhắn sẽ xuất hiện tức thì trên màn hình chế độ "Người cao tuổi".</p>
                </div>
              </div>

              {/* Master Service Logs */}
              <div className="bg-white p-8 rounded-[48px] shadow-sm border-2 border-gray-100">
                <h3 className="text-2xl font-black mb-8 uppercase tracking-tight flex items-center gap-3">
                   <LayoutDashboard className="text-pro-green" /> Nhật ký quản lý hệ thống
                </h3>
                <div className="space-y-4">
                   {systemLogs.length === 0 ? (
                      <p className="text-center py-10 text-gray-400 font-bold italic">Chưa có nhật ký hoạt động</p>
                   ) : systemLogs.map((log, i) => (
                      <div key={log.id || i} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0">
                         <span className="text-xs font-bold text-gray-400 w-16">{log.time}</span>
                         <div className={`w-2 h-2 rounded-full ${
                           log.type === 'kid' ? 'bg-kids-orange' : 
                           log.type === 'senior' ? 'bg-primary' : 
                           log.type === 'financial' ? 'bg-blue-500' : 
                           'bg-pro-green'
                         }`} />
                         <p className="text-sm font-bold text-gray-700">{log.action}</p>
                      </div>
                   ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-bold">Bảng điều khiển</h2>
              <div className="grid md:grid-cols-4 gap-6">
                {[
                  { label: 'Tổng chuyến', value: '42', icon: <History className="text-blue-500" />, onClick: () => showToast('Đang tải lịch sử chuyến đi...') },
                  { label: 'Đánh giá', value: '4.9/5', icon: <Star className="text-yellow-500" />, onClick: () => showToast('Xem các đánh giá từ Companion') },
                  { label: 'Số dư ví', value: `${walletBalance.toLocaleString()}đ`, icon: <Wallet className="text-pro-green" />, onClick: () => setActiveView('wallet') },
                  { label: 'Hội viên', value: 'Gia đình', icon: <Award className="text-purple-500" />, onClick: () => showSimulation('Hạng hội viên', 'Bạn đang ở hạng Gia đình. Tích lũy thêm 500 điểm để lên hạng Kim Cương!') }
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -5 }}
                    onClick={stat.onClick}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4">{stat.icon}</div>
                    <p className="text-xs text-gray-400 font-bold uppercase">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </motion.div>
                ))}
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold mb-6 uppercase tracking-wider">Thống kê chi tiêu (7 ngày qua)</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendingStats}>
                      <XAxis dataKey="date" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ fontWeight: 'black', color: '#2d6a4f' }}
                      />
                      <Bar dataKey="amount" fill="#2d6a4f" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'reviews' && (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setActiveView('home')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowRight className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-3xl font-black uppercase">Đánh giá từ cộng đồng</h2>
              </div>

              <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                <div className="space-y-8">
                  {reviews.length === 0 ? (
                    <div className="text-center py-20">
                       <Star className="w-16 h-16 text-gray-100 mx-auto mb-6" />
                       <h4 className="text-xl font-black text-gray-300 uppercase">Chưa có đánh giá</h4>
                       <p className="text-gray-400 italic">Hãy giúp đỡ mọi người để nhận được những phản hồi đầu tiên nhé!</p>
                    </div>
                  ) : reviews.map((rev, i) => (
                    <div key={rev.id || i} className="p-8 bg-gray-50 rounded-[32px] border border-gray-100 relative group">
                       <div className="flex items-center gap-4 mb-4">
                          <img src={`https://picsum.photos/seed/${rev.id}/100/100`} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="User" referrerPolicy="no-referrer" />
                          <div>
                             <p className="font-black text-gray-900">{rev.userName || 'Người dùng ẩn danh'}</p>
                             <div className="flex gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-3 h-3 ${i < (rev.rating || 5) ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                                ))}
                             </div>
                          </div>
                       </div>
                       <p className="text-gray-600 font-bold leading-relaxed">"{rev.comment}"</p>
                       <span className="absolute top-8 right-8 text-[10px] font-black text-gray-300 uppercase tracking-widest italic">{rev.date || 'Gần đây'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'appointments' && (
            <motion.div 
              key="appointments"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Lịch hẹn của bạn</h2>
                <button onClick={() => showRandomCompanion('Dịch vụ mới')} className="bg-pro-green text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-pro-green/20">Đặt lịch mới</button>
              </div>
              <div className="space-y-4">
                {appointments.map(appt => (
                  <div key={appt.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <img src={appt.companion.img} className="w-16 h-16 rounded-full object-cover" alt={appt.companion.name} referrerPolicy="no-referrer" />
                      <div>
                        <h4 className="font-bold text-lg">{appt.service}</h4>
                        <p className="text-sm text-gray-500">Companion: {appt.companion.name} • {appt.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col md:items-end w-full md:w-auto">
                      <p className="text-sm font-bold text-gray-900">{appt.time}</p>
                      <p className="text-xs text-gray-400">{appt.location}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase ${
                        appt.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {appt.status === 'active' ? 'Đang diễn ra' : 'Sắp tới'}
                      </span>
                      {appt.status === 'active' && (
                        <button 
                          onClick={() => startTracking(appt)}
                          className="p-2 bg-pro-green/10 text-pro-green rounded-lg hover:bg-pro-green hover:text-white transition-colors"
                        >
                          <Navigation className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'wallet' && (
            <motion.div 
              key="wallet"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-4xl font-black text-gray-900 uppercase">Quản lý tài chính</h2>
                <div className="p-4 bg-pro-green/10 rounded-2xl flex items-center gap-3">
                   <ShieldCheck className="text-pro-green w-5 h-5" />
                   <span className="text-xs font-black text-pro-green uppercase">Bảo mật đa lớp LinkHeart</span>
                </div>
              </div>
              
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="bg-gray-900 text-white p-10 rounded-[48px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                    <p className="text-xs opacity-50 font-bold uppercase tracking-widest mb-2">Số dư LinkHeart Wallet</p>
                    <h3 className="text-5xl font-black mb-8">{(userProfile?.walletBalance || 0).toLocaleString()}đ</h3>
                    <div className="flex justify-between items-end">
                      <div className="text-[10px] opacity-40 font-mono">
                        <p>ID: {auth.currentUser?.uid.slice(0, 8).toUpperCase()}</p>
                        <p>SECURE BY FIREBASE</p>
                      </div>
                      <div className="p-3 bg-white/10 rounded-2xl">
                         <CreditCard className="w-8 h-8 opacity-60" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setModal({ open: true, title: 'Nạp tiền vào ví', type: 'info', content: '' })}
                      className="p-6 bg-pro-green text-white rounded-3xl font-black text-xs uppercase shadow-lg shadow-pro-green/20 hover:bg-green-600 transition-all flex flex-col items-center gap-3"
                    >
                      <PlusCircle className="w-6 h-6" /> Nạp tiền
                    </button>
                    <button 
                      onClick={() => setWithdrawalModal({ open: true, amount: Math.min(walletBalance, 500000), processing: false })}
                      className="p-6 bg-white border-2 border-gray-100 text-gray-900 rounded-3xl font-black text-xs uppercase hover:border-pro-green transition-all flex flex-col items-center gap-3"
                    >
                      <ArrowDownToLine className="w-6 h-6 text-pro-green" /> Rút tiền
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white p-10 rounded-[48px] shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-black uppercase tracking-tight">Lịch sử giao dịch gần đây</h3>
                    <button className="text-xs font-black text-pro-green uppercase hover:underline">Tạm ứng sao kê</button>
                  </div>
                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 no-scrollbar">
                    {transactions.length === 0 ? (
                       <div className="text-center py-20">
                          <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 font-bold italic">Chưa có bản ghi tài chính nào.</p>
                       </div>
                    ) : transactions.map((tx, i) => (
                      <div key={tx.id || i} className="flex justify-between items-center p-4 rounded-3xl hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 group">
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                            tx.type === 'deposit' ? 'bg-green-50 text-green-600' : 
                            tx.type === 'earning' ? 'bg-blue-50 text-blue-600' : 
                            tx.type === 'withdrawal' ? 'bg-purple-50 text-purple-600' : 
                            'bg-red-50 text-red-600'
                          }`}>
                            {tx.type === 'deposit' ? <PlusCircle className="w-6 h-6" /> : 
                             tx.type === 'earning' ? <Heart className="w-6 h-6" /> : 
                             tx.type === 'withdrawal' ? <ArrowDownToLine className="w-6 h-6" /> : 
                             <Activity className="w-6 h-6" />}
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-lg group-hover:text-pro-green transition-colors">{tx.title}</p>
                            <p className="text-xs font-bold text-gray-400 uppercase">
                              {tx.date?.toDate ? tx.date.toDate().toLocaleString('vi-VN', { 
                                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
                              }) : 'Đang đồng bộ...'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className={`text-xl font-black ${
                             (tx.type === 'deposit' || tx.type === 'earning') ? 'text-pro-green' : 'text-red-500'
                           }`}>
                             {(tx.type === 'deposit' || tx.type === 'earning') ? '+' : '-'}{tx.amount.toLocaleString()}đ
                           </p>
                           <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Hoàn tất</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Withdrawal Modal Logic */}
              <AnimatePresence>
                {withdrawalModal.open && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-white w-full max-w-md rounded-[48px] p-10 shadow-2xl space-y-8"
                    >
                       <div className="text-center">
                          <div className="w-16 h-16 bg-pro-green/10 text-pro-green rounded-3xl flex items-center justify-center mx-auto mb-6">
                             <ArrowDownToLine className="w-8 h-8" />
                          </div>
                          <h3 className="text-3xl font-black text-gray-900 uppercase">Rút tiền mặt</h3>
                          <p className="text-sm text-gray-500 font-bold mt-2 italic">Tiền sẽ được gửi về thẻ mặc định của bạn trong 24h.</p>
                       </div>

                       <div className="space-y-4">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-4">Số tiền muốn rút</label>
                          <div className="relative">
                             <input 
                               type="number" 
                               value={withdrawalModal.amount}
                               onChange={(e) => setWithdrawalModal({...withdrawalModal, amount: Number(e.target.value)})}
                               className="w-full bg-gray-50 border-none rounded-3xl p-8 font-black text-4xl text-center text-gray-900 focus:ring-4 focus:ring-pro-green/10 transition-all"
                             />
                             <span className="absolute right-8 top-1/2 -translate-y-1/2 font-black text-gray-300">đ</span>
                          </div>
                          <p className="text-center text-xs font-bold text-gray-400">Số dư hiện tại: <span className="text-pro-green">{(userProfile?.walletBalance || 0).toLocaleString()}đ</span></p>
                       </div>

                       <div className="flex gap-4">
                          <button 
                            onClick={() => setWithdrawalModal({ ...withdrawalModal, open: false })}
                            className="flex-1 py-5 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm uppercase"
                          >
                            Hủy
                          </button>
                          <button 
                             disabled={withdrawalModal.processing || withdrawalModal.amount < 50000 || withdrawalModal.amount > walletBalance}
                             onClick={() => handleWithdrawal(withdrawalModal.amount)}
                             className="flex-1 py-5 bg-pro-green text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-pro-green/20 disabled:grayscale disabled:opacity-50"
                          >
                             {withdrawalModal.processing ? 'Đang xử lý...' : 'Xác nhận rút'}
                          </button>
                       </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeView === 'tracking' && activeAppointment && (
            <motion.div 
              key="tracking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setActiveView('home')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowRight className="w-6 h-6 rotate-180" />
                </button>
                <h2 className="text-3xl font-bold">Theo dõi hành trình</h2>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-4 rounded-[40px] shadow-2xl border-4 border-pro-green/20 relative overflow-hidden h-[500px]">
                    <MapSimulation />
                    <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none">
                      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-gray-100 pointer-events-auto">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Điểm đến</p>
                        <p className="font-bold text-gray-900">{activeAppointment.location}</p>
                      </div>
                      <div className="bg-pro-green text-white p-4 rounded-2xl shadow-xl pointer-events-auto">
                        <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Thời gian còn lại</p>
                        <p className="text-xl font-black">12 PHÚT</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 text-center">
                    <div className="relative inline-block mb-6">
                      <img src={activeAppointment.companion.img} className="w-24 h-24 rounded-full border-4 border-pro-green object-cover" alt="Comp" referrerPolicy="no-referrer" />
                      <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-1">{activeAppointment.companion.name}</h3>
                    <p className="text-sm text-gray-500 mb-8">Đang đồng hành cùng người thân của bạn</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => showSimulation('Đang gọi...', `Đang kết nối cuộc gọi thoại với ${activeAppointment.companion.name}...`, 'info')}
                        className="flex flex-col items-center gap-3 p-6 bg-blue-50 text-blue-600 rounded-3xl hover:bg-blue-100 transition-all group"
                      >
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <Phone className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold uppercase">Gọi điện</span>
                      </button>
                      <button 
                        onClick={() => showSimulation('Nhắn tin', '', 'info', { chat: true })}
                        className="flex flex-col items-center gap-3 p-6 bg-pro-green/5 text-pro-green rounded-3xl hover:bg-pro-green/10 transition-all group"
                      >
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <MessageCircle className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold uppercase">Nhắn tin</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => showSimulation('Video Call', 'Đang khởi tạo cuộc gọi video an toàn...', 'info')}
                      className="w-full mt-4 flex items-center justify-center gap-3 p-6 bg-gray-900 text-white rounded-3xl hover:bg-gray-800 transition-all group"
                    >
                      <Video className="w-6 h-6" />
                      <span className="font-bold uppercase">Video Call Trực Tiếp</span>
                    </button>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
                    <h4 className="font-bold mb-4">Cập nhật mới nhất</h4>
                    <div className="space-y-4">
                      {[
                        { text: 'Đã đến cổng bệnh viện', time: '08:42' },
                        { text: 'Đang làm thủ tục đăng ký', time: '08:45' }
                      ].map((log, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-1.5 h-1.5 bg-pro-green rounded-full mt-1.5" />
                          <p className="text-xs text-gray-600"><span className="font-bold text-gray-900">[{log.time}]</span> {log.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'footer-page' && footerPage && (
            <motion.div 
              key="footer-page"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto py-12"
            >
              <button onClick={() => setActiveView('home')} className="mb-8 flex items-center gap-2 text-pro-green font-bold hover:underline">
                <ArrowRight className="w-4 h-4 rotate-180" /> Quay lại
              </button>
              <h2 className="text-3xl md:text-5xl font-black mb-6 md:mb-8 text-gray-900">{footerPage.title}</h2>
              <div className="prose prose-lg text-gray-600 leading-relaxed space-y-6">
                <p className="text-xl font-medium text-gray-800">{footerPage.content}</p>
                <p>Tại LinkHeart, chúng tôi tin rằng công nghệ chỉ thực sự có giá trị khi nó phục vụ trái tim con người. Mỗi dòng code, mỗi tính năng đều được xây dựng với sự tỉ mỉ và tâm huyết cao nhất để đảm bảo an toàn cho người dùng.</p>
                <div className="grid grid-cols-2 gap-8 mt-12">
                  <img src="https://picsum.photos/seed/about1/400/300" className="rounded-3xl shadow-xl" alt="About 1" referrerPolicy="no-referrer" />
                  <img src="https://picsum.photos/seed/about2/400/300" className="rounded-3xl shadow-xl" alt="About 2" referrerPolicy="no-referrer" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SimulationModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        title={modal.title}
        type={modal.type}
      >
        <div className="space-y-6">
          {modal.data?.chat ? (
            <div className="space-y-4">
              <div className="h-64 bg-gray-50 rounded-2xl p-4 overflow-y-auto space-y-3">
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[80%]">
                    <p className="text-sm">Chào bác, cháu đang đưa bác đi dạo ạ. Bác rất vui vẻ!</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-pro-green text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[80%]">
                    <p className="text-sm">Cảm ơn cháu nhé, hãy để ý bác cẩn thận.</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[80%]">
                    <p className="text-sm">Vâng ạ, bác yên tâm!</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Nhập tin nhắn..." className="flex-1 bg-gray-100 border-none rounded-xl px-4 text-sm focus:ring-2 focus:ring-pro-green" />
                <button className="p-3 bg-pro-green text-white rounded-xl">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : modal.data?.helpDetail ? (
            <HelpDetailCard 
              helpDetail={modal.data.helpDetail} 
              onChat={() => setModal({ ...modal, data: { ...modal.data, chat: true } })}
              onCall={() => showSimulation('Gọi điện', `Đang gọi điện cho ${modal.data.helpDetail.userName} qua số ${modal.data.helpDetail.phoneNumber || '0901 234 567'}...`, 'info')}
            />
          ) : modal.title === 'Nạp tiền vào ví' ? (
            <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm font-black text-gray-700 uppercase tracking-widest">Chọn số tiền nạp nhanh:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => {
                          setModal({ ...modal, type: 'loading', title: 'Đang xử lý' });
                          handlePayment(amt, 'visa');
                        }}
                        className="py-4 bg-gray-50 rounded-2xl text-xs font-black border-2 border-gray-100 hover:border-pro-green hover:text-pro-green transition-all"
                      >
                        +{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative pt-4">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest mb-2">Hoặc nhập số tiền khác:</p>
                    <div className="relative">
                      <input 
                        type="number" 
                        placeholder="Ví dụ: 500000"
                        className="w-full p-5 bg-gray-50 border-4 border-gray-100 rounded-2xl font-black text-2xl focus:border-pro-green outline-none"
                        onChange={(e) => setRechargeState({ ...rechargeState, amount: Number(e.target.value) })}
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-gray-300">đ</div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Thanh toán qua thẻ mặc định</p>
                    <div className="p-4 bg-gray-900 rounded-[24px] flex items-center justify-between text-white border-4 border-white shadow-xl">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                             <CreditCard className="text-primary w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-sm tracking-widest">**** 8888</p>
                            <p className="text-[8px] font-black opacity-40 uppercase tracking-widest">LinkHeart Virtual card</p>
                          </div>
                       </div>
                       <span className="text-[10px] font-black opacity-30 uppercase bg-white/5 px-2 py-1 rounded-md">Visa</span>
                    </div>
                  </div>

                  <button 
                    disabled={!rechargeState.amount || rechargeState.amount <= 0}
                    onClick={() => {
                      setModal({ ...modal, type: 'loading', title: 'Đang xử lý' });
                      handlePayment(rechargeState.amount, 'visa');
                    }}
                    className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl disabled:bg-gray-100 disabled:text-gray-400 active:scale-95 transition-all"
                  >
                    XÁC NHẬN NẠP TIỀN
                  </button>
                </div>
              <div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
                <Shield className="w-5 h-5 text-pro-green" />
                <p className="text-[10px] text-gray-500 leading-tight">Giao dịch được bảo mật bởi LinkHeart. Tiền sẽ được cộng vào ví ngay lập tức.</p>
              </div>
            </div>
          ) : modal.type === 'companion' ? (
            <div className="text-left">
              <CompanionDetail companion={modal.data} mode="pro" userData={userData} onConfirm={async (discount = 0) => {
                const basePrice = 150000;
                const finalPrice = basePrice * (1 - discount);

                if (walletBalance < finalPrice) {
                  showToast('Số dư ví không đủ! Vui lòng nạp thêm.');
                  setActiveView('wallet');
                  setModal({ ...modal, open: false });
                  return;
                }
                const newAppt: Appointment = {
                  id: `LH-${Math.floor(Math.random() * 900) + 100}`,
                  service: modal.data.service || 'Đồng hành',
                  companion: modal.data,
                  status: 'pending',
                  time: 'Hôm nay, 14:00 - 16:00',
                  location: 'Tại nhà'
                };
                setAppointments([...appointments, newAppt]);
                handleUpdateBalance(walletBalance - finalPrice);
                
                if (discount > 0 && auth.currentUser) {
                  try {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    await updateDoc(userRef, { vouchers: (userData?.vouchers || 1) - 1 });
                  } catch (e) {
                    console.error("Error updating vouchers:", e);
                  }
                }

                setModal({ ...modal, open: false });
                showSimulation('Đặt lịch thành công', 'Companion sẽ liên hệ với bạn trong giây lát.', 'success');
                setTimeout(() => startTracking(newAppt), 3000);
              }} />
            </div>
          ) : modal.type === 'loading' ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 border-4 border-pro-green border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Đang xử lý giao dịch...</h3>
              <p className="text-xs font-bold text-gray-400 mt-2">Hệ thống đang kết nối an toàn với ngân hàng</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${modal.type === 'emergency' ? 'bg-red-100 text-red-600' : 'bg-pro-green/10 text-pro-green'}`}>
                {modal.type === 'emergency' ? <Activity className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
              </div>
              <div className="text-gray-600 font-bold">{modal.content || modal.title}</div>
              <button 
                onClick={() => setModal({ ...modal, open: false })}
                className="w-full bg-pro-green text-white py-4 rounded-2xl font-bold uppercase"
              >
                Xác nhận
              </button>
            </div>
          )}
        </div>
      </SimulationModal>

      <Toast message={toast.msg} isVisible={toast.show} onClose={() => setToast({ show: false, msg: '' })} />
      <Footer theme="pro" onToast={renderFooterPage} />
    </div>
  );
};

const ElderlyMode = ({ onBack }: { onBack: () => void }) => {
  const [activeView, setActiveView] = useState<'home' | 'tracking'>('home');
  const [activeCompanion, setActiveCompanion] = useState<Companion | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [healthScore, setHealthScore] = useState(85);
  const [heartRate, setHeartRate] = useState(72);
  const [modal, setModal] = useState<{ open: boolean; title: string; type: 'success' | 'emergency' | 'info' | 'loading' | 'companion'; content?: string; data?: any }>({
    open: false,
    title: '',
    type: 'success'
  });
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [footerPage, setFooterPage] = useState<{ title: string; content: string } | null>(null);

  const [reminders, setReminders] = useState<{ id: string; content: string; from: string; type: string }[]>([]);
  const [memories, setMemories] = useState<{ id: string; url: string; caption: string; author: string }[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const remindersRef = collection(db, 'users', auth.currentUser!.uid, 'reminders');
    const qReminders = query(remindersRef, orderBy('createdAt', 'desc'));
    const unsubscribeReminders = onSnapshot(qReminders, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/reminders`));

    const memoriesRef = collection(db, 'users', auth.currentUser!.uid, 'memories');
    const qMemories = query(memoriesRef, orderBy('createdAt', 'desc'));
    const unsubscribeMemories = onSnapshot(qMemories, (snapshot) => {
      setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/memories`));

    return () => {
      unsubscribeReminders();
      unsubscribeMemories();
    };
  }, []);

  // Sync health status to Firestore for parent monitoring
  useEffect(() => {
    if (!auth.currentUser) return;
    const updateStats = async () => {
      try {
        const statsRef = doc(db, 'users', auth.currentUser!.uid, 'status', 'elderly');
        await setDoc(statsRef, {
          name: auth.currentUser?.displayName || 'Ông/Bà',
          healthScore,
          heartRate,
          mood: healthScore > 80 ? 'Vui vẻ' : 'Bình thường',
          activeService: activeCompanion ? `Đang đồng hành cùng ${activeCompanion.name}` : 'Nghỉ ngơi tại gia',
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser?.uid}/status/elderly`);
      }
    };
    updateStats();
    
    // Simulate slight heartbeat variation
    const interval = setInterval(() => {
      setHeartRate(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 10000);
    return () => clearInterval(interval);
  }, [healthScore, heartRate, activeCompanion]);

  const triggerAction = (title: string, content: string, type: 'success' | 'emergency' | 'info' | 'loading', data?: any) => {
    setModal({ open: true, title, type, content, data });
  };

  const showRandomCompanion = async () => {
    const path = "companions";
    triggerAction('Hệ thống đang tìm kiếm...', '', 'loading');
    try {
      const companionsRef = collection(db, path);
      const snapshot = await getDocs(companionsRef);
      const companionsData = snapshot.docs.map(doc => doc.data() as Companion);
      
      if (companionsData.length === 0) {
        triggerAction('Opps!', 'Hiện chưa có Companion nào đăng ký dịch vụ này.', 'info');
        return;
      }

      const randomComp = companionsData[Math.floor(Math.random() * companionsData.length)];
      setModal({ ...modal, open: false });
      setActiveCompanion(randomComp);
      setActiveView('tracking');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  };

  const triggerSOS = () => {
    triggerAction('KHẨN CẤP (SOS)', 'Đang kết nối với Trung tâm Cứu hộ 113 và đã gửi toạ độ GPS chính xác cho người thân của bác! LinkHeart đang phối hợp đội phản ứng nhanh ngay lập tức.', 'emergency');
  };

  const callAIDoctor = () => {
    triggerAction('Bác sĩ AI đang liên hệ', 'AI đang định vị vị trí của bác và kết nối với bệnh viện gần nhất (BV Vinmec, BV Chợ Rẫy, BV 115). Bác vui lòng cầm máy, bác sĩ sẽ video call trong 30 giây tới.', 'info');
  };

  const handleVoiceAssistant = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      triggerAction('Cháu Linky đây!', 'Cháu đã nhận được yêu cầu của bác. Cháu đang chuẩn bị hỗ trợ bác ngay đây ạ.', 'success');
    }, 2000);
  };

  const renderFooterPage = (title: string, content: string) => {
    setFooterPage({ title, content });
    setActiveView('home'); 
  };

  const handleCreateHelpRequest = async (formData: any) => {
    if (!auth.currentUser) return;
    triggerAction('Đang gửi yêu cầu...', '', 'loading');
    try {
      const mockCoords = { 
        x: Math.floor(Math.random() * 60) + 20, 
        y: Math.floor(Math.random() * 60) + 20 
      };

      const helpRef = collection(db, 'helpRequests');
      await addDoc(helpRef, {
        ...formData,
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Ông/Bà',
        userImg: auth.currentUser.photoURL || 'https://picsum.photos/seed/elder/100/100',
        coords: mockCoords,
        status: 'open',
        createdAt: serverTimestamp()
      });

      setModal({ open: false, title: '', content: '', type: 'info' });
      triggerAction('Gửi thành công!', 'Cháu Linky đã đăng lời nhờ giúp đỡ của bác lên hệ thống. Sẽ có người đến giúp bác sớm thôi ạ!', 'success');
    } catch (err) {
      console.error('Error creating help request:', err);
      triggerAction('Lỗi!', 'Đã có lỗi xảy ra khi gửi yêu cầu. Bác vui lòng thử lại sau nhé.', 'info');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-500 pb-24 ${highContrast ? 'bg-black text-white' : 'bg-amber-50/50'}`}>
      
      <SimulationModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        title={modal.title}
        type={modal.type}
      >
        <div className="text-center p-6 space-y-8">
          {modal.title === 'Đăng yêu cầu giúp đỡ' ? (
            <div className="text-left">
              <CreateHelpForm 
                mode="elderly" 
                onPost={handleCreateHelpRequest} 
                onCancel={() => setModal({...modal, open: false})} 
              />
            </div>
          ) : modal.data?.gallery ? (
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                {memories.length > 0 ? memories.map(m => (
                  <div key={m.id} className="relative group overflow-hidden rounded-2xl shadow-md">
                    <img src={m.url} className="w-full h-48 object-cover hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-black/50 text-white text-xs font-bold">{m.caption}</div>
                  </div>
                )) : [1, 2, 3, 4].map(i => (
                  <img key={i} src={`https://picsum.photos/seed/family${i}/400/300`} className="rounded-2xl border-2 border-gray-100" referrerPolicy="no-referrer" />
                ))}
              </div>
            </div>
          ) : modal.data?.isAI ? (
            <div className="space-y-8">
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto animate-pulse">
                <Bot className="w-14 h-14" />
              </div>
              <div className="text-left bg-white p-8 rounded-[40px] border-4 border-gray-100 shadow-sm max-h-[400px] overflow-y-auto markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                  children={(modal.content as string) || ''}
                />
              </div>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    if ((window as any).triggerLinkyVoice) (window as any).triggerLinkyVoice();
                    setModal({ ...modal, title: 'Linky đang lắng nghe bác...', type: 'loading', content: '', data: { isAI: true } });
                  }}
                  className="w-full bg-primary text-white py-6 rounded-3xl font-bold text-2xl shadow-lg active:scale-95 transition-transform"
                >
                  TIẾP TỤC TRÒ CHUYỆN
                </button>
                <button 
                  onClick={() => {
                    setModal({ ...modal, open: false });
                    window.speechSynthesis.cancel();
                  }}
                  className="w-full py-4 text-gray-400 font-bold text-xl hover:text-gray-600"
                >
                  Dừng tâm sự
                </button>
              </div>
            </div>
          ) : modal.type === 'loading' ? (
            <div className="py-10">
              <Loader2 className="w-20 h-20 animate-spin mx-auto text-primary" />
              <p className="mt-6 text-2xl font-bold text-gray-500">Đang xử lý...</p>
            </div>
          ) : (
            <>
              <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto ${modal.type === 'emergency' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                {modal.type === 'emergency' ? <Activity className="w-16 h-16" /> : <CheckCircle2 className="w-16 h-16" />}
              </div>
              <div className="text-3xl font-extrabold text-gray-900 leading-tight">{modal.content || modal.title}</div>
              <button 
                onClick={() => setModal({ ...modal, open: false })}
                className="w-full bg-primary text-white py-6 rounded-3xl font-bold text-2xl shadow-lg active:scale-95 transition-transform"
              >
                XÁC NHẬN
              </button>
            </>
          )}
        </div>
      </SimulationModal>

      <nav className={`p-4 md:p-8 flex justify-between items-center border-b border-gray-200 sticky top-0 z-50 backdrop-blur-md ${highContrast ? 'bg-black border-white/20' : 'bg-white/80'}`}>
        <div className="flex items-center gap-4 cursor-pointer shrink-0" onClick={() => { setActiveView('home'); setFooterPage(null); }}>
          <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary via-secondary to-accent rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Heart className="text-white w-6 h-6 md:w-8 md:h-8" fill="currentColor" />
          </div>
          <div className="hidden sm:block">
            <span className="text-xl md:text-2xl font-black block leading-none text-gray-900 font-display">LinkHeart</span>
            <span className="text-[10px] md:text-xs font-bold text-colorful uppercase tracking-[0.2em]">CHẾ ĐỘ CAO TUỔI</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <VoiceAssistant 
            mode="elderly" 
            onResponse={async (text) => {
              triggerAction('Linky đang thưa bác...', `"${text}"`, 'loading');
              const res = await (window as any).getLinkyAIResponse(text, "Bạn là Linky - Người cháu/Bảo mẫu AI hiếu thảo, chu đáo của người cao tuổi. Hãy trả lời bác một cách cực kỳ lễ phép, ấm áp và kiên nhẫn. Hãy tâm sự, hỏi han sức khỏe, nhắc nhở niềm vui và lắng nghe những câu chuyện của bác như một người thân thực sự.");
              triggerAction('Linky thưa bác', res, 'success', { isAI: true });
            }} 
          />
          <button 
            onClick={() => setHighContrast(!highContrast)} 
            className={`px-3 py-2 md:px-4 md:py-3 rounded-xl border-2 font-bold text-xs md:text-sm uppercase transition-all ${highContrast ? 'bg-white text-black' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <span className="hidden sm:inline">{highContrast ? 'Màu thường' : 'Tương phản'}</span>
            <span className="sm:hidden">{highContrast ? 'Sáng' : 'Tối'}</span>
          </button>
          <button 
            onClick={onBack} 
            className="px-4 py-2 md:px-6 md:py-3 bg-red-100 text-red-600 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 hover:bg-red-200"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <span className="hidden sm:inline">THOÁT</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full space-y-12">
        <AnimatePresence mode="wait">
          {footerPage ? (
            <motion.div 
               key="footer-page"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="bg-white p-10 rounded-[48px] shadow-xl border border-gray-100"
            >
              <button 
                onClick={() => setFooterPage(null)} 
                className="mb-8 flex items-center gap-2 text-primary font-bold hover:underline py-2"
              >
                <ArrowRight className="w-5 h-5 rotate-180" /> QUAY LẠI TRANG CHỦ
              </button>
              <h2 className="text-3xl md:text-5xl font-black mb-6 md:mb-8 text-gray-900">{footerPage.title}</h2>
              <div className="prose prose-xl max-w-none text-gray-700 font-medium leading-[1.8]">
                 <p className="text-2xl">{footerPage.content}</p>
                 <div className="grid grid-cols-2 gap-6 pt-10">
                    <img src="https://picsum.photos/seed/elderlyA/800/600" className="rounded-3xl shadow-lg border-2 border-white" alt="E1" referrerPolicy="no-referrer" />
                    <img src="https://picsum.photos/seed/elderlyB/800/600" className="rounded-3xl shadow-lg border-2 border-white" alt="E2" referrerPolicy="no-referrer" />
                 </div>
              </div>
            </motion.div>
          ) : activeView === 'home' ? (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-primary text-white p-8 rounded-[40px] shadow-lg flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-10">
                    <Bot className="w-48 h-48" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-normal font-display mb-2 drop-shadow-sm">Chào Bác, buổi sáng <span className="text-white italic font-black">tốt lành!</span></h2>
                    <p className="text-xl font-medium opacity-90 mb-8 italic">"Hôm nay trời nắng đẹp, bác nhớ đi dạo nhé!"</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={handleVoiceAssistant}
                      className={`px-8 py-5 rounded-3xl font-bold text-xl flex items-center gap-4 shadow-2xl transition-all ${isListening ? 'bg-red-500 scale-95' : 'bg-white text-amber-600 hover:scale-105 shadow-amber-200'}`}
                    >
                      <Mic className={isListening ? 'animate-pulse' : ''} />
                      {isListening ? 'CHÁU ĐANG NGHE...' : 'BẤM ĐỂ NÓI VỚI LINKY'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-lg border-2 border-amber-100 flex flex-col items-center justify-center text-center">
                   <div className="relative mb-4">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100"/>
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * healthScore) / 100} className="text-amber-500"/>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-gray-900">{healthScore}</span>
                        <span className="text-[10px] font-black uppercase text-gray-400">ĐIỂM SỨC KHỎE</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 text-green-500 font-bold">
                      <Activity className="w-5 h-5" />
                      <span>NHỊP TIM: 72 BPM</span>
                   </div>
                </div>
              </div>

              {/* New Help Request Section for Elderly */}
              <div className="bg-amber-100/50 p-10 rounded-[48px] border-4 border-dashed border-amber-200 flex flex-col md:flex-row items-center justify-between gap-10">
                 <div className="flex items-center gap-8 text-left">
                    <div className="w-24 h-24 bg-white text-primary rounded-full flex items-center justify-center shadow-xl shrink-0">
                       <PlusCircle className="w-12 h-12" />
                    </div>
                    <div>
                       <h4 className="text-3xl font-black text-gray-900 uppercase">Bác cần giúp đỡ gì không?</h4>
                       <p className="text-lg font-bold text-gray-500 italic mt-2">Cháu Linky sẽ gửi lời nhờ của bác tới cộng đồng LinkHeart ngay ạ!</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setModal({ ...modal, open: true, title: 'Đăng yêu cầu giúp đỡ' })}
                   className="px-12 py-7 bg-primary text-white rounded-3xl font-black uppercase text-xl shadow-2xl hover:scale-[1.05] active:scale-95 transition-all whitespace-nowrap"
                 >
                    GỬI LỜI NHỜ GIÚP
                 </button>
              </div>

              <div className="mb-20">
                <div className="bg-blue-600/10 p-8 rounded-[40px] border-4 border-dashed border-blue-600/20 mb-8 flex items-center gap-6">
                   <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex items-center justify-center shadow-xl shrink-0">
                      <Stethoscope className="w-10 h-10" />
                   </div>
                   <div>
                      <h4 className="text-xl font-black text-blue-800 uppercase">Lịch Kiểm tra sức khỏe quan trọng</h4>
                      <p className="text-gray-700 font-bold">Nhân viên LinkHeart sẽ thực hiện kiểm tra các chỉ số sinh tồn của bác vào trước <span className="text-blue-600 font-black">07:00 AM</span> và <span className="text-blue-600 font-black">06:00 PM</span> hàng ngày.</p>
                   </div>
                </div>
                <StaffSection 
                  onSelectStaff={(s) => triggerAction('Nhân viên LinkHeart', `Bạn đã chọn ${s.name} để chăm sóc cha mẹ. Nhân viên đã bắt đầu lịch trình làm việc!`, 'success')} 
                  showSimulation={triggerAction}
                  mode="elderly" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <button 
                   onClick={callAIDoctor}
                   className="p-8 bg-blue-50 hover:bg-blue-100 rounded-[32px] flex flex-col items-center gap-4 transition-all shadow-md group"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 group-hover:scale-110 transition-transform">
                    <Stethoscope size={40} />
                  </div>
                  <span className="text-xl font-bold uppercase tracking-wide text-blue-900">Gọi Bác Sĩ</span>
                </button>

                <button 
                  onClick={showRandomCompanion}
                  className="p-8 bg-green-50 hover:bg-green-100 rounded-[32px] flex flex-col items-center gap-4 transition-all shadow-md group"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm border border-green-100 group-hover:scale-110 transition-transform">
                    <Navigation size={40} />
                  </div>
                  <span className="text-xl font-bold uppercase tracking-wide text-green-900">Tìm người đi dạo</span>
                </button>

                <button 
                  onClick={() => triggerAction('Gia đình số', 'Đang kết nối những hình ảnh kỷ niệm của gia đình...', 'info', { gallery: true })}
                  className="p-8 bg-purple-50 hover:bg-purple-100 rounded-[32px] flex flex-col items-center gap-4 transition-all shadow-md group"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-sm border border-purple-100 group-hover:scale-110 transition-transform">
                    <Users size={40} />
                  </div>
                  <span className="text-xl font-bold uppercase tracking-wide text-purple-900">Xem ảnh kỷ niệm</span>
                </button>

                <button 
                  onClick={triggerSOS}
                  className="p-8 bg-red-50 hover:bg-red-600 group rounded-[32px] flex flex-col items-center gap-4 transition-all shadow-md border-2 border-red-200"
                >
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-red-600 shadow-inner group-hover:scale-110 transition-transform">
                    <Shield size={40} className="animate-pulse" />
                  </div>
                  <span className="text-xl font-black uppercase tracking-wide text-red-600 group-hover:text-white">SOS KHẨN CẤP</span>
                </button>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                 <div className="bg-white p-8 rounded-[40px] shadow-lg border border-gray-100 overflow-hidden group">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                         <Star className="text-yellow-500" fill="currentColor" /> Ảnh gia đình mới
                      </h3>
                      <button onClick={() => triggerAction('Kỷ niệm', '', 'info', { gallery: true })} className="text-primary font-bold text-sm">Xem tất cả</button>
                    </div>
                    <div className="w-full h-64 rounded-3xl overflow-hidden relative shadow-inner">
                        <img 
                          src={memories[0]?.url || "https://picsum.photos/seed/happyfamily/800/600"} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" 
                          alt="Memory" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                          <p className="text-white font-bold text-lg text-center">{memories[0]?.caption || "Bữa cơm gia đình ấm cúng"}</p>
                        </div>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-[40px] shadow-lg border border-gray-100">
                    <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                       <Clock className="text-orange-500" /> Tin nhắn của con cháu
                    </h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                       {reminders.length > 0 ? reminders.map(r => (
                         <div key={r.id} className="p-6 bg-orange-50 rounded-3xl border-2 border-orange-100">
                            <div className="flex justify-between items-center mb-1">
                               <p className="font-black text-orange-600 uppercase text-xs">{r.from}:</p>
                            </div>
                            <p className="text-xl font-bold text-gray-800">"{r.content}"</p>
                         </div>
                       )) : (
                         <div className="p-10 text-center border-4 border-dashed border-gray-100 rounded-[40px]">
                            <p className="text-gray-400 font-bold italic">Chưa có lời nhắn nào hôm nay, bác ạ!</p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="bg-white p-10 rounded-[48px] shadow-sm border border-gray-100 mt-8">
                 <StaffSection showSimulation={triggerAction} onSelectStaff={(staff) => {
                   triggerAction('Thông tin nhân viên', `Bạn đang tương tác với ${staff.name}. Nhân viên đang: ${staff.status}.`, 'info', { staff });
                 }} />
              </div>
            </motion.div>
          ) : activeView === 'tracking' && activeCompanion ? (
            <motion.div key="tracking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="flex items-center gap-6">
                 <button onClick={() => setActiveView('home')} className="p-5 bg-white rounded-full shadow-md hover:scale-110 transition-transform active:scale-95 border border-gray-100">
                    <ArrowLeft className="w-8 h-8 text-primary" />
                 </button>
                 <h2 className="text-4xl font-black tracking-tight text-gray-900 uppercase">Bác đang đi cùng cháu {activeCompanion.name}</h2>
               </div>
               
               <div className="grid lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 h-[550px] rounded-[48px] overflow-hidden relative shadow-2xl border-4 border-white">
                    <MapSimulation />
                    <div className="absolute top-6 left-6 p-6 bg-white/95 backdrop-blur rounded-3xl border border-gray-100 shadow-xl max-w-sm">
                       <div className="flex items-center gap-4">
                          <img src={activeCompanion.img} className="w-20 h-20 rounded-2xl shadow-lg object-cover" alt="Comp" referrerPolicy="no-referrer" />
                          <div className="flex-1">
                             <p className="text-2xl font-black text-gray-900">{activeCompanion.name}</p>
                             <p className="text-sm font-bold text-gray-500 mb-4 italic">Sẵn sàng nghe bác hỗ trợ</p>
                             <div className="flex gap-2">
                               <button onClick={() => triggerAction('Gọi cho cháu', `Đang kết nối...`, 'info')} className="flex-1 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-md active:scale-95">
                                 <Phone className="w-5 h-5" /> GỌI
                               </button>
                               <button onClick={() => triggerAction('Nhắn tin', '', 'info', { chat: true })} className="flex-1 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-md active:scale-95">
                                 <MessageCircle className="w-5 h-5" /> CHAT
                               </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-[48px] shadow-xl border border-gray-100">
                    <h3 className="text-2xl font-black mb-8 border-b-2 border-gray-50 pb-4 uppercase tracking-tight">Hành trình</h3>
                    <div className="space-y-8 relative">
                       {[
                         { time: '08:45', text: 'Bắt đầu ra khỏi nhà', status: 'done' },
                         { time: '09:30', text: 'Đang nghỉ ngơi ngắm cảnh', status: 'current' },
                         { time: '10:00', text: 'Dự kiến về nhà', status: 'pending' }
                       ].map((step, i) => (
                         <div key={i} className="flex gap-6 items-start relative last:pb-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md z-10 ${step.status === 'done' ? 'bg-green-500' : step.status === 'current' ? 'bg-primary' : 'bg-gray-200'}`}>
                               {step.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                            </div>
                            <div className="pt-1">
                               <p className={`text-xl font-bold ${step.status === 'current' ? 'text-gray-900' : 'text-gray-500'}`}>{step.text}</p>
                               <p className="text-sm font-bold text-gray-400">Thời gian: {step.time}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {activeView === 'home' && (
          <motion.button 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.8 }}
            onClick={triggerSOS}
            className="fixed bottom-44 right-8 w-24 h-24 bg-red-600 text-white rounded-full border-4 border-white shadow-2xl flex items-center justify-center font-black text-2xl z-[60] animate-pulse"
          >
            SOS
          </motion.button>
        )}
      </AnimatePresence>

      <SimulationModal 
        isOpen={modal.open} 
        onClose={() => setModal({ ...modal, open: false })} 
        title={modal.title}
        type={modal.type}
      >
        {modal.data?.chat ? <ChatSimulation onBack={() => setModal({ ...modal, open: false })} /> : (
          modal.data?.handbook ? (
            <div className="space-y-6">
              {modal.data.handbook.map((h: any, i: number) => (
                <div key={i} className="p-6 bg-gray-50 rounded-3xl border-4 border-gray-200">
                  <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">{h.title}</h4>
                  <p className="text-lg font-bold text-gray-600">{h.content}</p>
                </div>
              ))}
            </div>
          ) : modal.content || <p className="text-3xl font-black text-gray-900">Tính năng này đang được hỗ trợ.</p>
        )}
      </SimulationModal>

      <Toast message={toast.msg} isVisible={toast.show} onClose={() => setToast({ show: false, msg: '' })} />
      <Footer theme="elderly" onToast={renderFooterPage} />
    </div>
  );
};

// --- Pricing Component ---
const Pricing = ({ onBack, onSelectPlan, trialDaysLeft, activePlanId, userData, isEmbedded = false }: { 
  onBack: () => void; 
  onSelectPlan: (plan: Plan) => void; 
  trialDaysLeft: number | null, 
  activePlanId?: string;
  userData?: any;
  isEmbedded?: boolean;
}) => {
  const plans: Plan[] = [
    {
      id: "linkheart_voucher",
      name: "Linkheart Voucher",
      price: "Miễn phí*",
      rawPrice: 0,
      period: "/t1 đầu (sau 29k)",
      features: ["20 Voucher giảm giá mỗi tháng", "Giảm 10% - 20% mỗi lần thanh toán", "Ví Voucher thanh toán tiện lợi", "Ưu đãi thanh toán hộ người khác"],
      color: "border-colorful bg-white",
      button: "Đăng ký Voucher"
    },
    {
      id: "linkheart_basic",
      name: "Linkheart Basic",
      price: "3.0M",
      rawPrice: 3000000,
      period: "/tháng",
      features: ["Linky AI cơ bản", "Nhân viên 1h/ngày (cố định)", "Chăm sóc cơ bản (Nhắc lịch, check-in)", "Không cố định 1 người nhân viên"],
      color: "border-gray-100",
      button: "Chọn gói Basic"
    },
    {
      id: "linkheart_standard",
      name: "Linkheart Standard ⭐",
      price: "6.0M",
      rawPrice: 6000000,
      period: "/tháng",
      features: ["Linky AI Pro", "Nhân viên 2–3h/ngày", "Ưu tiên 1–2 nhân viên quen", "Chăm sóc chủ động + báo cáo"],
      color: "border-pro-green/50 bg-pro-green/5",
      button: "Chọn gói Standard",
      highlight: true
    },
    {
      id: "linkheart_premium",
      name: "Linkheart Premium",
      price: "15.0M",
      rawPrice: 15000000,
      period: "/tháng",
      features: ["Linky AI Pro+", "Nhân viên 4–6h/ngày", "Nhân viên phụ trách chính", "Chăm sóc sâu + báo cáo chi tiết"],
      color: "border-primary/50 bg-primary/5",
      button: "Chọn gói Premium"
    },
    {
      id: "linkheart_premium_ultra",
      name: "Linkheart Premium Ultra",
      price: "35.0M",
      rawPrice: 35000000,
      period: "/tháng",
      features: ["Linky AI No-limit", "Nhân viên linh hoạt cả ngày", "Team riêng (không chỉ 1 người)", "Quản lý toàn diện + Ưu tiên tuyệt đối"],
      color: "border-gray-900 bg-gray-50",
      button: "Chọn gói Ultra"
    },
    {
      id: "linkheart_hr",
      name: "Booking Linkheart HR",
      price: "500k/giờ",
      rawPrice: 500000,
      period: "/giờ",
      features: ["Thuê nhân viên theo giờ", "Tùy chọn số lượng nhân viên", "Linh hoạt thời gian", "Làm việc theo yêu cầu"],
      color: "border-colorful bg-white",
      button: "Thuê nhân viên"
    }
  ];

  // Identifiy active plan
  const pricingPlans = plans.map(p => {
    const hasDiscount = userData?.voucherSubscriptionActive && p.id !== 'linkheart_voucher';
    const displayPrice = hasDiscount 
      ? (p.rawPrice * 0.8 / 1000000).toFixed(1) + "M"
      : p.price;

    return {
      ...p,
      displayPrice,
      hasDiscount,
      isCurrent: activePlanId === p.id,
      button: activePlanId === p.id ? "Đang sử dụng" : p.button
    };
  });

  return (
    <div className={`${isEmbedded ? 'min-h-0 bg-transparent py-12' : 'min-h-screen bg-cream py-24'} p-6 flex flex-col items-center relative overflow-hidden`}>
      {!isEmbedded && <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48" />}
      {!isEmbedded && (
        <button 
          onClick={onBack}
          className="absolute top-12 left-12 p-4 bg-white rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95 z-20"
        >
          <ArrowLeft className="w-8 h-8 text-gray-900" />
        </button>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 relative z-10"
      >
        <h2 className={`${isEmbedded ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl'} font-normal mb-4 font-display text-gray-900 uppercase`}>Gói <span className="text-colorful font-black font-sans">Dịch Vụ</span></h2>
        <p className="text-sm md:text-lg text-gray-500 font-bold uppercase tracking-widest">Nâng cấp trải nghiệm kết nối gia đình</p>
      </motion.div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl w-full relative z-10 p-4">
        {pricingPlans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-10 rounded-[48px] border-4 flex flex-col ${plan.color} shadow-xl relative overflow-hidden bg-white`}
          >
            {plan.highlight && (
              <div className="absolute top-0 right-0 bg-primary text-white px-6 py-2 rounded-bl-3xl font-black text-xs uppercase tracking-widest">
                Phổ biến
              </div>
            )}
            <h3 className={`text-xl md:text-2xl font-black mb-2 ${plan.isCurrent ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
            <div className="mb-6 md:mb-8 flex items-baseline gap-2 flex-wrap">
              <span className={`text-4xl md:text-5xl font-black ${plan.isCurrent ? 'text-primary' : 'text-gray-900'}`}>
                {plan.displayPrice}
              </span>
              {plan.hasDiscount && (
                <span className="text-sm font-bold text-gray-400 line-through">
                  {plan.price}
                </span>
              )}
              <span className={`text-xs md:text-sm font-bold ml-1 ${plan.isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
            </div>
            
            <ul className="space-y-4 mb-10 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-3">
                  <CheckCircle2 className={`w-5 h-5 ${plan.isCurrent ? 'text-primary' : 'text-green-500'}`} />
                  <span className={`font-bold ${plan.isCurrent ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                </li>
              ))}
            </ul>

            <button 
              onClick={() => !plan.isCurrent && onSelectPlan(plan)}
              className={`w-full py-5 rounded-3xl font-black text-xl transition-all active:scale-95 ${
              plan.isCurrent ? 'bg-white/20 text-white cursor-default' : plan.highlight ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
            }`}>
              {plan.button}
            </button>
          </motion.div>
        ))}
      </div>

      <div className="mt-16 p-8 bg-gray-50 rounded-[40px] border-4 border-dashed border-gray-200 text-center max-w-2xl mx-auto relative z-10">
         <p className="font-bold text-gray-500">
            Cần hỗ trợ nhiều hơn? Bạn có thể yêu cầu nhân viên trung tâm hỗ trợ bổ sung cho các công việc phát sinh.
         </p>
         <p className="text-xl font-black text-gray-900 mt-2">
            Giá ưu đãi: <span className="text-colorful">500.000đ - 1.000.000đ / giờ</span>
         </p>
      </div>

      <div className="mt-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest relative z-10">
        * Linkheart Voucher miễn phí tháng đầu tiên áp dụng cho đăng ký mới.
      </div>
    </div>
  );
};

// --- Payment Component ---
// --- PIN Lock ---
const PinLock = ({ 
  userData, 
  onUnlock, 
  onSetPin 
}: { 
  userData: any; 
  onUnlock: () => void; 
  onSetPin: (pin: string) => void 
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (userData?.lockoutUntil) {
      const updateTime = () => {
        const rawExpiry = userData.lockoutUntil;
        let expiry = 0;
        if (rawExpiry) {
          if (typeof rawExpiry.toDate === 'function') {
            expiry = rawExpiry.toDate().getTime();
          } else if (typeof rawExpiry === 'number' || typeof rawExpiry === 'string') {
            expiry = new Date(rawExpiry).getTime();
          } else if (rawExpiry instanceof Date) {
            expiry = rawExpiry.getTime();
          }
        }
        const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setTimeLeft(diff);
      };
      updateTime();
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [userData?.lockoutUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (timeLeft > 0) return;
    setError('');

    if (!userData?.pin) {
      if (pin.length < 4 || pin.length > 6) {
        setError('Mã PIN phải từ 4-6 chữ số');
        return;
      }
      onSetPin(pin);
      return;
    }

    if (pin === userData.pin) {
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      await updateDoc(userRef, { failedAttempts: 0, lockoutUntil: null });
      onUnlock();
    } else {
      const newAttempts = (userData.failedAttempts || 0) + 1;
      const userRef = doc(db, 'users', auth.currentUser!.uid);
      
      if (newAttempts >= 5) {
        await updateDoc(userRef, {
          failedAttempts: 0,
          lockoutUntil: new Date(Date.now() + 5 * 60 * 1000)
        });
        setError('Bạn đã nhập sai quá 5 lần. Hệ thống đã khóa 5 phút.');
      } else {
        await updateDoc(userRef, { failedAttempts: newAttempts });
        setError(`Mã PIN sai. Còn ${5 - newAttempts} lần thử.`);
      }
      setPin('');
    }
  };

  const isSetup = !userData?.pin;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-amber-50 rounded-[48px] shadow-2xl p-10 text-center border-[12px] border-white"
      >
        <div className={`w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-lg ${timeLeft > 0 ? 'bg-red-50 text-red-500' : 'bg-gradient-to-br from-pro-green to-secondary text-white'}`}>
          {timeLeft > 0 ? <Clock className="w-10 h-10 animate-pulse" /> : <Lock className="w-10 h-10" />}
        </div>

        <h2 className="text-4xl font-normal font-display text-gray-900 mb-2 uppercase tracking-tight">
          {isSetup ? 'Thiết lập mã' : 'Xác thực'} <span className="text-colorful font-black italic font-sans">PIN</span>
        </h2>
        <p className="text-gray-500 font-bold mb-8">
          {isSetup ? 'Hãy đặt mã PIN để bảo vệ quyền quản trị gia đình của bạn.' : 'Nhập mã PIN để truy cập vào Chế độ Pro.'}
        </p>

        {timeLeft > 0 ? (
          <div className="space-y-4">
            <p className="text-red-500 font-black text-lg md:text-xl">Hệ thống đang khóa</p>
            <div className="text-4xl md:text-5xl font-black text-gray-900 py-2 md:py-4 tabular-nums">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase">Sau khi hết thời gian, bạn có thể thử lại.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3">
              <input 
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPin(val);
                }}
                placeholder={isSetup ? "Ví dụ: 1234" : "****"}
                className="w-full text-center text-5xl font-black tracking-[0.2em] py-8 px-4 bg-white border-4 border-amber-200 rounded-[32px] focus:border-pro-green outline-none transition-all placeholder:text-amber-100 placeholder:tracking-normal text-amber-900 font-sans shadow-inner"
                autoFocus
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 font-bold text-sm bg-red-50 py-2 px-4 rounded-xl">
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={pin.length < 4}
              className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white py-6 rounded-[32px] font-black text-xl uppercase tracking-widest shadow-2xl hover:shadow-gray-900/20 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
            >
              {isSetup ? 'XÁC NHẬN MÃ PIN' : 'MỞ KHÓA NGAY'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

const PaymentPage = ({ onBack, plan, user, userData, walletBalance, onSuccess, onTopUp }: { 
  onBack: () => void; 
  plan: Plan; 
  user: FirebaseUser;
  userData?: any;
  walletBalance: number;
  onSuccess: (finalBalance: number, planId: string) => void;
  onTopUp: () => void;
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extraHours, setExtraHours] = useState(plan.id === 'linkheart_hr' ? 1 : 0);
  const [staffCount, setStaffCount] = useState(plan.id === 'linkheart_hr' ? 1 : 0);

  const isHRBooking = plan.id === 'linkheart_hr';
  const hasVoucherDiscount = userData?.voucherSubscriptionActive && plan.id !== 'linkheart_voucher' && !isHRBooking;
  const discountRate = hasVoucherDiscount ? 0.2 : 0;
  
  const basePlanPrice = isHRBooking ? 0 : plan.rawPrice * (1 - discountRate);
  const staffRate = 500000;
  
  // For HR booking, price is staffCount * hours * rate
  // For other plans, it is plan price + extra hours * rate
  const calculatedStaffCost = isHRBooking 
    ? (staffCount * extraHours * staffRate)
    : (extraHours * staffRate);
    
  const totalPrice = basePlanPrice + calculatedStaffCost;

  const isInsufficient = walletBalance < totalPrice;

  const handlePay = () => {
    setIsProcessing(true);
    setTimeout(() => {
      onSuccess(walletBalance - totalPrice, plan.id);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-cream p-6 py-24 flex flex-col items-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -mr-48 -mt-48" />
      <button 
        onClick={onBack}
        className="absolute top-12 left-12 p-4 bg-white rounded-full shadow-xl hover:scale-110 transition-transform active:scale-95 z-20"
      >
        <ArrowLeft className="w-8 h-8 text-gray-900" />
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl bg-white rounded-[48px] shadow-2xl border-8 border-white p-8 md:p-16 flex flex-col md:flex-row gap-12 items-start"
      >
        <div className="flex-1 space-y-8 w-full">
          <div>
            <div className="inline-block px-4 py-1 bg-primary/10 text-primary text-xs font-black rounded-full mb-4 uppercase">
              Thanh Toán Đăng Ký
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight">Xác nhận <br /> thanh toán</h2>
          </div>

          <div className="p-8 bg-gray-50 rounded-[32px] border-2 border-gray-100 space-y-6">
             <div className="flex justify-between items-center text-sm font-black text-gray-400 uppercase tracking-widest">
                <span>Chi tiết thanh toán</span>
                <span>Giá tiền</span>
             </div>
             
             {/* Main Plan / Selection */}
             <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-xl font-black text-gray-900">{plan.name}</h4>
                  {hasVoucherDiscount && (
                    <span className="text-[10px] font-black text-colorful uppercase bg-colorful/10 px-2 py-0.5 rounded-full">
                      Voucher -20% Active
                    </span>
                  )}
                  {isHRBooking && (
                    <span className="text-[10px] font-black text-blue-500 uppercase bg-blue-50 px-2 py-0.5 rounded-full">
                      Dịch vụ theo giờ
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {!isHRBooking && (
                    <>
                      <p className={`text-xl font-black ${hasVoucherDiscount ? 'text-colorful' : 'text-gray-900'}`}>
                        {basePlanPrice.toLocaleString()}đ
                      </p>
                      {hasVoucherDiscount && (
                        <p className="text-xs font-bold text-gray-400 line-through">
                          {plan.rawPrice.toLocaleString()}đ
                        </p>
                      )}
                    </>
                  )}
                  {isHRBooking && (
                    <p className="text-xl font-black text-gray-900 italic">Tính theo lượng nhân sự</p>
                  )}
                </div>
             </div>

             {/* Booking Factors (Hours/Staff) */}
             {plan.id !== 'linkheart_voucher' && (
               <div className="pt-4 border-t border-gray-200 space-y-6">
                  {/* Hours Selection */}
                  <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-2 border-gray-100 shadow-sm">
                     <div>
                        <p className="text-sm font-black text-gray-900 uppercase">Thanh toán theo giờ</p>
                        <p className="text-[10px] font-bold text-gray-400 italic">
                          {isHRBooking ? "Chọn số giờ thuê nhân viên" : "Yêu cầu thêm nhân viên làm thêm giờ"}
                        </p>
                     </div>
                     <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border-2 border-gray-200">
                        <button 
                          onClick={() => setExtraHours(Math.max(isHRBooking ? 1 : 0, extraHours - 1))}
                          className="w-10 h-10 rounded-xl bg-white text-gray-900 flex items-center justify-center font-black shadow-sm"
                        >
                          -
                        </button>
                        <span className="font-black w-6 text-center text-lg">{extraHours}h</span>
                        <button 
                          onClick={() => setExtraHours(extraHours + 1)}
                          className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black shadow-sm"
                        >
                          +
                        </button>
                     </div>
                  </div>

                  {/* Staff Selection (For HR Booking only) */}
                  {isHRBooking && (
                    <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-2 border-gray-100 shadow-sm">
                       <div>
                          <p className="text-sm font-black text-gray-900 uppercase">Số lượng nhân viên</p>
                          <p className="text-[10px] font-bold text-gray-400 italic">Tùy chọn nhân sự thực hiện</p>
                       </div>
                       <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border-2 border-gray-200">
                          <button 
                            onClick={() => setStaffCount(Math.max(1, staffCount - 1))}
                            className="w-10 h-10 rounded-xl bg-white text-gray-900 flex items-center justify-center font-black shadow-sm"
                          >
                            -
                          </button>
                          <span className="font-black w-6 text-center text-lg">{staffCount}</span>
                          <button 
                            onClick={() => setStaffCount(staffCount + 1)}
                            className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-black shadow-sm"
                          >
                            +
                          </button>
                       </div>
                    </div>
                  )}

                  {/* Pricing Breakdown */}
                  <div className="pt-2">
                    {isHRBooking ? (
                       <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-gray-500 italic">Chi phí: {staffCount} NV x {extraHours}h x 500k</p>
                          <p className="text-xl font-black text-gray-900">{calculatedStaffCost.toLocaleString()}đ</p>
                       </div>
                    ) : extraHours > 0 && (
                       <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-gray-500">Phí nhân viên bổ sung:</p>
                          <p className="text-lg font-black text-gray-900">+{calculatedStaffCost.toLocaleString()}đ</p>
                       </div>
                    )}
                  </div>
               </div>
             )}

             <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                   <p className="text-sm font-bold text-gray-500">Tổng cộng:</p>
                   <p className="text-3xl font-black text-primary">{totalPrice.toLocaleString()}đ</p>
                </div>
                <div className="flex justify-between items-center mb-4">
                   <p className="text-sm font-bold text-gray-500 italic">Số dư hiện tại:</p>
                   <p className="text-lg font-black text-gray-400">{walletBalance.toLocaleString()}đ</p>
                </div>
                {isInsufficient ? (
                  <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-4 mt-4">
                     <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                        <Zap className="w-5 h-5" />
                     </div>
                     <p className="text-sm font-bold text-red-600">Số dư không đủ! Bạn cần nạp thêm ít nhất {(totalPrice - walletBalance).toLocaleString()}đ.</p>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border-2 border-green-100 rounded-2xl flex items-center gap-4 mt-4">
                     <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-green-200">
                        <CheckCircle2 className="w-5 h-5" />
                     </div>
                     <p className="text-sm font-bold text-green-600">Số dư khả dụng để thanh toán.</p>
                  </div>
                )}
             </div>
          </div>

          <div className="flex flex-col gap-4">
             {isInsufficient ? (
               <button 
                onClick={onTopUp}
                className="w-full py-6 bg-gray-900 text-white font-black text-2xl rounded-[32px] shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-4"
               >
                 <Wallet className="w-8 h-8 text-primary" /> NẠP TIỀN NGAY
               </button>
             ) : (
               <button 
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full py-6 bg-primary text-white font-black text-2xl rounded-[32px] shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-4 disabled:opacity-50"
               >
                 {isProcessing ? (
                   <> <Loader2 className="w-8 h-8 animate-spin" /> ĐANG XỬ LÝ... </>
                 ) : (
                   <> <ShieldCheck className="w-8 h-8" /> THANH TOÁN NGAY </>
                 )}
               </button>
             )}
             <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest">Giao dịch được bảo mật bởi LinkHeart Financial</p>
          </div>
        </div>

        <div className="w-full md:w-80 space-y-6">
          <div className="p-8 bg-gray-900 rounded-[40px] text-white space-y-6 relative overflow-hidden shadow-2xl">
             <div className="relative z-10">
               <h5 className="font-black text-primary text-xs uppercase tracking-widest mb-4">Quyền lợi của bạn</h5>
               <ul className="space-y-4">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                       <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                       <span className="text-xs font-bold text-gray-300 leading-tight">{f}</span>
                    </li>
                  ))}
               </ul>
             </div>
             <div className="absolute -bottom-10 -right-10 opacity-10">
                <Heart className="w-40 h-40 text-white" />
             </div>
          </div>

          <div className="p-8 bg-cream border-4 border-dashed border-primary/20 rounded-[40px] text-center space-y-4">
             <p className="text-xs font-black text-primary uppercase tracking-widest">Hỗ trợ kỹ thuật</p>
             <p className="text-sm font-bold text-gray-500">Gặp khó khăn khi thanh toán? Liên hệ ngay:</p>
             <p className="text-xl font-black text-gray-900 tracking-tighter">1900 8888</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Error Handling ---
// Using Imported types and functions from firebase.ts

// --- Seed Helpers ---
const seedCompanionsIfNeeded = async () => {
  const path = "companions";
  try {
    const companionsRef = collection(db, path);
    // Use getDocsFromServer to verify connection and permissions cleanly
    const snapshot = await getDocs(companionsRef);
    if (snapshot.empty) {
      console.log("Seeding companions to database...");
      for (const c of COMPANIONS) {
        await setDoc(doc(db, path, c.id), {
          ...c,
          createdAt: serverTimestamp()
        });
      }
      console.log("Seeding complete!");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      // Logic check: if snapshot.empty fails, it is a LIST error. If setDoc fails, it is a WRITE error.
      // For simplicity in seeding, we'll just report it as a seed error.
      console.warn("Seeding skipped due to permissions. This is normal if you are not an admin.");
    } else {
      console.error("Seeding Error:", error);
    }
  }
};

// --- Main App ---
export default function App() {
  const [userType, setUserType] = useState<UserType>('portal');
  const [isLoading, setIsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(2450000);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [initialProView, setInitialProView] = useState<ProView>('home');
  
  // Auth states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isProUnlocked, setIsProUnlocked] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  // Trial states
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [isTrialChecking, setIsTrialChecking] = useState(false);
  const [kidRequests, setKidRequests] = useState<KidRequest[]>([]);
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [globalToast, setGlobalToast] = useState({ show: false, msg: '' });

  const showToast = (msg: string) => {
    setGlobalToast({ show: true, msg });
    setTimeout(() => setGlobalToast({ show: false, msg: '' }), 4000);
  };

  // Sync User Data (Wallet, etc)
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!data.cards || data.cards.length === 0) {
          updateDoc(userDocRef, {
            cards: [{ id: 'default', last4: '8888', type: 'visa', bank: 'LinkHeart Virtual Bank' }]
          });
        }
        setUserData(data);
        if (data.walletBalance !== undefined) {
          setWalletBalance(data.walletBalance);
        }
      } else {
        // Initialize user doc if first time
        setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          walletBalance: 2450000,
          cards: [{ id: 'default', last4: '8888', type: 'visa', bank: 'LinkHeart Virtual Bank' }],
          failedAttempts: 0,
          lockoutUntil: null,
          createdAt: serverTimestamp()
        });
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  // Sync Kid Requests
  useEffect(() => {
    if (!user) return;
    const reqsRef = collection(db, 'users', user.uid, 'requests');
    const q = query(reqsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const reqs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setKidRequests(reqs);
      
      // Check for new pending requests to show notification
      const latest = reqs[0];
      if (latest && latest.status === 'pending' && latest.createdAt) {
        // Only notify if it's very recent (last 30 seconds) to avoid notification spam on reload
        const now = Date.now();
        const createdStr = latest.createdAt;
        let created = 0;
        if (createdStr) {
          if (typeof createdStr.toDate === 'function') {
            created = createdStr.toDate().getTime();
          } else if (typeof createdStr === 'number') {
            created = createdStr;
          } else {
            const d = new Date(createdStr);
            created = isNaN(d.getTime()) ? 0 : d.getTime();
          }
        }

        if (now - created < 30000) {
          setLastNotification(`Yêu cầu mới từ ${latest.kidName}: ${latest.item}`);
          setTimeout(() => setLastNotification(null), 8000);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/requests`));
    return () => unsubscribe();
  }, [user]);
  
  const addKidRequest = async (request: Omit<KidRequest, 'id' | 'status'>) => {
    if (!user) return;
    const path = `users/${user.uid}/requests`;
    try {
      await addDoc(collection(db, path), {
        ...request,
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };
  
  useEffect(() => {
    if (!authLoading && user) {
      seedCompanionsIfNeeded();
    }
  }, [user, authLoading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    
    // Safety net: if Firebase doesn't respond in 8 seconds, 
    // stop loading so the user can at least see the UI (might be an offline/config issue)
    const timer = setTimeout(() => {
      setAuthLoading(prev => {
        if (prev) {
          console.warn("Firebase Auth timed out, forcing load state.");
          return false;
        }
        return prev;
      });
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setTrialDaysLeft(null);
      setIsTrialExpired(false);
      return;
    }

    const checkTrial = async () => {
      setIsTrialChecking(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          // createdAt is a Timestamp in Firestore
          const rawCreatedAt = data.createdAt;
          let createdAtDate = null;
          if (rawCreatedAt) {
            if (typeof rawCreatedAt.toDate === 'function') {
              createdAtDate = rawCreatedAt.toDate();
            } else if (typeof rawCreatedAt === 'number' || typeof rawCreatedAt === 'string') {
              createdAtDate = new Date(rawCreatedAt);
            } else if (rawCreatedAt instanceof Date) {
              createdAtDate = rawCreatedAt;
            }
          }
          
          if (createdAtDate && !isNaN(createdAtDate.getTime())) {
            const nowTime = Date.now();
            const diffInMs = nowTime - createdAtDate.getTime();
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            const remaining = Math.max(0, 15 - diffInDays);
            
            setTrialDaysLeft(remaining);
            if (remaining === 0) {
              setIsTrialExpired(true);
            }
          } else {
            // If no createdAt, we assume it's just created now
            setTrialDaysLeft(15);
          }
        }
      } catch (err) {
        console.error('Check trial error:', err);
      } finally {
        setIsTrialChecking(false);
      }
    };

    checkTrial();
  }, [user]);

  const handleSelect = (type: UserType, proView: ProView = 'home') => {
    setIsLoading(true);
    setInitialProView(proView);
    setTimeout(() => {
      setUserType(type);
      setIsLoading(false);
    }, 1000);
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setUserType('portal');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.body.className = userType === 'elderly' ? 'theme-elderly' : userType === 'kids' ? 'theme-kids' : '';
  }, [userType]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-16 h-16 border-8 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If not logged in, show Landing or Auth
  if (!user) {
    return (
      <AnimatePresence mode="wait">
        {!showAuth ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LandingPage onGetStarted={() => setShowAuth(true)} />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <Auth onBack={() => setShowAuth(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (isTrialExpired) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xl bg-white rounded-[48px] shadow-2xl border-8 border-white p-12 text-center"
        >
          <div className="w-24 h-24 bg-red-100 rounded-[28px] flex items-center justify-center text-red-500 shadow-xl mx-auto mb-8 transform -rotate-3">
            <Clock className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black mb-6 leading-tight">Hết hạn dùng thử!</h2>
          <p className="text-xl text-gray-500 font-bold mb-10 leading-relaxed">
            Khoảng thời gian 15 ngày trải nghiệm miễn phí của bạn đã kết thúc. <br />
            Để tiếp tục sử dụng trọn bộ tính năng của LinkHeart, vui lòng nâng cấp tài khoản của bạn.
          </p>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.href = 'https://linkheart.vn/upgrading'} 
              className="w-full py-6 bg-primary text-white font-black text-2xl rounded-3xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
            >
              ĐĂNG KÝ NGAY
            </button>
            <button 
              onClick={handleLogout}
              className="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleUpdateBalance = async (newBalance: number) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { walletBalance: newBalance });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleSetPin = async (p: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { pin: p, failedAttempts: 0, lockoutUntil: null });
      setIsProUnlocked(true);
      showToast('Đã thiết lập mã PIN thành công!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <div className="min-h-screen relative">
      <AnimatePresence>
        {(isLoading || isTrialChecking) && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center"
          >
            <div className="w-20 h-20 border-8 border-primary/20 border-t-primary rounded-full animate-spin mb-6" />
            <p className="text-2xl font-bold text-primary animate-pulse">
              {isTrialChecking ? 'Đang kiểm tra quyền truy cập...' : 'Đang tải giao diện thích ứng...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast 
        message={globalToast.msg} 
        isVisible={globalToast.show} 
        onClose={() => setGlobalToast({ show: false, msg: '' })} 
      />

      {/* Auth Info & Logout Float - Only show on Portal/Pricing pages to avoid overlap in Modes */}
      {(userType === 'portal' || userType === 'pricing' || userType === 'payment') && (
        <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[100] flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4">
           {trialDaysLeft !== null && !userData?.activePlanId && (
             <div className={`px-4 py-2 rounded-full border-2 font-black text-[10px] md:text-xs shadow-lg hidden md:block ${trialDaysLeft <= 3 ? 'bg-red-50 border-red-200 text-red-500' : 'bg-green-50 border-green-200 text-green-500'}`}>
                DÙNG THỬ: {trialDaysLeft} NGÀY CÒN LẠI
             </div>
           )}
           {userData?.activePlanId && (
             <div className="px-4 py-2 bg-gray-900 border-2 border-gray-800 text-white rounded-full font-black text-[10px] md:text-xs shadow-lg hidden md:block">
                GÓI: {userData.activePlanId.replace(/_/g, ' ').toUpperCase()}
             </div>
           )}
           <div className="bg-white/80 backdrop-blur p-2 pr-4 md:pr-6 rounded-full shadow-xl border-4 border-white flex items-center gap-2 md:gap-3">
              <img src={user.photoURL || `https://picsum.photos/seed/${user.uid}/40/40`} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-primary shadow-sm" alt="User" referrerPolicy="no-referrer" />
              <div>
                <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase leading-none mb-1">Thành viên</p>
                <p className="text-xs md:text-sm font-black text-gray-900 leading-none truncate max-w-[80px] md:max-w-[120px]">{user.displayName || user.email?.split('@')[0]}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="ml-2 md:ml-4 p-2 md:p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
           </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {userType === 'portal' && (
          <motion.div 
            key="portal" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Portal onSelect={handleSelect} />
          </motion.div>
        )}
        {userType === 'payment' && selectedPlan && user && (
          <motion.div 
            key="payment" 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -100, opacity: 0 }}
          >
            <PaymentPage 
              onBack={() => handleSelect('pro', 'plans')} 
              plan={selectedPlan}
              user={user}
              userData={userData}
              walletBalance={walletBalance}
              onSuccess={async (finalBalance, planId) => {
                await handleUpdateBalance(finalBalance);
                const updates: any = { activePlanId: planId };
                if (planId === 'linkheart_voucher') {
                  updates.voucherSubscriptionActive = true;
                  updates.vouchers = (userData?.vouchers || 0) + 20;
                }
                await updateDoc(doc(db, 'users', user.uid), updates);
                showToast(planId === 'linkheart_voucher' ? 'Đã nhận 20 Voucher vào ví!' : 'Đăng ký gói thành công!');
                handleSelect('portal');
              }}
              onTopUp={() => handleSelect('pro', 'wallet')}
            />
          </motion.div>
        )}
        {userType === 'kids' && (
          <motion.div 
            key="kids" 
            initial={{ x: 100, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: -100, opacity: 0 }}
          >
            <KidsMode onBack={() => handleSelect('portal')} onAddRequest={addKidRequest} />
          </motion.div>
        )}
        {userType === 'pro' && (
          <motion.div 
            key="pro" 
            initial={{ x: 100, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: -100, opacity: 0 }}
          >
                   {!isProUnlocked ? (
               <PinLock 
                 userData={userData} 
                 onUnlock={() => setIsProUnlocked(true)} 
                 onSetPin={handleSetPin} 
               />
             ) : (
              <ProMode 
                onBack={() => handleSelect('portal')} 
                walletBalance={walletBalance}
                handleUpdateBalance={handleUpdateBalance}
                kidRequests={kidRequests}
                setKidRequests={setKidRequests}
                trialDaysLeft={trialDaysLeft}
                userData={userData}
                onSelectPlan={(plan) => {
                  setSelectedPlan(plan);
                  handleSelect('payment');
                }}
                initialView={initialProView}
              />
            )}
          </motion.div>
        )}
        {userType === 'elderly' && (
          <motion.div 
            key="elderly" 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            exit={{ scale: 1.2, opacity: 0 }}
          >
            <ElderlyMode onBack={() => handleSelect('portal')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Parent Notification */}
      <AnimatePresence>
        {lastNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] bg-white border-4 border-kids-orange p-6 rounded-[32px] shadow-2xl flex items-center gap-6 cursor-pointer hover:scale-105 transition-transform"
            onClick={() => {
              setUserType('pro');
              setLastNotification(null);
            }}
          >
             <div className="w-16 h-16 bg-kids-orange text-white rounded-full flex items-center justify-center animate-bounce">
                <Bot className="w-8 h-8" />
             </div>
             <div>
                <p className="text-xs font-black text-kids-orange uppercase tracking-widest leading-none mb-1">Cảnh báo hệ thống</p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{lastNotification}</p>
                <p className="text-xs font-bold text-gray-400 mt-1 italic">Vui lòng quay lại trung tâm quản lý để xử lý!</p>
             </div>
             <ArrowRight className="text-kids-orange w-6 h-6" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistence LinkyAI Assistant */}
      <LinkyAI user={user} />
      <LinkyActionPopup />
    </div>
  );
}
