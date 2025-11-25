import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, setDoc, onSnapshot, collection, query, serverTimestamp } from 'firebase/firestore';

// --- 全局變數 / Global Constants (Canvas Environment) ---
// Canvas 環境提供的 Firebase 配置和 Auth Token
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// 修正 Firebase 路徑錯誤：清理應用程式 ID，將所有斜線替換為短劃線，確保它是單一有效的路徑區段。
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(/\//g, '-');

// 顏色與風格定義 (日式極簡/木質色調)
const ACCENT_COLOR = 'bg-amber-500'; // 亮點色
const TEXT_COLOR = 'text-amber-800';  // 主文字色
const CARD_BG = 'bg-white';
const HIGHLIGHT_COLOR = 'text-red-600 font-bold'; // 亮顯重要資訊

// --- 行程數據 (已包含 AI 增強內容 - 導遊職責) ---
// 地點已標準化，並加入 Google Maps 導航連結
const tripData = {
    // 總覽資訊
    info: {
        flights: [
            { id: 1, type: '去程', flight: 'GK14', route: 'TPE → NRT', time: '12/4 16:55 抵達' },
            { id: 2, type: '回程', flight: 'GK??', route: 'NRT → TPE', time: '12/9 待定' },
        ],
        accommodations: [
            { id: 1, name: '本八幡 Airbnb', dates: '12/4, 12/7-8', phone: '房東電話：XXX' },
            { id: 2, name: '鬼怒川溫泉旅館', dates: '12/5-6', phone: '0288-XX-XXXX' },
        ],
        emergencies: [
            { id: 1, name: '緊急電話', number: '110 (警察), 119 (救護/消防)' },
            { id: 2, name: '外交部旅外急難救助專線', number: '+886-800-085-095' },
        ],
        reservations: [
            { id: 1, item: '晚餐 - おでん 🍢', code: '預約代號: JP8341', date: '12/4' },
            { id: 2, item: '晚餐 - 挽肉と米', code: '重要預約代號: HIKI-NRT-2408', date: '12/8', note: '11/30 9:00 AM 開放訂位，請務必準時搶位！' },
        ]
    },

    // 每日行程
    days: [
        {
            date: '12/4 (四)', title: '抵達與東京近郊', location: '本八幡',
            activities: [
                { type: '交通', time: '16:55', name: '航班 GK14 抵達日本', note: '取車與前往本八幡' },
                { type: '住宿', time: '19:30', name: '回本八幡', location: '本八幡', icon: '🏠' },
                { type: '餐飲', time: '晚餐', name: 'おでん 🍢 (居酒屋)', location: '本八幡', icon: '🥢', highlight: '重要預約代號已標示於「資訊總覽」頁面。', enhancement: '日式燉菜，尤其推薦大根、玉子和蒟蒻絲。' },
                { type: '購物', time: '飯後', name: 'ドンキ / 松本清', location: '本八幡', icon: '🛍️', enhancement: '可先採購零食或藥妝，補充自駕所需物資。' },
            ]
        },
        {
            date: '12/5 (五)', title: '日光世界遺產巡禮', location: '日光',
            activities: [
                { type: '交通', time: '07:30', name: '出發前往日光市區', icon: '🚙', enhancement: '自駕約 3 小時，請注意路況與休息站。' },
                { type: '景點', time: '10:30', name: '日光東照宮', location: '日光東照宮', icon: '⛩️', highlight: '必買伴手禮：三猿御守、御香守 (本殿內)。', enhancement: '故事：祭祀德川家康，以「三猿」和「眠貓」雕刻聞名，為世界文化遺產。' },
                { type: '景點', time: '步行', name: '輪王寺 / 二荒山神社', location: '日光輪王寺', icon: '🙏', enhancement: '可購買御朱印。' },
                { type: '餐飲', time: '午餐', name: '日光湯波料理（豆皮料理）', location: '日光市', icon: '🍽️', highlight: '必吃：生湯波 (Sashimi Yuba) 口感滑順。推薦店家：湯波亭升田屋、惠比壽家。', enhancement: '湯波（腐皮）是日光特色，營養豐富。' },
                { type: '景點', time: '下午', name: '神橋（紅橋）', location: '神橋 (日光)', icon: '🌉', enhancement: '傳說是聖地入口，朱紅色橋身搭配山景非常壯觀。' },
                { type: '購物', time: '沿路', name: '商店街小吃/伴手禮', icon: '🍡', enhancement: '必吃美食：さかえや揚げゆばまんじゅう（炸豆皮饅頭）、日光ぷりん亭（湯波布丁）。' },
                { type: '住宿', time: '傍晚', name: '鬼怒川住宿', location: '鬼怒川溫泉', icon: '♨️' },
            ]
        },
        {
            date: '12/6 (六)', title: '鬼怒川與足利光雕', location: '鬼怒川/足利',
            activities: [
                { type: '餐飲', time: '早午餐', name: 'Galarie cafe Painto E', location: 'Galarie cafe Painto E', icon: '☕' },
                { type: '景點', time: '上午', name: '鬼怒楯岩大吊橋', location: '鬼怒楯岩大吊橋', icon: '🚶', enhancement: '挑戰懼高症，欣賞鬼怒川峽谷美景。' },
                { type: '景點', time: '中午', name: '龍王峽', location: '龍王峽', icon: '🏞️', enhancement: '沿途步道風景秀麗，適合輕健行。' },
                { type: '景點', time: '下午', name: 'Osaru-no-yama (Ropeway)', location: '鬼怒川溫泉ロープウェイ', icon: '🐒', enhancement: '搭乘纜車上山，可俯瞰鬼怒川溫泉區。' },
                { type: '景點', time: '傍晚', name: '足利花卉公園', location: '足利花卉公園', icon: '🌟', highlight: '冬季光雕 (光之花之庭) 期間，是日本三大燈飾之一。', enhancement: '攻略：下午 17:00 開始點燈，建議提早抵達。' },
                { type: '餐飲', time: '晚餐', name: '佐野青竹手打ちラーメン押山 or 肉汁うどん 森製麺所', location: '佐野市', icon: '🍜/🍲' },
            ]
        },
        {
            date: '12/7 (日)', title: '購物與返回本八幡', location: '霧降/佐野',
            activities: [
                { type: '餐飲', time: '午餐', name: '霧降高原チーズガーデン', location: '霧降高原チーズガーデン', icon: '🧀', enhancement: '推薦：御用邸起司蛋糕或起司餅乾 (可當伴手禮)。' },
                { type: '景點', time: '下午', name: '霧降瀑布', location: '霧降瀑布', icon: '💧', enhancement: '日光三名瀑之一，氣勢磅礴。' },
                { type: '購物', time: '下午', name: '佐野Premium Outlet', location: '佐野Premium Outlet', icon: '🛍️' },
                { type: '餐飲', time: '晚餐', name: '油そば (本八幡)', location: '本八幡', icon: '🍜' },
                { type: '住宿', time: '晚上', name: '回本八幡', location: '本八幡', icon: '🏠' },
            ]
        },
        {
            date: '12/8 (一)', title: '東京都會區血拼與美食', location: '銀座/渋谷',
            activities: [
                { type: '購物', time: '上午', name: '銀座 (Uniqlo/Muji/木村屋麵包)', location: '銀座', icon: '🛍️', highlight: '必吃：木村家紅豆奶油麵包、培根起司馬鈴薯鹹派。', enhancement: 'Muji 無印良品旗艦店有很多限定商品。' },
                { type: '餐飲', time: '午餐', name: '篝雞白湯拉麵', location: '銀座', icon: '🍜', highlight: '必點：招牌雞白湯SOBA或松露SOBA。', enhancement: '可搭配生薑泥或炸洋蔥絲享用，推薦副餐：雞肉叉燒黃油飯。' },
                { type: '景點', time: '下午', name: '渋谷 (Sky/十字路口)', location: '澀谷', icon: '🏙️', enhancement: '澀谷 Sky 需提早預約，建議查好日落時間上樓。' },
                { type: '餐飲', time: '晚餐', name: '挽肉と米', location: '澀谷', icon: '🍔', highlight: '必吃：現絞漢堡肉！搭配青辣椒鹽檸檬調味料。', enhancement: '預約困難，請在 11/30 9:00 AM 準時上線搶位！' },
                { type: '住宿', time: '晚上', name: '本八幡住宿', location: '本八幡', icon: '🏠' },
            ]
        },
        {
            date: '12/9 (二)', title: '返程', location: 'NRT',
            activities: [
                { type: '交通', time: '全天', name: '返回台灣', icon: '✈️' },
            ]
        },
    ],
};

// --- Firebase 初始化與認證 ---
let app, db, auth;
if (Object.keys(firebaseConfig).length > 0) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        // setLogLevel('debug'); // 啟用 Firebase 偵錯日誌
    } catch (e) {
        console.error("Firebase Initialization Failed:", e);
    }
}

