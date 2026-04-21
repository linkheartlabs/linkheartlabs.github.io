import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Mail, Lock, User, Github, Chrome, AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  updateProfile,
  signOut
} from 'firebase/auth';
import { auth, googleProvider, db, handleFirestoreError } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface AuthProps {
  onBack: () => void;
}

const Auth: React.FC<AuthProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (err: any) => {
    console.error('Detailed Auth Error:', err);
    if (err.code === 'auth/network-request-failed') {
      setError('Lỗi kết nối mạng hoặc bị chặn bởi trình duyệt. Nếu bạn đang dùng bản xem trước, hãy thử mở ứng dụng trong Tab mới (biểu tượng mũi tên gốc phải).');
    } else if (err.message) {
      setError(`Lỗi: ${err.message}`);
    } else {
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const syncUserProfile = async (user: { uid: string; email: string | null; displayName: string | null; photoURL?: string | null }) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef).catch(e => handleFirestoreError(e, 'get', `users/${user.uid}`));
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Người dùng LinkHeart',
          photoURL: user.photoURL || '',
          preferredMode: 'default',
          createdAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, 'create', `users/${user.uid}`));
      }
    } catch (err: any) {
      console.error('Sync Profile Error:', err);
      setError(err.message || 'Lỗi đồng bộ hồ sơ');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL
      });
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[140px] -ml-80 -mb-80" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[160px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[48px] shadow-2xl border-[12px] border-white p-8 md:p-12 relative z-10"
      >
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 p-3 bg-amber-50 hover:bg-amber-100 rounded-2xl transition-colors text-amber-600 shadow-sm group"
        >
          <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="text-center mb-10 pt-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary via-secondary to-accent rounded-[24px] flex items-center justify-center text-white shadow-xl mx-auto mb-6 transform hover:rotate-12 transition-transform">
            <Heart className="w-12 h-12 fill-current" />
          </div>
          <h1 className="text-4xl font-normal font-display tracking-tight mb-2 text-gray-900">
            Chào mừng <span className="text-colorful font-black font-sans">bạn!</span>
          </h1>
          <p className="text-gray-500 font-bold">
            Đăng nhập nhanh chóng và an toàn để tiếp tục kết nối.
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </motion.div>
        )}

        <div className="space-y-4">
          <button 
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 py-6 px-6 bg-white border-4 border-amber-100 hover:border-primary hover:bg-amber-50 rounded-3xl transition-all font-black text-xl text-amber-900 shadow-xl shadow-amber-900/5 active:scale-[0.98] disabled:opacity-50 group/btn"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <>
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover/btn:scale-110 transition-transform">
                  <Chrome className="w-6 h-6 text-red-500" />
                </div>
                Tiếp tục với Google
              </>
            )}
          </button>
        </div>

        <p className="mt-10 text-center text-xs font-bold text-gray-400 leading-relaxed px-4">
          Bằng cách đăng nhập, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của LinkHeart.
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
