import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isOfflineFirebaseError,
  OperationType,
} from '../firebase';
import {
  MemorizationTestResult,
  QuranBookmark,
  ReciterId,
} from '../types';

export interface CloudUserState {
  lastReadSurah: number;
  lastReadAyah: number;
  lastReadPage: number;
  khatmaCompletedPagesCount: number;
  preferredReciter: ReciterId;
  preferredAdhan: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  authError: string | null;
  cloudState: CloudUserState | null;
  cloudBookmarks: QuranBookmark[];
  cloudTestResults: MemorizationTestResult[];
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  syncReadingPosition: (surah: number, ayah: number, page: number) => Promise<void>;
  syncPreferences: (
    khatmaCount: number,
    reciter: ReciterId,
    adhanId: string,
  ) => Promise<void>;
  pushTestResultToCloud: (
    res: MemorizationTestResult,
    ayahNumber: number,
  ) => Promise<void>;
  pushBookmarkToCloud: (bm: QuranBookmark) => Promise<void>;
  deleteBookmarkFromCloud: (bookmarkId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function clampInt(val: number, min: number, max: number): number {
  const n = Math.round(Number(val) || min);
  return Math.max(min, Math.min(max, n));
}

export const FirebaseProvider: React.FC<{
  children: React.ReactNode;
  initialReciter: ReciterId;
  initialAdhan: string;
  initialKhatmaCount: number;
}> = ({children, initialReciter, initialAdhan, initialKhatmaCount}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudState, setCloudState] = useState<CloudUserState | null>(null);
  const [cloudBookmarks, setCloudBookmarks] = useState<QuranBookmark[]>([]);
  const [cloudTestResults, setCloudTestResults] = useState<
    MemorizationTestResult[]
  >([]);
  const parentReadyRef = useRef<string | null>(null);

  const prefsRef = useRef({
    initialReciter,
    initialAdhan,
    initialKhatmaCount,
  });
  prefsRef.current = {initialReciter, initialAdhan, initialKhatmaCount};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        parentReadyRef.current = null;
        setCloudState(null);
        setCloudBookmarks([]);
        setCloudTestResults([]);
      }
    });
    return () => unsub();
  }, []);

  const ensureParentUserDoc = useCallback(async (u: User): Promise<void> => {
    if (
      !u.emailVerified ||
      parentReadyRef.current === u.uid ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      return;
    }
    const userPath = `users/${u.uid}`;
    const userDocRef = doc(db, 'users', u.uid);
    try {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const displayName =
          (u.displayName || u.email?.split('@')[0] || 'مسلم')
            .trim()
            .slice(0, 120) || 'مسلم';
        await setDoc(userDocRef, {
          uid: u.uid,
          displayName,
          lastReadSurah: 1,
          lastReadAyah: 1,
          lastReadPage: 1,
          khatmaCompletedPagesCount: clampInt(
            prefsRef.current.initialKhatmaCount,
            0,
            604,
          ),
          preferredReciter: prefsRef.current.initialReciter.slice(0, 40),
          preferredAdhan: prefsRef.current.initialAdhan.slice(0, 64),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      parentReadyRef.current = u.uid;
    } catch (err) {
      if (!isOfflineFirebaseError(err)) {
        handleFirestoreError(err, OperationType.WRITE, userPath);
      }
    }
  }, []);

  // Only attach real-time listeners once auth is ready & user email is verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    let unsubUser: (() => void) | undefined;
    let unsubBookmarks: (() => void) | undefined;
    let unsubTests: (() => void) | undefined;
    let cancelled = false;

    void ensureParentUserDoc(user)
      .catch(() => {})
      .then(() => {
        if (cancelled) return;

      const userPath = `users/${user.uid}`;
      unsubUser = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setCloudState({
              lastReadSurah: clampInt(d.lastReadSurah, 1, 114),
              lastReadAyah: clampInt(d.lastReadAyah, 1, 286),
              lastReadPage: clampInt(d.lastReadPage, 1, 604),
              khatmaCompletedPagesCount: clampInt(
                d.khatmaCompletedPagesCount,
                0,
                604,
              ),
              preferredReciter: (d.preferredReciter || 'alafasy') as ReciterId,
              preferredAdhan: String(d.preferredAdhan || 'adhan-makkah'),
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, userPath);
        },
      );

      const bmPath = `users/${user.uid}/bookmarks`;
      const bmQuery = query(
        collection(db, 'users', user.uid, 'bookmarks'),
        where('uid', '==', user.uid),
        limit(50),
      );
      unsubBookmarks = onSnapshot(
        bmQuery,
        (snap) => {
          const list: QuranBookmark[] = snap.docs
            .map((d) => {
              const v = d.data();
              return {
                id: d.id,
                page: clampInt(v.page, 1, 604),
                surahNumber: clampInt(v.surahNumber, 1, 114),
                surahName: String(v.surahName || ''),
                ayahNumber: clampInt(v.ayahNumber, 1, 286),
                snippet: String(v.snippet || ''),
                createdAt:
                  v.createdAt && typeof v.createdAt.toMillis === 'function'
                    ? v.createdAt.toMillis()
                    : 0,
              };
            })
            .sort((a, b) => b.createdAt - a.createdAt);
          setCloudBookmarks(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, bmPath);
        },
      );

      const testPath = `users/${user.uid}/testResults`;
      const testQuery = query(
        collection(db, 'users', user.uid, 'testResults'),
        where('uid', '==', user.uid),
        limit(30),
      );
      unsubTests = onSnapshot(
        testQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => {
              const v = d.data();
              const ms =
                v.createdAt && typeof v.createdAt.toMillis === 'function'
                  ? (v.createdAt.toMillis() as number)
                  : 0;
              return {
                ms,
                item: {
                  id: d.id,
                  surahNumber: clampInt(v.surahNumber, 1, 114),
                  surahName: String(v.surahName || ''),
                  page: 1,
                  score: clampInt(v.score, 0, 100),
                  totalWords: 0,
                  mistakesCount: Math.max(0, Number(v.mistakesCount) || 0),
                  hintsUsed: 0,
                  date:
                    v.createdAt && typeof v.createdAt.toDate === 'function'
                      ? v.createdAt.toDate().toLocaleDateString('ar-EG')
                      : new Date().toLocaleDateString('ar-EG'),
                } satisfies MemorizationTestResult,
              };
            })
            .sort((a, b) => b.ms - a.ms)
            .map((x) => x.item);
          setCloudTestResults(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, testPath);
        },
      );
    });

    return () => {
      cancelled = true;
      unsubUser?.();
      unsubBookmarks?.();
      unsubTests?.();
    };
  }, [authReady, user, ensureParentUserDoc]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuthError(
        'أنت تعمل حاليًا بالوضع الأوفلاين — تسجيل الدخول السحابي يتطلب إنترنت، بينما جميع بياناتك محفوظة محليًا على الجهاز.',
      );
      return;
    }
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setAuthError(
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'أنت تعمل حاليًا بالوضع الأوفلاين — تسجيل الدخول السحابي يتطلب إنترنت، بينما جميع بياناتك محفوظة محليًا على الجهاز.'
          : 'تعذر تسجيل الدخول — تأكد من السماح بالنوافذ المنبثقة والاتصال بالإنترنت.',
      );
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch {
      setAuthError('تعذر تسجيل الخروج حاليًا');
    }
  }, []);

  const syncReadingPosition = useCallback(
    async (surah: number, ayah: number, page: number) => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified || !navigator.onLine) return;
      await ensureParentUserDoc(current);
      const userPath = `users/${current.uid}`;
      try {
        await updateDoc(doc(db, 'users', current.uid), {
          lastReadSurah: clampInt(surah, 1, 114),
          lastReadAyah: clampInt(ayah, 1, 286),
          lastReadPage: clampInt(page, 1, 604),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [ensureParentUserDoc],
  );

  const syncPreferences = useCallback(
    async (khatmaCount: number, reciter: ReciterId, adhanId: string) => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified || !navigator.onLine) return;
      await ensureParentUserDoc(current);
      const userPath = `users/${current.uid}`;
      try {
        await updateDoc(doc(db, 'users', current.uid), {
          khatmaCompletedPagesCount: clampInt(khatmaCount, 0, 604),
          preferredReciter: (reciter || 'alafasy').slice(0, 40),
          preferredAdhan: (adhanId || 'adhan-makkah').slice(0, 64),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }
    },
    [ensureParentUserDoc],
  );

  const pushTestResultToCloud = useCallback(
    async (res: MemorizationTestResult, ayahNumber: number) => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified || !navigator.onLine) return;
      await ensureParentUserDoc(current);
      const docId = sanitizeId(res.id || `test_${Date.now()}`);
      const targetPath = `users/${current.uid}/testResults/${docId}`;
      try {
        await setDoc(doc(db, 'users', current.uid, 'testResults', docId), {
          uid: current.uid,
          surahNumber: clampInt(res.surahNumber, 1, 114),
          surahName: (res.surahName || 'سورة الفاتحة').slice(0, 80),
          ayahNumber: clampInt(ayahNumber, 1, 286),
          score: clampInt(res.score, 0, 100),
          mistakesCount: Math.max(0, Math.min(5000, Math.round(res.mistakesCount))),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, targetPath);
      }
    },
    [ensureParentUserDoc],
  );

  const pushBookmarkToCloud = useCallback(
    async (bm: QuranBookmark) => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified || !navigator.onLine) return;
      await ensureParentUserDoc(current);
      const docId = sanitizeId(bm.id || `bm_${bm.page}_${Date.now()}`);
      const targetPath = `users/${current.uid}/bookmarks/${docId}`;
      try {
        await setDoc(doc(db, 'users', current.uid, 'bookmarks', docId), {
          uid: current.uid,
          page: clampInt(bm.page, 1, 604),
          surahNumber: clampInt(bm.surahNumber, 1, 114),
          surahName: (bm.surahName || 'القرآن الكريم').slice(0, 80),
          ayahNumber: clampInt(bm.ayahNumber, 1, 286),
          snippet: (bm.snippet || 'آية كريمة').slice(0, 200),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, targetPath);
      }
    },
    [ensureParentUserDoc],
  );

  const deleteBookmarkFromCloud = useCallback(async (bookmarkId: string) => {
    const current = auth.currentUser;
    if (!current || !current.emailVerified || !navigator.onLine) return;
    const docId = sanitizeId(bookmarkId);
    const targetPath = `users/${current.uid}/bookmarks/${docId}`;
    try {
      await deleteDoc(doc(db, 'users', current.uid, 'bookmarks', docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, targetPath);
    }
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        signingIn,
        authError,
        cloudState,
        cloudBookmarks,
        cloudTestResults,
        signInWithGoogle,
        signOutUser,
        syncReadingPosition,
        syncPreferences,
        pushTestResultToCloud,
        pushBookmarkToCloud,
        deleteBookmarkFromCloud,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