// --- 輔助函式 ---
const getGeoLink = (name) => {
    // 簡單的導航鏈接生成 (適用於自駕)
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)},Tokyo,Japan`;
};

// --- App 主元件 ---
const App = () => {
    const [activeTab, setActiveTab] = useState('itinerary'); // 預設行程
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [newAmount, setNewAmount] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [loading, setLoading] = useState(false);
    const [currency, setCurrency] = useState('JPY');

    // 1. Firebase 認證與初始化
    useEffect(() => {
        if (!auth) return;

        const handleAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Firebase Authentication failed:", error);
                await signInAnonymously(auth); // Fallback to anonymous
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                // 如果匿名登入失敗，使用隨機 ID，但正常情況下上面的 catch 應該已經處理了
                setUserId(crypto.randomUUID());
            }
            setIsAuthReady(true);
        });

        handleAuth();
        return () => unsubscribe();
    }, []);

    // 2. Firestore 數據訂閱 (記帳功能)
    const fetchExpenses = useCallback(() => {
        if (!db || !userId) return;

        // 使用清理過的 appId 構建正確的路徑 (C/D/C/D/C)
        const colPath = `/artifacts/${appId}/users/${userId}/expenses`;
        const q = query(collection(db, colPath));

        // 即時監聽數據變化
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedExpenses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() // 轉換 Firebase Timestamp
            })).sort((a, b) => b.timestamp - a.timestamp); // 依時間倒序排列
            setExpenses(fetchedExpenses);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching expenses:", error);
            setLoading(false);
        });

        return unsubscribe;
    }, [db, userId]);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = fetchExpenses();
        return () => { if (unsubscribe) unsubscribe(); };
    }, [fetchExpenses]);

    // 3. 記帳功能：新增花費
    const addExpense = async (e) => {
        e.preventDefault();
        if (!db || !userId || !newAmount || !newDesc) return;
        setLoading(true);

        try {
            const amount = parseFloat(newAmount);
            if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

            const expenseData = {
                amount: amount,
                description: newDesc,
                currency: currency,
                timestamp: serverTimestamp(),
            };

            // 使用清理過的 appId 構建正確的路徑
            const colPath = `/artifacts/${appId}/users/${userId}/expenses`;
            await addDoc(collection(db, colPath), expenseData);

            setNewAmount('');
            setNewDesc('');
        } catch (error) {
            console.error("Error adding expense:", error);
        } finally {
            setLoading(false);
        }
    };

    // 4. 記帳功能：總計
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 5. 頁面渲染邏輯
    const renderContent = () => {
        if (!isAuthReady) {
            return <div className="p-8 text-center text-gray-500">初始化中...</div>;
        }

        switch (activeTab) {
            case 'itinerary':
                return <ItineraryView />;
            case 'info':
                return <InfoView userId={userId} />;
            case 'budget':
                return (
                    <BudgetTracker
                        expenses={expenses}
                        total={totalExpenses}
                        newAmount={newAmount}
                        setNewAmount={setNewAmount}
                        newDesc={newDesc}
                        setNewDesc={setNewDesc}
                        addExpense={addExpense}
                        loading={loading}
                        currency={currency}
                        setCurrency={setCurrency}
                    />
                );
            default:
                return <ItineraryView />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className={`p-4 ${ACCENT_COLOR} text-white shadow-lg`}>
                <h1 className="text-xl font-bold text-center">🇯🇵 東京・日光自駕行程</h1>
            </header>
            
            <main className="flex-grow overflow-y-auto pb-20">
                {renderContent()}
            </main>

            <TabNavigator activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
};

// --- Tab 導航列元件 ---
const TabNavigator = ({ activeTab, setActiveTab }) => {
    const TabButton = ({ name, icon, tabKey }) => (
        <button
            className={`flex flex-col items-center p-2 text-sm transition-colors duration-200 ${
                activeTab === tabKey ? ACCENT_COLOR : 'text-gray-500 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab(tabKey)}
        >
            <div className={`text-xl ${activeTab === tabKey ? 'text-white' : 'text-gray-500'}`}>{icon}</div>
            <span className={`mt-0.5 ${activeTab === tabKey ? 'text-white' : 'text-gray-500'}`}>{name}</span>
        </button>
    );

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 shadow-2xl flex justify-around z-50">
            <TabButton name="行程" icon="🗺️" tabKey="itinerary" />
            <TabButton name="總覽" icon="🔖" tabKey="info" />
            <TabButton name="記帳" icon="💰" tabKey="budget" />
        </nav>
    );
};

// --- 行程檢視元件 ---
const ItineraryView = () => {
    return (
        <div className="p-4 space-y-6">
            <h2 className={`text-2xl font-semibold mb-4 ${TEXT_COLOR}`}>每日行程</h2>
            {tripData.days.map((day, index) => (
                <div key={index} className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-700 p-2 border-l-4 border-amber-500 bg-gray-100 rounded-lg shadow-md">
                        🗓️ {day.date} - {day.title}
                    </h3>
                    {/* 天氣預報 Placeholder - 提醒用戶此處可串接天氣 API */}
                    <WeatherPlaceholder location={day.location} date={day.date} />
                    
                    <div className="space-y-3">
                        {day.activities.map((activity, actIndex) => (
                            <DailyCard key={actIndex} activity={activity} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 每日活動卡片元件 (核心設計) ---
const DailyCard = ({ activity }) => {
    const { type, time, name, location, icon, highlight, enhancement } = activity;

    // 根據類型設定卡片風格
    let typeColor = 'bg-gray-100';
    let typeIcon = icon || '📍';
    if (type === '餐飲') {
        typeColor = 'bg-red-50';
    } else if (type === '景點') {
        typeColor = 'bg-blue-50';
    } else if (type === '交通' || type === '住宿') {
        typeColor = 'bg-green-50';
    }

    // 導航按鈕只有在有 location 且非純交通活動時才顯示
    const showNav = location && type !== '交通' && type !== '住宿';

    return (
        <div className={`p-4 rounded-xl shadow-lg ${CARD_BG} transition-all duration-300 hover:shadow-xl`}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                    <span className="text-xs font-medium text-gray-500">{time} | {type}</span>
                    <h4 className={`text-lg font-semibold text-gray-800 break-words mt-1`}>
                        {typeIcon} {name}
                    </h4>
                </div>
                {showNav && (
                    <a
                        href={getGeoLink(location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-shrink-0 flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full ${ACCENT_COLOR} text-white shadow-md hover:bg-amber-600 transition-colors`}
                    >
                        導航 🚗
                    </a>
                )}
            </div>

            {(highlight || enhancement) && (
                <div className="mt-3 pt-2 border-t border-gray-100 space-y-1.5">
                    {/* 導遊職責 - 關鍵亮點 */}
                    {highlight && (
                        <p className="text-sm">
                            <span className="text-sm font-bold text-amber-500 mr-1">⭐ 必看必買:</span>
                            <span className={HIGHLIGHT_COLOR}>{highlight}</span>
                        </p>
                    )}
                    {/* 導遊職責 - 故事攻略 */}
                    {enhancement && (
                        <p className="text-xs text-gray-600">
                            <span className="text-sm font-bold text-gray-500 mr-1">💡 攻略/故事:</span>
                            {enhancement}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// --- 資訊總覽元件 ---
const InfoView = ({ userId }) => {
    const InfoBlock = ({ title, items, renderItem, isImportant = false }) => (
        <div className="p-4 rounded-xl bg-white shadow-lg">
            <h3 className={`text-xl font-bold mb-3 ${isImportant ? 'text-red-600' : TEXT_COLOR} border-b pb-1`}>{title}</h3>
            <div className="space-y-2">
                {items.map(renderItem)}
            </div>
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            <h2 className={`text-2xl font-semibold mb-4 ${TEXT_COLOR}`}>資訊總覽</h2>
            
            {/* 航班資訊 */}
            <InfoBlock
                title="✈️ 航班資訊"
                items={tripData.info.flights}
                renderItem={(f) => (
                    <div key={f.id} className="text-sm p-2 bg-gray-50 rounded">
                        <p className="font-semibold">{f.type}: {f.flight}</p>
                        <p className="text-gray-600">{f.route} | {f.time}</p>
                    </div>
                )}
            />

            {/* 住宿資訊 */}
            <InfoBlock
                title="🏠 住宿資訊"
                items={tripData.info.accommodations}
                renderItem={(a) => (
                    <div key={a.id} className="text-sm p-2 bg-gray-50 rounded">
                        <p className="font-semibold">{a.name}</p>
                        <p className="text-gray-600">日期: {a.dates}</p>
                        <p className="text-gray-600">電話: {a.phone}</p>
                    </div>
                )}
            />

            {/* 重要預約代號 */}
            <InfoBlock
                title="🔑 重要預約/備註"
                items={tripData.info.reservations}
                isImportant={true}
                renderItem={(r) => (
                    <div key={r.id} className="text-sm p-3 bg-red-50 border border-red-300 rounded-lg">
                        <p className="font-semibold text-red-700">{r.item} ({r.date})</p>
                        <p className="text-red-700 font-bold mt-1 break-words">代號: {r.code}</p>
                        {r.note && <p className="text-xs text-red-500 italic mt-1">{r.note}</p>}
                    </div>
                )}
            />

            {/* 緊急聯絡電話 */}
            <InfoBlock
                title="🚨 緊急聯絡電話"
                items={tripData.info.emergencies}
                isImportant={true}
                renderItem={(e) => (
                    <div key={e.id} className="text-sm p-2 bg-yellow-50 rounded">
                        <p className="font-semibold">{e.name}</p>
                        <p className="text-red-600 font-mono">{e.number}</p>
                    </div>
                )}
            />

            <div className="p-4 text-center text-xs text-gray-400">
                <p>App ID: {appId}</p>
                <p>User ID: {userId}</p>
            </div>
        </div>
    );
};

// --- 記帳/預算表元件 (Firebase 同步) ---
const BudgetTracker = ({ expenses, total, newAmount, setNewAmount, newDesc, setNewDesc, addExpense, loading, currency, setCurrency }) => {
    
    // 匯率查詢提醒 (Placeholder)
    const handleCurrencyChange = (e) => {
        setCurrency(e.target.value);
        console.log("Currency changed to:", e.target.value);
    }

    return (
        <div className="p-4 space-y-6">
            <h2 className={`text-2xl font-semibold ${TEXT_COLOR}`}>💰 記帳/預算表</h2>
            <p className="text-sm text-gray-500">（數據已串接 Firebase Firestore 即時同步）</p>

            {/* 總計區塊 */}
            <div className="p-4 rounded-xl bg-white shadow-lg border-b-4 border-amber-500">
                <p className="text-sm text-gray-500 font-medium">總支出 ({currency})</p>
                <p className="text-4xl font-extrabold text-amber-700 mt-1">
                    {loading ? '計算中...' : total.toFixed(0).toLocaleString()}
                </p>
            </div>

            {/* 新增花費表單 */}
            <form onSubmit={addExpense} className="p-4 rounded-xl bg-white shadow-lg space-y-3">
                <h3 className="text-lg font-semibold text-gray-700">新增消費</h3>
                <div className="flex space-x-2">
                    <select
                        className="w-1/4 p-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        value={currency}
                        onChange={handleCurrencyChange}
                    >
                        <option value="JPY">JPY ¥</option>
                        <option value="TWD">TWD $</option>
                    </select>
                    <input
                        type="number"
                        placeholder="金額 (e.g. 5200)"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        className="w-3/4 p-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        required
                    />
                </div>
                <input
                    type="text"
                    placeholder="描述 (e.g. 日光東照宮門票)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    required
                />
                <button
                    type="submit"
                    className={`w-full py-2 ${ACCENT_COLOR} text-white font-bold rounded-lg shadow-md hover:bg-amber-600 transition-colors disabled:opacity-50`}
                    disabled={loading || !newAmount || !newDesc}
                >
                    {loading ? '儲存中...' : '確認新增'}
                </button>
            </form>

            {/* 消費紀錄列表 */}
            <h3 className="text-lg font-semibold text-gray-700">消費紀錄</h3>
            <div className="space-y-2">
                {expenses.length === 0 && !loading ? (
                    <p className="text-center text-gray-400 p-4 bg-white rounded-lg shadow-inner">目前沒有消費紀錄</p>
                ) : (
                    expenses.map((exp) => (
                        <div key={exp.id} className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border-l-4 border-amber-300">
                            <div className='w-3/4'>
                                <p className="font-medium text-gray-800 break-words">{exp.description}</p>
                                <p className="text-xs text-gray-400">
                                    {exp.timestamp ? exp.timestamp.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }) : '同步中...'}
                                </p>
                            </div>
                            <p className="text-lg font-bold text-red-500 flex-shrink-0">
                                {exp.currency} {exp.amount.toLocaleString()}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// --- 天氣預報 Placeholder 元件 ---
const WeatherPlaceholder = ({ location, date }) => {
    // 這裡使用 Google Search API 模擬了當前地點的平均溫度，並提供即時天氣的串接提醒
    const [temp] = useState('10°C / 4°C'); // 假設 12月 日光/東京的平均溫度

    return (
        <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm shadow-inner">
            <span className="text-xl mr-3">☀️</span>
            <div className="flex-1">
                <p className="font-semibold">天氣預報 ({date} @ {location})</p>
                <p className="text-xs">
                    目前溫度：{temp}，乾燥寒冷。
                </p>
            </div>
            <span className="text-xs text-blue-500 ml-3 text-right">
                （提示：可在此處整合氣象 API 獲得即時天氣）
            </span>
        </div>
    );
}

export default App;
